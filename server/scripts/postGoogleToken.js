#!/usr/bin/env node
// Sends idToken or serverAuthCode (from env) to the server endpoint for easy testing
import fetch from 'node-fetch'

const API_BASE = process.env.API_BASE || process.env.VITE_API_BASE || 'http://localhost:3001'
const endpoint = `${API_BASE.replace(/\/$/, '')}/api/auth/google-native`

const idToken = process.env.IDTOKEN || process.env.ID_TOKEN || null
const serverAuthCode = process.env.SERVER_AUTH_CODE || process.env.SERVERAUTHCODE || null
const email = process.env.GOOGLE_EMAIL || process.env.EMAIL || ''
const googleId = process.env.GOOGLE_ID || process.env.GOOGLEID || ''

if (!idToken && !serverAuthCode) {
  console.error('Provide either IDTOKEN or SERVER_AUTH_CODE as env vars')
  console.error('Example: IDTOKEN=... node scripts/postGoogleToken.js')
  process.exit(2)
}

const body = { email, googleId }
if (idToken) body.idToken = idToken
if (serverAuthCode) body.serverAuthCode = serverAuthCode

console.log('POST', endpoint)
console.log('body keys:', Object.keys(body))

;(async () => {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const text = await res.text()
    console.log('HTTP', res.status)
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2))
    } catch (e) {
      console.log(text)
    }
  } catch (e) {
    console.error('Request failed:', e?.message || e)
    process.exit(1)
  }
})()
