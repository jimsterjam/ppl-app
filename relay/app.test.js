import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createApp } from './app.js'

// Tests laufen komplett OHNE echten OpenAI-Key und OHNE echten Netzwerkzugriff auf OpenAI -
// openaiBaseUrl zeigt auf einen lokalen Mock-HTTP-Server (siehe startMockUpstream), damit die
// Relay-Logik selbst (Auth, Allowlist, Weiterleitung) isoliert geprüft werden kann.

const DUMMY_KEY = 'sk-test-dummy-key-not-real'
const SECRET = 'a'.repeat(32)

function startMockUpstream() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ receivedPath: req.url, receivedAuth: req.headers.authorization, echoedBody: body ? JSON.parse(body) : null }))
      })
    })
    server.listen(0, () => resolve(server))
  })
}

async function withMockUpstream(fn) {
  const server = await startMockUpstream()
  const { port } = server.address()
  try {
    await fn(`http://127.0.0.1:${port}`)
  } finally {
    server.close()
  }
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server))
  })
}

async function request(server, { method = 'GET', path, headers = {}, body } = {}) {
  const { port } = server.address()
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* ignore */ }
  return { status: res.status, json, text }
}

describe('relay/app.js', () => {
  test('GET /healthz benötigt kein Secret', async () => {
    const app = createApp({ openaiApiKey: DUMMY_KEY, relaySharedSecret: SECRET })
    const server = await listen(app)
    try {
      const res = await request(server, { path: '/healthz' })
      assert.equal(res.status, 200)
      assert.equal(res.json.status, 'ok')
    } finally {
      server.close()
    }
  })

  test('Anfrage ohne Authorization-Header wird mit 401 abgelehnt', async () => {
    const app = createApp({ openaiApiKey: DUMMY_KEY, relaySharedSecret: SECRET })
    const server = await listen(app)
    try {
      const res = await request(server, { method: 'POST', path: '/chat/completions', body: {} })
      assert.equal(res.status, 401)
    } finally {
      server.close()
    }
  })

  test('Anfrage mit falschem Secret wird mit 401 abgelehnt', async () => {
    const app = createApp({ openaiApiKey: DUMMY_KEY, relaySharedSecret: SECRET })
    const server = await listen(app)
    try {
      const res = await request(server, {
        method: 'POST',
        path: '/chat/completions',
        headers: { Authorization: 'Bearer falsches-secret', 'Content-Type': 'application/json' },
        body: {}
      })
      assert.equal(res.status, 401)
    } finally {
      server.close()
    }
  })

  test('Pfad außerhalb der Allowlist wird trotz korrektem Secret mit 404 abgelehnt', async () => {
    const app = createApp({ openaiApiKey: DUMMY_KEY, relaySharedSecret: SECRET })
    const server = await listen(app)
    try {
      const res = await request(server, {
        method: 'GET',
        path: '/embeddings',
        headers: { Authorization: `Bearer ${SECRET}` }
      })
      assert.equal(res.status, 404)
    } finally {
      server.close()
    }
  })

  test('gültige Anfrage an /chat/completions wird mit echtem Key an Upstream weitergeleitet', async () => {
    await withMockUpstream(async (mockUpstreamUrl) => {
      const app = createApp({
        openaiApiKey: DUMMY_KEY,
        relaySharedSecret: SECRET,
        openaiBaseUrl: mockUpstreamUrl
      })
      const server = await listen(app)
      try {
        const res = await request(server, {
          method: 'POST',
          path: '/chat/completions',
          headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
          body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] }
        })
        assert.equal(res.status, 200)
        assert.equal(res.json.receivedPath, '/chat/completions')
        assert.equal(res.json.receivedAuth, `Bearer ${DUMMY_KEY}`)
        assert.deepEqual(res.json.echoedBody.messages, [{ role: 'user', content: 'hi' }])
      } finally {
        server.close()
      }
    })
  })

  test('GET /models (Health-Check-Pfad des SDK) ist erlaubt', async () => {
    await withMockUpstream(async (mockUpstreamUrl) => {
      const app = createApp({
        openaiApiKey: DUMMY_KEY,
        relaySharedSecret: SECRET,
        openaiBaseUrl: mockUpstreamUrl
      })
      const server = await listen(app)
      try {
        const res = await request(server, {
          method: 'GET',
          path: '/models',
          headers: { Authorization: `Bearer ${SECRET}` }
        })
        assert.equal(res.status, 200)
        assert.equal(res.json.receivedPath, '/models')
      } finally {
        server.close()
      }
    })
  })
})
