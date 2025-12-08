// Load environment variables from .env.local for local development
import '../../env-loader.js';

export const config = {
  runtime: 'nodejs',
};

/**
 * Get stock data from GitHub raw URL or local assets
 */
async function getStockDataFromGitHub(
  symbol,
  githubToken,
  repoOwner = 'hbslovely',
  repoName = 'desktop-portfolio',
  branch = 'master'
) {
  const filePath = `src/assets/stocks/${symbol.toUpperCase()}.json`;

  // Try to get from GitHub raw URL first (public access)
  const rawUrl = `https://raw.githubusercontent.com/${repoOwner}/${repoName}/${branch}/${filePath}`;

  try {
    const response = await fetch(rawUrl, {
      headers: githubToken
        ? {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3.raw',
          }
        : {},
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, data };
    }

    // If not found, try GitHub API
    if (githubToken) {
      const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?ref=${branch}`;
      const apiResponse = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (apiResponse.ok) {
        const fileInfo = await apiResponse.json();
        // Decode base64 content
        const content = Buffer.from(fileInfo.content, 'base64').toString('utf-8');
        const data = JSON.parse(content);
        return { success: true, data };
      }
    }

    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Error fetching from GitHub:', error);
    return { success: false, error: error.message || 'Failed to fetch from GitHub' };
  }
}

export default async function handler(req) {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
    // Extract symbol from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const symbol = pathParts[pathParts.length - 1]?.toUpperCase();

    if (!symbol) {
      return new Response(
        JSON.stringify({ success: false, error: 'Symbol is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Get GitHub credentials from environment variables
    const githubToken = process.env['GITHUB_TOKEN'];
    const repoOwner = process.env['GITHUB_REPO_OWNER'] || 'hbslovely';
    const repoName = process.env['GITHUB_REPO_NAME'] || 'desktop-portfolio';
    const branch = process.env['GITHUB_BRANCH'] || 'master';

    // Fetch stock data from GitHub
    const result = await getStockDataFromGitHub(
      symbol,
      githubToken,
      repoOwner,
      repoName,
      branch
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'Stock data not found',
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result.data,
        symbol: symbol,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  } catch (error) {
    console.error('[symbol.js] Error fetching stock data:', error);
    console.error('[symbol.js] Error stack:', error?.stack);
    // Always return a response, never throw
    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

