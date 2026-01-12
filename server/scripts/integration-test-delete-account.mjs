#!/usr/bin/env node
// Simple integration script to call the account delete endpoint.
// Usage:
//  BASE_URL=http://localhost:3001 TOKEN=<ID_TOKEN> node integration-test-delete-account.mjs

let fetchImpl = globalThis.fetch;
try {
  if (!fetchImpl) {
    const mod = await import('node-fetch');
    fetchImpl = mod.default || mod;
  }
} catch (e) {
  // If node-fetch isn't installed, rely on global fetch (Node 18+)
  fetchImpl = globalThis.fetch;
}

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error('Set TOKEN env (Firebase ID token)');
  process.exit(1);
}

(async () => {
  try {
    const res = await fetchImpl(`${BASE}/api/account/delete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ confirmation: 'ACCOUNT LÖSCHEN' })
    });
    const json = await res.json();
    console.log('Status:', res.status);
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.error('Request failed:', e);
    process.exit(2);
  }
})();
