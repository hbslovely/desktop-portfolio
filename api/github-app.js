/**
 * GitHub App Authentication Utility
 * 
 * This module handles GitHub App authentication using JWT tokens
 * and installation access tokens.
 */

// Cache for installation access tokens (expire after 1 hour)
let tokenCache = {
  token: null,
  expiresAt: null,
};

/**
 * Generate JWT token for GitHub App
 * @param {string} appId - GitHub App ID
 * @param {string} privateKey - GitHub App Private Key (PEM format)
 * @returns {string} JWT token
 */
import jwt from 'jsonwebtoken';

function generateJWT(appId, privateKey) {
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued at time (60 seconds ago to account for clock skew)
    exp: now + (10 * 60), // Expires in 10 minutes
    iss: appId, // Issuer (GitHub App ID)
  };

  try {
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (error) {
    console.error('[github-app] Error generating JWT:', error);
    throw new Error('Failed to generate JWT token');
  }
}

/**
 * Get installation access token from GitHub
 * @param {string} jwtToken - JWT token for the app
 * @param {string} installationId - Installation ID (optional, will auto-detect if not provided)
 * @param {string} owner - Repository owner
 * @returns {Promise<string>} Installation access token
 */
async function getInstallationToken(jwtToken, installationId, owner) {
  try {
    let installId = installationId;

    // If installation ID is not provided, try to find it
    if (!installId) {
      const installationsUrl = 'https://api.github.com/app/installations';
      const installationsResponse = await fetch(installationsUrl, {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!installationsResponse.ok) {
        throw new Error(`Failed to get installations: ${installationsResponse.status}`);
      }

      const installations = await installationsResponse.json();
      
      // Find installation for the specific owner
      const installation = installations.find(inst => 
        inst.account?.login?.toLowerCase() === owner?.toLowerCase()
      );

      if (!installation) {
        throw new Error(`No installation found for owner: ${owner}`);
      }

      installId = installation.id;
      console.log(`[github-app] Found installation ID: ${installId} for owner: ${owner}`);
    }

    // Get installation access token
    const tokenUrl = `https://api.github.com/app/installations/${installId}/access_tokens`;
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      throw new Error(`Failed to get installation token: ${tokenResponse.status} - ${error.message || 'Unknown error'}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.token;
  } catch (error) {
    console.error('[github-app] Error getting installation token:', error);
    throw error;
  }
}

/**
 * Get GitHub App installation access token (with caching)
 * @param {string} appId - GitHub App ID
 * @param {string} privateKey - GitHub App Private Key
 * @param {string} installationId - Installation ID (optional)
 * @param {string} owner - Repository owner
 * @returns {Promise<string>} Installation access token
 */
async function getCachedInstallationToken(appId, privateKey, installationId, owner) {
  // Check if cached token is still valid (with 5 minute buffer)
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt && now < (tokenCache.expiresAt - 5 * 60 * 1000)) {
    console.log('[github-app] Using cached installation token');
    return tokenCache.token;
  }

  // Generate new JWT
  const jwtToken = generateJWT(appId, privateKey);
  
  // Get installation access token
  const installationToken = await getInstallationToken(jwtToken, installationId, owner);
  
  // Cache the token (GitHub installation tokens expire after 1 hour)
  tokenCache = {
    token: installationToken,
    expiresAt: now + (55 * 60 * 1000), // Cache for 55 minutes (5 min buffer before 1 hour expiry)
  };

  console.log('[github-app] Generated new installation token');
  return installationToken;
}

/**
 * Get GitHub App authentication token
 * This is the main function to use in API handlers
 * 
 * @param {string} repoOwner - Repository owner (for auto-detecting installation)
 * @returns {Promise<string>} Installation access token
 */
export async function getGitHubAppToken(repoOwner) {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_CLIENT_SECRET; // Private key stored as client secret
  const installationId = process.env.GITHUB_INSTALLATION_ID;

  if (!appId) {
    throw new Error('GITHUB_APP_ID environment variable is not set');
  }

  if (!privateKey) {
    throw new Error('GITHUB_CLIENT_SECRET environment variable is not set');
  }

  // Format private key if needed (handle newlines)
  const formattedKey = privateKey.includes('\\n')
    ? privateKey.replace(/\\n/g, '\n')
    : privateKey;

  try {
    return await getCachedInstallationToken(appId, formattedKey, installationId, repoOwner);
  } catch (error) {
    console.error('[github-app] Failed to get GitHub App token:', error);
    throw error;
  }
}

/**
 * Clear the token cache (useful for testing or forced refresh)
 */
export function clearTokenCache() {
  tokenCache = {
    token: null,
    expiresAt: null,
  };
}

