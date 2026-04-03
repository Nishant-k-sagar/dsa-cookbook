interface Env {
  COSMOS_ENDPOINT: string;
  COSMOS_KEY: string;
  COSMOS_DATABASE: string;
}

const cache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCachedData<T>(key: string): T | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  if (cached) {
    cache.delete(key);
  }
  return null;
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

const cacheHeaders = {
  'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
  'CDN-Cache-Control': 'max-age=600',
  'Cloudflare-CDN-Cache-Control': 'max-age=600',
};

async function cosmosQuery(
  endpoint: string,
  key: string,
  database: string,
  container: string,
  query: string,
  parameters: { name: string; value: unknown }[] = []
): Promise<{ Documents: unknown[] }> {
  const date = new Date().toUTCString();
  const resourceLink = `dbs/${database}/colls/${container}`;
  const requestUrl = `${endpoint}${resourceLink}/docs`;
  const body = JSON.stringify({ query, parameters });
  const authToken = await generateAuthToken(key, 'post', 'docs', resourceLink, date);

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: {
      'Authorization': authToken,
      'x-ms-date': date,
      'x-ms-version': '2018-12-31',
      'Content-Type': 'application/query+json',
      'Accept': 'application/json',
      'x-ms-documentdb-isquery': 'true',
      'x-ms-documentdb-query-enablecrosspartition': 'true',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cosmos DB query failed: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<{ Documents: unknown[] }>;
}

async function generateAuthToken(
  key: string,
  verb: string,
  resourceType: string,
  resourceLink: string,
  date: string
): Promise<string> {
  const stringToSign = `${verb.toLowerCase()}\n${resourceType.toLowerCase()}\n${resourceLink}\n${date.toLowerCase()}\n\n`;
  const encoder = new TextEncoder();
  const keyBytes = Uint8Array.from(atob(key), c => c.charCodeAt(0));
  const payloadBytes = encoder.encode(stringToSign);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadBytes);
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

  return encodeURIComponent(`type=master&ver=1.0&sig=${signatureBase64}`);
}

function matchRoute(pathname: string): { route: string; params: Record<string, string> } | null {
  if (pathname === '/health') {
    return { route: 'health', params: {} };
  }

  if (pathname === '/api/topics') {
    return { route: 'topics', params: {} };
  }

  const topicProblemsMatch = pathname.match(/^\/api\/topics\/([^/]+)\/problems$/);
  if (topicProblemsMatch) {
    return { route: 'topicProblems', params: { topicSlug: topicProblemsMatch[1] } };
  }

  const topicMatch = pathname.match(/^\/api\/topics\/([^/]+)$/);
  if (topicMatch) {
    return { route: 'topic', params: { slug: topicMatch[1] } };
  }

  if (pathname === '/api/problems') {
    return { route: 'problems', params: {} };
  }

  const problemMatch = pathname.match(/^\/api\/problems\/([^/]+)$/);
  if (problemMatch) {
    return { route: 'problem', params: { slug: problemMatch[1] } };
  }

  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const matched = matchRoute(pathname);

      if (!matched) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }

      const { COSMOS_ENDPOINT, COSMOS_KEY, COSMOS_DATABASE } = env;

      if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
        return new Response(JSON.stringify({ error: 'Missing Cosmos DB configuration' }), {
          status: 500,
          headers: corsHeaders,
        });
      }

      switch (matched.route) {
        case 'health': {
          return new Response(
            JSON.stringify({
              status: 'ok',
              timestamp: new Date().toISOString(),
              uptime: 0,
            }),
            { headers: corsHeaders }
          );
        }

        case 'topics': {
          const cacheKey = 'topics';
          let data = getCachedData(cacheKey);
          if (!data) {
            const result = await cosmosQuery(
              COSMOS_ENDPOINT,
              COSMOS_KEY,
              COSMOS_DATABASE,
              'topics',
              'SELECT * FROM c'
            );
            data = result.Documents;
            setCachedData(cacheKey, data);
          }
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, ...cacheHeaders } });
        }

        case 'topic': {
          const slug = matched.params.slug;
          const cacheKey = `topic-${slug}`;
          let data = getCachedData(cacheKey);
          if (!data) {
            const result = await cosmosQuery(
              COSMOS_ENDPOINT,
              COSMOS_KEY,
              COSMOS_DATABASE,
              'topics',
              'SELECT * FROM c WHERE c.slug = @slug',
              [{ name: '@slug', value: slug }]
            );
            if (result.Documents.length === 0) {
              return new Response(JSON.stringify({ error: 'Topic not found' }), {
                status: 404,
                headers: corsHeaders,
              });
            }
            data = result.Documents[0];
            setCachedData(cacheKey, data);
          }
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, ...cacheHeaders } });
        }

        case 'problems': {
          const cacheKey = 'problems';
          let data = getCachedData(cacheKey);
          if (!data) {
            const result = await cosmosQuery(
              COSMOS_ENDPOINT,
              COSMOS_KEY,
              COSMOS_DATABASE,
              'problems',
              'SELECT * FROM c'
            );
            data = result.Documents;
            setCachedData(cacheKey, data);
          }
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, ...cacheHeaders } });
        }

        case 'problem': {
          const slug = matched.params.slug;
          const cacheKey = `problem-${slug}`;
          let data = getCachedData(cacheKey);
          if (!data) {
            const result = await cosmosQuery(
              COSMOS_ENDPOINT,
              COSMOS_KEY,
              COSMOS_DATABASE,
              'problems',
              'SELECT * FROM c WHERE c.slug = @slug',
              [{ name: '@slug', value: slug }]
            );
            if (result.Documents.length === 0) {
              return new Response(JSON.stringify({ error: 'Problem not found' }), {
                status: 404,
                headers: corsHeaders,
              });
            }
            data = result.Documents[0];
            setCachedData(cacheKey, data);
          }
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, ...cacheHeaders } });
        }

        case 'topicProblems': {
          const topicSlug = matched.params.topicSlug;
          const cacheKey = `problems-topic-${topicSlug}`;
          let data = getCachedData(cacheKey);
          if (!data) {
            const result = await cosmosQuery(
              COSMOS_ENDPOINT,
              COSMOS_KEY,
              COSMOS_DATABASE,
              'problems',
              'SELECT * FROM c WHERE c.topicSlug = @topicSlug',
              [{ name: '@topicSlug', value: topicSlug }]
            );
            data = result.Documents;
            setCachedData(cacheKey, data);
          }
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, ...cacheHeaders } });
        }

        default:
          return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: corsHeaders,
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};