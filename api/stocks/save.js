export const config = {
  runtime: 'nodejs',
};

/**
 * Commit file to GitHub using GitHub API
 */
async function commitToGitHub(
  symbol,
  content,
  githubToken,
  repoOwner,
  repoName,
  branch = 'master'
) {
  const filePath = `src/assets/stocks/${symbol.toUpperCase()}.json`;
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

  try {
    // Check if file exists
    const checkResponse = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    let sha;
    if (checkResponse.ok) {
      const existingFile = await checkResponse.json();
      sha = existingFile.sha;
    }

    // Encode content to base64
    const encodedContent = Buffer.from(content, 'utf-8').toString('base64');

    // Create or update file
    const commitResponse = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Update stock data for ${symbol.toUpperCase()}`,
        content: encodedContent,
        branch: branch,
        ...(sha ? { sha } : {}), // Include sha if updating existing file
      }),
    });

    if (!commitResponse.ok) {
      const error = await commitResponse.json();
      console.error('GitHub API error:', error);
      return {
        success: false,
        message: error.message || 'Failed to commit to GitHub',
      };
    }

    const result = await commitResponse.json();
    return {
      success: true,
      message: 'File committed successfully',
      sha: result.content.sha,
    };
  } catch (error) {
    console.error('Error committing to GitHub:', error);
    return {
      success: false,
      message: error.message || 'Failed to commit to GitHub',
    };
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
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (req.method !== 'POST') {
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
    const body = await req.json();
    const { symbol, basicInfo, priceData, fullData } = body;

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
    const repoOwner = process.env['GITHUB_REPO_OWNER'] || 'hongphat';
    const repoName = process.env['GITHUB_REPO_NAME'] || 'desktop-portfolio';
    const branch = process.env['GITHUB_BRANCH'] || 'master';

    if (!githubToken) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'GitHub token not configured',
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

    // Prepare stock data
    const stockData = {
      symbol: symbol.toUpperCase(),
      basicInfo,
      priceData,
      fullData,
      updatedAt: new Date().toISOString(),
    };

    // Convert to JSON string with pretty formatting
    const jsonContent = JSON.stringify(stockData, null, 2);

    // Commit to GitHub
    const commitResult = await commitToGitHub(
      symbol,
      jsonContent,
      githubToken,
      repoOwner,
      repoName,
      branch
    );

    if (!commitResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: commitResult.message || 'Failed to save stock data',
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
        message: commitResult.message,
        symbol: symbol.toUpperCase(),
        sha: commitResult.sha,
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
    console.error('[save.js] Error saving stock data:', error);
    console.error('[save.js] Error stack:', error?.stack);
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

