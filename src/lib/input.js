const fs = require('fs');
const path = require('path');
const { parseProfilesText, normalizeCookieAccounts } = require('./config');

const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;
const DEFAULT_MAX_FOLLOWING = 5000;
const DEFAULT_SCROLL_DELAY_MS = 1200;

function parseNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadInput(rawInput = {}) {
  const profilesText = rawInput.profilesText
    ?? (rawInput.profilesFile ? fs.readFileSync(path.resolve(rawInput.profilesFile), 'utf8') : '');

  const profiles = parseProfilesText(profilesText);
  if (profiles.length === 0) {
    throw new Error('Input must include at least one Instagram profile');
  }

  const cookieAccounts = normalizeCookieAccounts(rawInput.cookieAccounts);

  return {
    profiles,
    cookieAccounts,
    maxFollowingPerProfile: parseNumber(rawInput.maxFollowingPerProfile, DEFAULT_MAX_FOLLOWING),
    scrollDelayMs: parseNumber(rawInput.scrollDelayMs, DEFAULT_SCROLL_DELAY_MS),
    accountCooldownMs: parseNumber(rawInput.accountCooldownMs, DEFAULT_COOLDOWN_MS),
  };
}

module.exports = {
  DEFAULT_COOLDOWN_MS,
  DEFAULT_MAX_FOLLOWING,
  DEFAULT_SCROLL_DELAY_MS,
  loadInput,
};
