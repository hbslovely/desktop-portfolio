export const config = {
  runtime: 'nodejs',
};

/**
 * Get list of all stock symbols from GitHub
 */
async function getStockListFromGitHub(
  githubToken?: string,
  repoOwner: string = 'hongphat',
  repoName: string = 'desktop-portfolio',
  branch: string = 'master'
): Promise<{ success: boolean; symbols?: string[]; error?: string }> {
  const folderPath = 'src/assets/stocks';
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

    if (!response.ok) {
      return { success: false, error: 'Failed to fetch stock list' };
    }

    const files = await response.json();
    
    // Filter JSON files and extract symbols
    const symbols = files
      .filter((file: any) => file.type === 'file' && file.name.endsWith('.json'))
      .map((file: any) => file.name.replace('.json', '').toUpperCase())
      .sort();

    return { success: true, symbols };
  } catch (error: any) {
    console.error('Error fetching stock list:', error);
    return { success: false, error: error.message || 'Failed to fetch stock list' };
  }
}

export default async function handler(req: Request) {
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

  try {
    // Get GitHub credentials from environment variables
    const githubToken = process.env['GITHUB_TOKEN'];
    const repoOwner = process.env['GITHUB_REPO_OWNER'] || 'hongphat';
    const repoName = process.env['GITHUB_REPO_NAME'] || 'desktop-portfolio';
    const branch = process.env['GITHUB_BRANCH'] || 'master';

    // Fetch stock list from GitHub
    const result = await getStockListFromGitHub(
      githubToken,
      repoOwner,
      repoName,
      branch
    );

    if (!result.success) {
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
  } catch (error: any) {
    console.error('Error fetching stock list:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
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

