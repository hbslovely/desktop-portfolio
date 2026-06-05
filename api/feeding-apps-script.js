const { proxyAppsScriptRequest } = require('./_apps-script-proxy');

module.exports = async function handler(req, res) {
  return proxyAppsScriptRequest(req, res, 'GOOGLE_FEEDING_APPS_SCRIPT_URL');
};
