const { proxyAppsScriptRequest } = require('./_apps-script-proxy');

module.exports = async function handler(req, res) {
  return proxyAppsScriptRequest(req, res, 'GOOGLE_BUSINESS_APPS_SCRIPT_URL');
};
