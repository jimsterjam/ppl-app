#!/usr/bin/env node
// UI-Prüfung der Workout-Ansicht (docs/UI-CHECKLISTE.md): Dunkel/Hell × Akzentfarben × Sprachen × Breiten.
// Prüft automatisch: horizontaler Überlauf, Knöpfe/Chips mit überlaufendem Text, Textkontrast (WCAG 4,5:1)
// und legt Screenshots ab. Ändert nichts im Repository (temporäre Dateien in client/ werden wieder gelöscht).
//
//   node scripts/ui-check/ui-check.mjs            # volle Matrix
//   node scripts/ui-check/ui-check.mjs --quick    # dunkel/hell × lime × de/en × 390 px
//
// Voraussetzungen: Playwright (global oder im Projekt) und ein Chromium. Es wird KEINE Abhängigkeit hinzugefügt:
//   PLAYWRIGHT_MODULE   Pfad zu playwright/index.mjs (Standard: import 'playwright')
//   PLAYWRIGHT_CHROMIUM Pfad zur Chromium-Datei (Standard: /opt/pw-browsers/chromium)
//   UI_CHECK_OUT        Ausgabeordner für Screenshots (Standard: ./ui-check-out im Temp-Ordner)
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const client = resolve(here, '../../client')
const stub = resolve(here, 'firebase-stub.js')
const quick = process.argv.includes('--quick')
const port = 5197
const out = process.env.UI_CHECK_OUT || join(tmpdir(), 'ui-check-out')
mkdirSync(out, { recursive: true })

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')

const tmpFiles = ['ui-check-tmp.html', 'ui-check-tmp.js', 'ui-check-tmp.vite.mjs'].map((f) => join(client, f))
const cleanup = () => tmpFiles.forEach((f) => { try { rmSync(f, { force: true }) } catch {} })
process.on('exit', cleanup)

writeFileSync(tmpFiles[0], '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/ui-check-tmp.js"></script></body></html>')
// Testdaten: lange Übungsnamen, Aufwärmsatz, Zeitübung (Messart "time") - typische Problemfälle.
writeFileSync(tmpFiles[1], `
import { createApp, h } from 'vue'
import './src/style.css'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { createI18nInstance } from './src/i18n'
import WorkoutDetailView from './src/views/WorkoutDetailView.vue'
import { db } from './src/utils/offlineStorage'
const q = new URLSearchParams(location.search)
document.documentElement.setAttribute('data-theme', q.get('theme') || 'dark')
document.documentElement.setAttribute('data-accent', q.get('accent') || 'lime')
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/workouts/:id', name: 'workout-detail', component: WorkoutDetailView },
  { path: '/:p(.*)*', component: { render: () => h('div', 'x') } } ] })
const app = createApp({ render: () => h(RouterView) })
app.use(createPinia()).use(router).use(createI18nInstance())
const sets = (n) => Array.from({ length: n }, () => ({ reps: 10, weight: 60, restTime: 90, isWarmup: false }))
await db.workouts.put({ _id: 'draft-1', type: 'push', name: 'UI Check', date: new Date().toISOString(), completed: false, isDraft: true, goal: 'muscle',
  exercises: [
    { _id: 'q0', name: 'Dumbbell Incline One Arm Hammer Press On Exercise Ball', sets: 3, reps: 10, weight: 0, note: '', setDetails: [{ reps: 10, weight: 30, isWarmup: true, restTime: 60 }, ...sets(3)] },
    { _id: 'q1', name: 'Bench Press Barbell', sets: 3, reps: 10, weight: 0, note: '', setDetails: sets(3) },
    { _id: 'q2', name: 'Plank', measureMode: 'time', sets: 2, reps: 1, weight: 0, note: '', setDetails: [{ durationSeconds: 60, restTime: 60, isWarmup: false }, { durationSeconds: 60, restTime: 60, isWarmup: false }] }
  ] })
await router.push('/workouts/draft-1')
app.mount('#app')
`)
writeFileSync(tmpFiles[2], `
import base from ${JSON.stringify(join(client, 'vite.config.js'))}
import { mergeConfig } from 'vite'
export default mergeConfig(typeof base === 'function' ? base({ mode: 'development', command: 'serve' }) : base, {
  root: ${JSON.stringify(client)},
  resolve: { alias: [{ find: /^(@\\/utils\\/|\\.\\.?\\/(utils\\/)?)firebaseAuth$/, replacement: ${JSON.stringify(stub)} }] },
  server: { fs: { strict: false }, port: ${port}, strictPort: true }
})
`)

const vite = spawn('npx', ['vite', '--config', tmpFiles[2]], { cwd: client, stdio: 'ignore' })
const stopVite = () => { try { vite.kill() } catch {} }
process.on('exit', stopVite)
await new Promise((r) => setTimeout(r, 7000))

const themes = quick ? ['dark', 'light'] : ['dark', 'light']
const accents = quick ? ['lime'] : ['lime', 'ocean', 'violet', 'sunset']
const locales = ['de-DE', 'en-US']
const widths = quick ? [390] : [340, 360, 390]

const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
const browser = await chromium.launch({ executablePath: existsSync(chromiumPath) ? chromiumPath : undefined })
let problems = 0
for (const theme of themes) for (const accent of accents) for (const locale of locales) for (const width of widths) {
  const ctx = await browser.newContext({ viewport: { width, height: 1700 }, locale })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${port}/ui-check-tmp.html?theme=${theme}&accent=${accent}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  const res = await page.evaluate(() => {
    const parse = (s) => { let m = s.match(/rgba?\(([^)]+)\)/); if (m) { const a = m[1].split(/[ ,/]+/).map(Number); return [a[0], a[1], a[2], a[3] ?? 1] }
      m = s.match(/color\(srgb ([^)]+)\)/); if (m) { const a = m[1].split(/[ /]+/).map(Number); return [a[0] * 255, a[1] * 255, a[2] * 255, a[3] ?? 1] } return [0, 0, 0, 0] }
    const blend = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3]))
    const bgOf = (el) => { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] >= 1) break }
      let base = parse(getComputedStyle(document.body).backgroundColor).slice(0, 3); if (!base[0] && !base[1] && !base[2] && base.length < 3) base = [255, 255, 255]
      for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base); return base }
    const text = []; const overflow = []
    const list = document.querySelector('.ex-list')?.getBoundingClientRect()
    document.querySelectorAll('.workout-detail *').forEach((el) => {
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ')
      const r = el.getBoundingClientRect(); if (!own || !r.width || !r.height) return
      const cs = getComputedStyle(el)
      // Verlauf/Bild-Hintergründe und Pop-ups (Start-Knopf, Overlays) werden nicht gemessen.
      if (cs.backgroundImage !== 'none' || el.closest('.focus-start-btn, .rest-bar, .fm-mini')) return
      const bg = bgOf(el); const fg = parse(cs.color); const op = parseFloat(cs.opacity) || 1
      text.push({ t: own.slice(0, 28), fg: blend([fg[0], fg[1], fg[2], fg[3] * op], bg), bg, cls: String(el.className).slice(0, 30) })
    })
    document.querySelectorAll('.ex-list-actions > button, .ex-bottom-actions button, .training-type-chip, .ex-meta-row *, .warmup-timer-row *').forEach((e) => {
      const b = e.getBoundingClientRect(); if (!b.width) return
      if (e.scrollWidth > e.clientWidth + 1 || (list && (b.right > list.right + 1 || b.left < list.left - 1))) overflow.push((e.textContent || '').trim().slice(0, 24))
    })
    return { text, overflow, scrollWidth: document.documentElement.scrollWidth }
  })
  const bad = res.text.filter((o) => { const a = lum(o.fg), b = lum(o.bg); o.ratio = +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2); return o.ratio < 4.5 })
  const label = `${theme}/${accent}/${locale}/${width}px`
  const issues = []
  if (res.scrollWidth > width) issues.push(`horizontaler Überlauf (${res.scrollWidth} > ${width})`)
  if (res.overflow.length) issues.push(`Text/Knopf ragt heraus: ${[...new Set(res.overflow)].join(', ')}`)
  if (bad.length) issues.push(`Kontrast < 4,5: ${bad.slice(0, 4).map((o) => `"${o.t}" ${o.ratio}`).join('; ')}`)
  if (issues.length) { problems += 1; console.log(`FEHLER  ${label}: ${issues.join(' | ')}`) } else console.log(`OK      ${label}`)
  await page.screenshot({ path: join(out, `${theme}-${accent}-${locale}-${width}.png`) })
  await ctx.close()
}
await browser.close()
console.log(`\nScreenshots: ${out}`)
console.log(problems ? `${problems} Kombination(en) mit Funden.` : 'Alle Kombinationen ohne Funde.')
process.exit(problems ? 1 : 0)
