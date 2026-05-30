const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractHandle,
  parseProfilesText,
  normalizeCookieAccounts,
  createAccountPool,
} = require('./src/lib/config');

test('extractHandle normalizes raw handles and instagram urls', () => {
  assert.equal(extractHandle('SmallRig.US'), 'smallrig.us');
  assert.equal(extractHandle('@factoryxii'), 'factoryxii');
  assert.equal(extractHandle('https://www.instagram.com/mofficial_usa/'), 'mofficial_usa');
});

test('parseProfilesText deduplicates and skips invalid lines', () => {
  const input = [
    'factoryxii',
    'https://www.instagram.com/factoryxii/',
    'bad path / not valid',
    '',
    '@mofficial_usa',
  ].join('\n');

  assert.deepEqual(parseProfilesText(input), ['factoryxii', 'mofficial_usa']);
});

test('normalizeCookieAccounts accepts json strings and requires cookies arrays', () => {
  const accounts = normalizeCookieAccounts(JSON.stringify([
    {
      label: 'acct-1',
      cookies: [{ name: 'sessionid', value: 'abc', domain: '.instagram.com', path: '/' }],
    },
  ]));

  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].label, 'acct-1');
  assert.equal(accounts[0].cookies[0].name, 'sessionid');

  assert.throws(() => normalizeCookieAccounts('[]'), /at least one account/i);
  assert.throws(
    () => normalizeCookieAccounts(JSON.stringify([{ label: 'broken', cookies: [] }])),
    /must include at least one cookie/i
  );
});

test('createAccountPool rotates active accounts and cools failed ones', () => {
  const pool = createAccountPool([
    { label: 'a', cookies: [{ name: 'sessionid', value: '1', domain: '.instagram.com', path: '/' }] },
    { label: 'b', cookies: [{ name: 'sessionid', value: '2', domain: '.instagram.com', path: '/' }] },
  ]);

  assert.equal(pool.next().label, 'a');
  assert.equal(pool.next().label, 'b');
  pool.markCooldown('a', 60_000, 'checkpoint');
  assert.equal(pool.next().label, 'b');
  pool.markInvalid('b', 'logout');
  assert.throws(() => pool.next(), /no active instagram accounts/i);
});
