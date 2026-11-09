// Erzeugt die Website in site/dist. Nutzung: SITE_URL=https://deine-adresse.de node site/build.mjs
// Ohne SITE_URL entsteht eine lokale Vorschau (http://localhost:4173) - dann dürfen die Seiten nicht veröffentlicht werden.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderAll } from './src/render.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(here, 'dist')
const siteUrl = (process.env.SITE_URL || 'http://localhost:4173').replace(/\/$/, '')
if (!process.env.SITE_URL) console.warn('Hinweis: SITE_URL fehlt, lokale Vorschau. Für die Veröffentlichung SITE_URL setzen.')
if (process.env.CI && !process.env.SITE_URL) throw new Error('SITE_URL muss in der Build-Umgebung gesetzt sein')

fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })
for (const [file, content] of renderAll(siteUrl)) {
  const target = path.join(dist, file)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}
fs.cpSync(path.join(here, 'assets'), path.join(dist, 'assets'), { recursive: true })
console.log(`Website erzeugt: ${dist} (${siteUrl})`)
