const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { loadInput } = require('./src/lib/input');

test('loadInput accepts inline profiles text and cookie accounts', () => {
  const input = loadInput({
    profilesText: 'factoryxii\n@mofficial_usa',
    cookieAccounts: [
      {
        label: 'acct-1',
        cookies: [{ name: 'sessionid', value: 'abc', domain: '.instagram.com', path: '/' }],
      },
    ],
    maxFollowingPerProfile: 123,
    scrollDelayMs: 456,
    accountCooldownMs: 789,
  });

  assert.deepEqual(input.profiles, ['factoryxii', 'mofficial_usa']);
  assert.equal(input.cookieAccounts.length, 1);
  assert.equal(input.maxFollowingPerProfile, 123);
  assert.equal(input.scrollDelayMs, 456);
  assert.equal(input.accountCooldownMs, 789);
});

test('loadInput reads profiles from file path', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-profiles-'));
  const filePath = path.join(tempDir, 'profiles.txt');
  fs.writeFileSync(filePath, 'smallrig.us\nfactoryxii\n');

  const input = loadInput({
    profilesFile: filePath,
    cookieAccounts: [
      {
        cookies: [{ name: 'sessionid', value: 'abc', domain: '.instagram.com', path: '/' }],
      },
    ],
  });

  assert.deepEqual(input.profiles, ['smallrig.us', 'factoryxii']);
});

test('loadInput rejects empty profiles', () => {
  assert.throws(() => loadInput({
    profilesText: '',
    cookieAccounts: [
      {
        cookies: [{ name: 'sessionid', value: 'abc', domain: '.instagram.com', path: '/' }],
      },
    ],
  }), /at least one instagram profile/i);
});
