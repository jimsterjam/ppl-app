#!/usr/bin/env node
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import url from 'url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const cfgPath = path.resolve(__dirname, '..', 'capacitor.config.json')

function detectLanIp() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

async function readConfig() {
  const raw = await fs.readFile(cfgPath, 'utf8')
  return JSON.parse(raw)
}
async function writeConfig(cfg) {
  const json = JSON.stringify(cfg, null, 2) + '\n'
  await fs.writeFile(cfgPath, json, 'utf8')
}

async function main() {
  const [,, action, modeOrUrl] = process.argv
  const cfg = await readConfig()
  cfg.server = cfg.server || {}

  if (action === 'enable') {
    let urlValue = process.env.CAP_SERVER_URL
    const port = process.env.CAP_SERVER_PORT || '5173'
    if (!urlValue) {
      if (modeOrUrl === 'auto') {
        const ip = detectLanIp()
        urlValue = `http://${ip}:${port}`
      } else if (modeOrUrl && /^https?:\/\//.test(modeOrUrl)) {
        urlValue = modeOrUrl
      } else {
        console.error('Bitte CAP_SERVER_URL setzen oder "auto" verwenden.')
        process.exit(1)
      }
    }
    cfg.server.url = urlValue
    cfg.server.cleartext = /^http:\/\//.test(urlValue)
    console.log(`[Cap Server] Aktiviert: ${cfg.server.url} (cleartext=${cfg.server.cleartext})`)
    await writeConfig(cfg)
    return
  }

  if (action === 'disable') {
    if (cfg.server) {
      delete cfg.server.url
      delete cfg.server.cleartext
    }
    console.log('[Cap Server] Deaktiviert (bundled/dist)')
    await writeConfig(cfg)
    return
  }

  console.log('Usage: node scripts/toggle-cap-server.mjs <enable auto|enable <url>|disable>')
  process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
