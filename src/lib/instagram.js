function classifyInstagramFailure(message) {
  const text = String(message || '').toLowerCase();
  if (/challenge|checkpoint|suspicious|confirm/.test(text)) return 'cooldown';
  if (/login|logged out|session|cookie|password/.test(text)) return 'invalid';
  return 'retryable';
}

function isLoginPage(url) {
  return /instagram\.com\/accounts\/login/i.test(String(url || ''));
}

module.exports = {
  classifyInstagramFailure,
  isLoginPage,
};
