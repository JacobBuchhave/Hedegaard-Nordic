let cachedData = null;
let cachedTimestamp = 0;
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN)
  try {
    const now = Date.now();

    // Return cached response if it's fresh
    if (cachedData && now - cachedTimestamp < CACHE_DURATION_MS) {
      return res.status(200).json({ cached: true, data: cachedData });
    }

    // Step 1: Get Auth Token
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        scope: 'https://api.businesscentral.dynamics.com/.default',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return res.status(500).json({ error: 'Failed to get access token', details: tokenData });
    }

    const accessToken = tokenData.access_token;

    // Step 2: Fetch from Business Central
    const bcResponse = await fetch(`https://api.businesscentral.dynamics.com/v2.0/${process.env.TENANT_ID}/Hedegaard/ODataV4/PackageTreeDataTransfer_GetData?company=77d82903-1f22-ee11-9cbf-002248896a2c`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    const data = await bcResponse.json();
    const items = JSON.parse(data.value).items;

    let dimensions = [];
    let types = [];

    items.forEach(item => {
        dimensions[item.dimension] = item.dimension;
        types[item.WebCategory] = item.WebCategory
    });
    dimensions = Object.values(dimensions).filter(Boolean);
    dimensions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    types = Object.values(types).filter(Boolean);
    types.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (!bcResponse.ok) {
      return res.status(500).json({ error: 'Failed to fetch data from Business Central', details: data });
    }

    // Cache the response
    cachedData = {types: types, dimensions: dimensions, items: items};
    cachedTimestamp = now;

    return res.status(200).json({ cached: false, data: cachedData });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
