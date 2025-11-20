const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const AMADEUS_API_KEY = process.env.REACT_APP_AMADEUS_API_KEY;
const AMADEUS_API_SECRET = process.env.REACT_APP_AMADEUS_API_SECRET;
const AMADEUS_BASE_URL = 'https://test.api.amadeus.com/v2';

let cachedToken = null;
let tokenExpiry = null;

// Lấy access token từ Amadeus
async function getAccessToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        console.log('✅ Using cached token');
        return cachedToken;
    }

    console.log('🔑 Getting new Amadeus token...');
    
    const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: AMADEUS_API_KEY,
            client_secret: AMADEUS_API_SECRET
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Amadeus auth failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Trừ 1 phút để an toàn
    
    console.log('✅ Token obtained, expires in', data.expires_in, 'seconds');
    return cachedToken;
}

// API endpoint để tìm chuyến bay
app.get('/api/flights', async (req, res) => {
    try {
        const { origin, destination, date, travelers = 1 } = req.query;

        console.log(`✈️ Flight search request: ${origin} → ${destination} on ${date} (${travelers} pax)`);

        if (!origin || !destination || !date) {
            return res.status(400).json({ error: 'Missing required parameters: origin, destination, date' });
        }

        // Lấy token
        const token = await getAccessToken();

        // Gọi Amadeus API - lấy nhiều chuyến bay hơn
        const url = `${AMADEUS_BASE_URL}/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${date}&adults=${travelers}&max=10&nonStop=false`;

        console.log('📡 Calling Amadeus API...');
        console.log('🔗 URL:', url);
        console.log('🔑 Token:', token.substring(0, 20) + '...');
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('📊 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Amadeus API error:', response.status);
            console.error('❌ Error details:', errorText);
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        console.log(`✅ Found ${data.data?.length || 0} flights`);
        
        res.json(data);
    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// TomTom Traffic API proxy
app.get('/api/tomtom/traffic', async (req, res) => {
    try {
        const { bbox, key } = req.query;
        
        if (!bbox || !key) {
            return res.status(400).json({ error: 'Missing required parameters: bbox, key' });
        }

        const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${key}&bbox=${bbox}`;
        
        console.log('🚗 TomTom Traffic request:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ TomTom API error:', response.status, errorText);
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();
        console.log(`✅ TomTom: Found ${data.incidents?.length || 0} incidents`);
        
        res.json(data);
    } catch (error) {
        console.error('❌ TomTom proxy error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Amadeus proxy server is running',
        hasToken: !!cachedToken
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 ========================================`);
    console.log(`✅ Amadeus Backend Proxy Server Started`);
    console.log(`📍 Running on: http://localhost:${PORT}`);
    console.log(`🔑 API Key: ${AMADEUS_API_KEY?.substring(0, 10)}...`);
    console.log(`========================================\n`);
});
