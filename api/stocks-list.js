export const config = {
  runtime: 'nodejs',
};

/**
 * Get list of all stock symbols from GitHub
 */
async function getStockListFromGitHub(
  githubToken,
  repoOwner = 'hbslovely',
  repoName = 'desktop-portfolio',
  branch = 'master'
) {
  const folderPath = 'api/data/stocks';
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${folderPath}?ref=${branch}`;

  try {
    const response = await fetch(apiUrl, {
      headers: githubToken
        ? {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
          }
        : {
            'Accept': 'application/vnd.github.v3+json',
          },
    });

    // If folder doesn't exist (404), return empty list
    if (response.status === 404) {
      console.log('Stocks folder does not exist yet, returning empty list');
      return { success: true, symbols: [] };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);
      return {
        success: false,
        error: `GitHub API error: ${response.status} - ${errorText}`
      };
    }

    const files = await response.json();

    // Handle case where API returns an object instead of array
    if (!Array.isArray(files)) {
      console.log('GitHub API returned non-array response, returning empty list');
      return { success: true, symbols: [] };
    }

    // Filter JSON files and extract symbols
    const symbols = files
      .filter((file) => file.type === 'file' && file.name.endsWith('.json'))
      .map((file) => file.name.replace('.json', '').toUpperCase())
      .sort();

    return { success: true, symbols };
  } catch (error) {
    console.error('Error fetching stock list:', error);
    return { success: true, symbols: [] };
  }
}

export default async function handler(req) {
  try {
    console.log('[stocks-list.js] API requested', req?.url, req?.method);

    // Handle CORS preflight
    if (req?.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (req?.method !== 'GET') {
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

    // Get GitHub credentials from environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_REPO_OWNER || 'hbslovely';
    const repoName = process.env.GITHUB_REPO_NAME || 'desktop-portfolio';
    const branch = process.env.GITHUB_BRANCH || 'master';

    console.log('[stocks-list.js] Environment:', {
      hasToken: !!githubToken,
      repoOwner,
      repoName,
      branch
    });

    // Fetch stock list from GitHub
    const result = await getStockListFromGitHub(
      githubToken,
      repoOwner,
      repoName,
      branch
    );

    console.log('[stocks-list.js] Result:', {
      success: result.success,
      symbolsCount: result.symbols?.length || 0,
      error: result.error
    });

    if (!result.success && result.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || 'Failed to fetch stock list',
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

    return new Response(
      JSON.stringify({
        success: true,
        symbols: result.symbols || [],
        count: result.symbols?.length || 0,
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
    console.error('[stocks-list.js] Unhandled error:', error);
    console.error('[stocks-list.js] Error stack:', error?.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error?.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
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

