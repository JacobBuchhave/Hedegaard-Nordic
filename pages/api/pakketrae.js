import axios from 'axios';

let cache = null;
const cacheExpiry = 10 * 60 * 1000; // 10 minutes cache
let lastFetchTime = null;

export default async function handler(req, res) {
    try {
        // Check if we have cached data and it's still valid
        if (cache && lastFetchTime && (Date.now() - lastFetchTime < cacheExpiry)) {
            return res.status(200).json(cache);
        }

        // Fetch the OAuth token
        const token = await getBcToken();
        if (!token) {
            return res.status(500).json({ error: 'Unable to fetch OAuth token' });
        }

        // Fetch the results from Business Central
        const results = await getBcResults(token);
        if (!results) {
            return res.status(500).json({ error: 'Unable to fetch results from Business Central' });
        }

        // Cache results and reset the last fetch time
        cache = results;
        lastFetchTime = Date.now();

        // Return the fetched results
        res.status(200).json(results);
    } catch (error) {
        console.error("Error in API handler:", error);
        res.status(500).json({ error: 'API call failed' });
    }
}

async function getBcToken() {
    const clientId = 'ce6a3197-8b57-472f-90f4-9e540ab643ba';
    const clientSecret = process.env.CLIENT_SECRET; // Set this in Vercel
    const tokenUrl = 'https://login.microsoftonline.com/35fea29a-3272-4b89-acb9-ab42362ca62a/oauth2/v2.0/token';
    
    try {
        const response = await axios.post(tokenUrl, new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://api.businesscentral.dynamics.com/.default',
            grant_type: 'client_credentials'
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        return response.data.access_token;
    } catch (error) {
        console.error("Failed to retrieve token:", error.response?.data || error);
        return null;
    }
}

async function getBcResults(token) {
    const url = 'https://api.businesscentral.dynamics.com/v2.0/35fea29a-3272-4b89-acb9-ab42362ca62a/Hedegaard/ODataV4/PackageTreeDataTransfer_GetData?company=77d82903-1f22-ee11-9cbf-002248896a2c';

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
            }
        });

        return response.data.value; // Adjust according to the actual return structure
    } catch (error) {
        console.error("Failed to get data from Business Central:", error.response?.data || error);
        return null;
    }
}