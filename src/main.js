const fs = require('fs');
const path = require('path');
const { Actor } = require('apify');
const { PlaywrightCrawler } = require('crawlee');
const { createAccountPool } = require('./lib/config');
const { loadInput } = require('./lib/input');
const { classifyInstagramFailure, isLoginPage } = require('./lib/instagram');

function loadLocalFallbackInput() {
  if (process.env.APIFY_INPUT) {
    return JSON.parse(process.env.APIFY_INPUT);
  }

  const fallbackPath = path.join(process.cwd(), 'test-input.json');
  if (fs.existsSync(fallbackPath)) {
    return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
  }

  return {};
}

async function applyCookies(context, account) {
  await context.addCookies(account.cookies);
}

async function openFollowingDialog(page, handle) {
  await page.goto(`https://www.instagram.com/${handle}/`, { waitUntil: 'domcontentloaded' });
  if (isLoginPage(page.url())) {
    throw new Error('Instagram redirected to login page');
  }

  const followingLink = page.locator('a[href$="/following/"]').first();
  await followingLink.waitFor({ timeout: 20_000 });
  await followingLink.click();
  await page.locator('div[role="dialog"]').first().waitFor({ timeout: 20_000 });
}

async function scrapeFollowing(page, handle, maxFollowingPerProfile, scrollDelayMs) {
  const dialog = page.locator('div[role="dialog"]').first();
  const seen = new Set();
  let stagnantIterations = 0;

  while (seen.size < maxFollowingPerProfile && stagnantIterations < 5) {
    const usernames = await dialog.locator('a[role="link"]').evaluateAll((links) => {
      return links
        .map((link) => link.getAttribute('href') || '')
        .map((href) => href.match(/^\/([A-Za-z0-9._]+)\/?$/)?.[1])
        .filter(Boolean);
    });

    const before = seen.size;
    for (const username of usernames) seen.add(username.toLowerCase());
    stagnantIterations = seen.size === before ? stagnantIterations + 1 : 0;

    await dialog.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.waitForTimeout(scrollDelayMs);
  }

  return Array.from(seen).slice(0, maxFollowingPerProfile).map((followedUsername) => ({
    source_profile: handle,
    followed_username: followedUsername,
    fetched_at: new Date().toISOString(),
  }));
}

async function run() {
  await Actor.init();
  try {
    const rawInput = await Actor.getInput() || loadLocalFallbackInput();
    console.log('RAW_INPUT_KEYS', Object.keys(rawInput || {}));
    const input = loadInput(rawInput);
    console.log('PARSED_PROFILES', input.profiles);
    console.log('COOKIE_ACCOUNT_LABELS', input.cookieAccounts.map((account) => account.label));
    const accountPool = createAccountPool(input.cookieAccounts);
    const stateStore = await Actor.openKeyValueStore('account-state');

    const crawler = new PlaywrightCrawler({
      maxConcurrency: Math.min(input.cookieAccounts.length, 5),
      requestHandlerTimeoutSecs: 180,
      async requestHandler({ page, request, browserController, log }) {
        const handle = request.userData.handle;
        const account = request.userData.account;
        const context = browserController.browserContext;

        try {
          await applyCookies(context, account);
          await openFollowingDialog(page, handle);
          const rows = await scrapeFollowing(page, handle, input.maxFollowingPerProfile, input.scrollDelayMs);
          for (const row of rows) {
            await Actor.pushData({
              account_label: account.label,
              ...row,
            });
          }
          log.info(`Finished ${handle} with ${rows.length} following rows`, { account: account.label });
        } catch (error) {
          const category = classifyInstagramFailure(error.message || error);
          if (category === 'cooldown') {
            accountPool.markCooldown(account.label, input.accountCooldownMs, error.message || error);
          } else if (category === 'invalid') {
            accountPool.markInvalid(account.label, error.message || error);
          }

          await stateStore.setValue(account.label, {
            status: category,
            error: String(error.message || error),
            updatedAt: new Date().toISOString(),
          });
          throw error;
        }
      },
      failedRequestHandler({ request, log }) {
        log.error(`Failed ${request.userData.handle}`);
      },
    });

    const requests = input.profiles.map((handle) => ({
      url: `https://www.instagram.com/${handle}/`,
      uniqueKey: handle,
      userData: {
        handle,
        account: accountPool.next(),
      },
    }));
    console.log('REQUEST_COUNT', requests.length);

    await crawler.run(requests);
  } finally {
    await Actor.exit();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  applyCookies,
  openFollowingDialog,
  scrapeFollowing,
  run,
};
