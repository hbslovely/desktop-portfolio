export const config = {
  runtime: 'edge',
};

// Helper function to rewrite Facebook URLs to proxy URLs
function rewriteFacebookUrls(html: string, baseUrl: string): string {
  const origin = new URL(baseUrl).origin;
  
  // Patterns to match Facebook URLs in various contexts
  const patterns = [
    // Full URLs: https://www.facebook.com/... or https://fb.com/...
    /https?:\/\/(?:www\.)?(?:facebook|fb)\.com([^\s"'<>]*)/gi,
    // Protocol-relative: //www.facebook.com/...
    /\/\/(?:www\.)?(?:facebook|fb)\.com([^\s"'<>]*)/gi,
    // Meta refresh redirects
    /content=["']\d+;\s*url=([^"']*facebook\.com[^"']*)/gi,
    // JavaScript redirects
    /window\.location\.(href|replace)\s*=\s*["']([^"']*facebook\.com[^"']*)["']/gi,
    // Location header in meta tags
    /<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']*facebook\.com[^"']*)/gi,
  ];

  let rewritten = html;
  
  // Replace full Facebook URLs
  rewritten = rewritten.replace(/https?:\/\/(?:www\.)?(?:facebook|fb)\.com([^\s"'<>]*)/gi, (match, path) => {
    return `${origin}/api/facebook${path}`;
  });
  
  // Replace protocol-relative URLs
  rewritten = rewritten.replace(/\/\/(?:www\.)?(?:facebook|fb)\.com([^\s"'<>]*)/gi, (match, path) => {
    return `${origin}/api/facebook${path}`;
  });
  
  // Replace in meta refresh
  rewritten = rewritten.replace(/(content=["']\d+;\s*url=)([^"']*facebook\.com[^"']*)/gi, (match, prefix, url) => {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `${prefix}${origin}/api/facebook${urlObj.pathname}${urlObj.search}`;
  });
  
  // Replace in JavaScript redirects
  rewritten = rewritten.replace(/(window\.location\.(?:href|replace)\s*=\s*["'])([^"']*facebook\.com[^"']*)(["'])/gi, (match, prefix, url, suffix) => {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return `${prefix}${origin}/api/facebook${urlObj.pathname}${urlObj.search}${suffix}`;
  });

  return rewritten;
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const path = url.pathname.replace('/api/facebook', '') || '/';
  const queryString = url.search;
  const facebookUrl = `https://www.facebook.com${path}${queryString}`;

  try {
    // Fetch with redirect handling
    let response = await fetch(facebookUrl, {
      method: req.method || 'GET',
      redirect: 'manual', // Handle redirects manually
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en,vi;q=0.9,en-US;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-CH-UA': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'Sec-CH-UA-Mobile': '?0',
        'Sec-CH-UA-Platform': '"macOS"',
        'Sec-CH-UA-Platform-Version': '"15.7.1"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.facebook.com/',
        // Forward cookies if present
        ...(req.headers.get('cookie') ? { 'Cookie': req.headers.get('cookie')! } : {}),
      },
    });

    // Handle redirects (301, 302, 307, 308)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        // Parse redirect URL
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, facebookUrl);
        } catch {
          redirectUrl = new URL(location);
        }
        
        // If redirect is to Facebook domain, rewrite to proxy path
        if (redirectUrl.hostname.includes('facebook.com') || redirectUrl.hostname.includes('fb.com')) {
          const redirectPath = redirectUrl.pathname + redirectUrl.search;
          const proxyRedirectUrl = new URL(`/api/facebook${redirectPath}`, url.origin);
          
          // Return redirect with rewritten URL
          return new Response(null, {
            status: response.status,
            headers: {
              'Location': proxyRedirectUrl.toString(),
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }
    }

    const html = await response.text();
    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';
    
    // Rewrite URLs in HTML content
    const rewrittenHtml = rewriteFacebookUrls(html, url.origin);
    
    // Return response with CORS headers
    return new Response(rewrittenHtml, {
      status: response.status,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Accept-Language, User-Agent, Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, Sec-Fetch-User, Upgrade-Insecure-Requests, Cache-Control',
      },
    });
  } catch (error) {
    console.error('Error fetching Facebook:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Facebook content' }),
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

