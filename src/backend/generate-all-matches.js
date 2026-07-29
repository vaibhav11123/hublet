// Quick script to generate matches for all buyers
const http = require('http');
const https = require('https');
require('dotenv').config();

// Use API_BASE_URL env variable or fall back to localhost for dev
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const parsedUrl = new URL(API_BASE_URL);
const isHttps = parsedUrl.protocol === 'https:';
const httpClient = isHttps ? https : http;
const API_HOST = parsedUrl.hostname;
const API_PORT = parsedUrl.port || (isHttps ? 443 : 3000);
const API_PATH_PREFIX = parsedUrl.pathname.replace(/\/$/, '');

async function makeRequest(buyerId) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ minScore: 50, limit: 50 });
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: `${API_PATH_PREFIX}/api/matches/buyer/${buyerId}/find`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = httpClient.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: body });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Get all buyers
  const getBuyers = () => new Promise((resolve, reject) => {
    httpClient.get(`${API_BASE_URL}/api/buyers`, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });

  const buyers = await getBuyers();
  console.log(`Found ${buyers.length} buyers. Generating matches...`);

  let totalMatches = 0;
  for (const buyer of buyers) {
    console.log(`\nProcessing: ${buyer.name} (${buyer.email})`);
    const matches = await makeRequest(buyer.id);
    
    if (matches.error) {
      console.log(`   Error: ${matches.error}`);
    } else if (Array.isArray(matches)) {
      console.log(`   Generated ${matches.length} matches`);
      totalMatches += matches.length;
    }
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }

  console.log(`\n Complete! Total matches generated: ${totalMatches}`);
}

main().catch(console.error);
