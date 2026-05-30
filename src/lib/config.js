function extractHandle(value) {
  const input = String(value || '').trim();
  if (!input) return null;

  const directMatch = input.match(/^@?([A-Za-z0-9._]+)$/);
  if (directMatch) return directMatch[1].toLowerCase();

  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    if (!/instagram\.com$/i.test(url.hostname.replace(/^www\./i, ''))) return null;
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const [first] = segments;
    if (!/^[A-Za-z0-9._]+$/.test(first)) return null;
    return first.toLowerCase();
  } catch {
    return null;
  }
}

function parseProfilesText(text) {
  const handles = [];
  const seen = new Set();

  for (const line of String(text || '').split(/\r?\n/)) {
    const handle = extractHandle(line);
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    handles.push(handle);
  }

  return handles;
}

function normalizeCookieAccounts(rawValue) {
  const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('cookieAccounts must include at least one account');
  }

  return parsed.map((account, index) => {
    const label = String(account.label || `account-${index + 1}`);
    const cookies = Array.isArray(account.cookies) ? account.cookies : [];
    if (cookies.length === 0) {
      throw new Error(`Account ${label} must include at least one cookie`);
    }
    return {
      label,
      cookies,
    };
  });
}

function createAccountPool(accounts) {
  const state = accounts.map((account) => ({
    ...account,
    status: 'active',
    cooldownUntil: 0,
    failureReason: '',
  }));
  let cursor = 0;

  function getActiveAccounts() {
    const now = Date.now();
    return state.filter((account) => account.status === 'active' || (account.status === 'cooldown' && account.cooldownUntil <= now));
  }

  return {
    next() {
      const active = getActiveAccounts();
      if (active.length === 0) {
        throw new Error('No active Instagram accounts available');
      }
      const picked = active[cursor % active.length];
      cursor += 1;
      picked.status = 'active';
      picked.cooldownUntil = 0;
      return picked;
    },
    markCooldown(label, durationMs, reason) {
      const account = state.find((entry) => entry.label === label);
      if (!account) return;
      account.status = 'cooldown';
      account.cooldownUntil = Date.now() + Math.max(0, Number(durationMs) || 0);
      account.failureReason = String(reason || 'cooldown');
    },
    markInvalid(label, reason) {
      const account = state.find((entry) => entry.label === label);
      if (!account) return;
      account.status = 'invalid';
      account.failureReason = String(reason || 'invalid');
    },
    snapshot() {
      return state.map((account) => ({
        label: account.label,
        status: account.status,
        cooldownUntil: account.cooldownUntil,
        failureReason: account.failureReason,
      }));
    },
  };
}

module.exports = {
  extractHandle,
  parseProfilesText,
  normalizeCookieAccounts,
  createAccountPool,
};
