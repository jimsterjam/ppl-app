import { describe, test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderAll, planData, titleCase } from '../src/render.mjs'
import { PAGES, content, APP_STORE_URL } from '../src/content.mjs'
import { EXERCISE_DE } from '../src/exercise-de.mjs'
import { PLAN_TEMPLATES } from '../../client/src/utils/planTemplates.js'
import { estimateOneRepMax, weightForReps, buildTable, parseNumber, validate } from '../assets/calc.js'
import { estimateOneRepMax as appEstimate } from '../../server/utils/stagnationDiagnosis.js'
import { getProgressionStatus } from '../../client/src/utils/weightSuggestion.js'

const SITE = 'https://example.test'
const here = path.dirname(fileURLToPath(import.meta.url))
let files
before(() => { files = renderAll(SITE) })
const htmlFiles = () => [...files].filter(([file]) => file.endsWith('.html'))
const get = (file) => files.get(file)

describe('Rechner', () => {
  test('gleiche Formel wie die App (Raster aus Gewichten und Wiederholungen)', () => {
    for (const weight of [20, 42.5, 60, 82.5, 100, 140, 200]) {
      for (let reps = 1; reps <= 12; reps += 1) {
        assert.equal(estimateOneRepMax(weight, reps), appEstimate(weight, reps), `${weight} × ${reps}`)
      }
    }
  })
  test('Beispiel der Seite: 80 kg × 8 = 101,3 kg', () => {
    assert.equal(Math.round(estimateOneRepMax(80, 8) * 10) / 10, 101.3)
  })
  test('Tabelle: 12 Zeilen, 1 Wiederholung = 100 %, fallend, Rückrechnung stimmt', () => {
    const table = buildTable(101.33)
    assert.equal(table.length, 12)
    assert.equal(table[0].share, 1)
    for (let i = 1; i < table.length; i += 1) assert.ok(table[i].weight < table[i - 1].weight)
    assert.ok(Math.abs(estimateOneRepMax(table[7].weight, 8) - 101.33) < 1e-9)
    assert.equal(weightForReps(0, 5), 0)
  })
  test('Eingabe: Komma und Punkt, Grenzen', () => {
    assert.equal(parseNumber('82,5'), 82.5)
    assert.equal(parseNumber('82.5'), 82.5)
    assert.ok(Number.isNaN(parseNumber('abc')))
    assert.deepEqual(validate('80', '8'), { weight: 80, reps: 8 })
    for (const [w, r] of [['0', '8'], ['-5', '8'], ['80', '0'], ['80', '13'], ['80', '2,5'], ['', ''], ['1001', '5']]) assert.equal(validate(w, r), null, `${w}/${r}`)
  })
})

describe('Pläne stimmen mit den Vorlagen der App überein', () => {
  test('jede Übung hat einen deutschen Begriff und einen Katalogeintrag', () => {
    const ids = new Set()
    for (const template of Object.values(PLAN_TEMPLATES)) for (const day of template.days) for (const list of Object.values(day.levels)) for (const { id } of list) ids.add(id)
    assert.ok(ids.size >= 60)
    for (const id of ids) assert.ok(EXERCISE_DE[id], `deutscher Begriff fehlt für ${id}`)
    assert.deepEqual(Object.keys(EXERCISE_DE).filter((id) => !ids.has(id)), [], 'Eintrag ohne Verwendung')
  })
  for (const templateId of Object.keys(PLAN_TEMPLATES)) {
    test(`${templateId}: alle Tage, Übungen und Sätze stehen auf der Seite (DE und EN)`, () => {
      const days = planData(templateId)
      assert.equal(days.length, PLAN_TEMPLATES[templateId].days.length)
      for (const lang of ['de', 'en']) {
        const page = PAGES.find((p) => p.id === templateId)[lang]
        const html = get(`${page}index.html`)
        for (const day of days) for (const level of ['beginner', 'advanced']) for (const e of day.levels[level]) {
          assert.ok(html.includes(`>${e.en.replace(/&/g, '&amp;')}`) || html.includes(e.en), `${e.en} fehlt (${lang})`)
          if (lang === 'de') assert.ok(html.includes(e.de), `${e.de} fehlt`)
          assert.ok(e.sets >= 1)
        }
      }
    })
  }
  test('Englische Titel: Groß-/Kleinschreibung', () => {
    assert.equal(titleCase('bench press barbell'), 'Bench Press Barbell')
    assert.equal(titleCase('cable pushdown (with rope attachment)'), 'Cable Pushdown (with Rope Attachment)')
  })
})

describe('Seiten', () => {
  test('alle Seiten aus der Liste sind in beiden Sprachen vorhanden, dazu 404, Sitemap, robots', () => {
    for (const page of PAGES) for (const lang of ['de', 'en']) assert.ok(files.has(`${page[lang]}index.html`), page[lang])
    for (const f of ['/404.html', '/sitemap.xml', '/robots.txt']) assert.ok(files.has(f), f)
  })
  test('jede Seite: lang, Titel, Beschreibung, genau eine h1', () => {
    for (const [file, html] of htmlFiles()) {
      assert.match(html, /<html lang="(de|en)">/, file)
      const title = html.match(/<title>(.*?)<\/title>/s)?.[1] || ''
      assert.ok(title.length > 5 && title.length <= 80, `Titel ${file}: ${title.length}`)
      const desc = html.match(/<meta name="description" content="(.*?)">/s)?.[1] || ''
      assert.ok(desc.length > 10 && desc.length <= 170, `Beschreibung ${file}: ${desc.length}`)
      assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `h1 ${file}`)
    }
  })
  test('Sprachvarianten verweisen gegenseitig aufeinander (hreflang) und haben einen Canonical-Link', () => {
    for (const page of PAGES) {
      for (const lang of ['de', 'en']) {
        const html = get(`${page[lang]}index.html`)
        assert.ok(html.includes(`<link rel="canonical" href="${SITE}${page[lang]}">`), `canonical ${page[lang]}`)
        assert.ok(html.includes(`hreflang="de" href="${SITE}${page.de}"`) && html.includes(`hreflang="en" href="${SITE}${page.en}"`), `hreflang ${page[lang]}`)
        const other = lang === 'de' ? 'en' : 'de'
        assert.ok(html.includes(`href="${page[other]}" hreflang="${other}"`), `Umschalter ${page[lang]}`)
      }
    }
  })
  test('interne Links führen zu vorhandenen Seiten oder Dateien', () => {
    const distAssets = path.resolve(here, '../assets')
    for (const [file, html] of htmlFiles()) {
      for (const [, href] of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) {
        if (href.startsWith('/assets/')) { assert.ok(fs.existsSync(path.join(distAssets, href.slice('/assets/'.length))), `${file}: ${href}`); continue }
        const key = href.endsWith('/') ? `${href}index.html` : href
        assert.ok(files.has(key), `${file}: ${href}`)
      }
      // Anker (#faq): die Zielseite muss das Element mit dieser ID enthalten
      for (const [, target, anchor] of html.matchAll(/href="(\/[^"#?]*)#([^"]+)"/g)) {
        const targetHtml = files.get(target.endsWith('/') ? `${target}index.html` : target)
        assert.ok(targetHtml && targetHtml.includes(`id="${anchor}"`), `${file}: Anker ${target}#${anchor} fehlt`)
      }
      for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(html.includes(`id="${anchor}"`), `${file}: Anker #${anchor} fehlt`)
    }
  })
  test('keine fremden Ressourcen: nur der App-Store-Link und mailto zeigen nach außen', () => {
    for (const [file, html] of htmlFiles()) {
      for (const [, url] of html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)) {
        const allowed = url.startsWith(APP_STORE_URL) || url.startsWith(SITE)
        assert.ok(allowed, `${file}: ${url}`)
      }
      assert.ok(!/<script[^>]+src="https?:/.test(html), `${file}: Fremdskript`)
      assert.ok(!/<link[^>]+href="https?:\/\/(?!example\.test)/.test(html.replace(/rel="(canonical|alternate)"[^>]*/g, '')), `${file}: Fremd-Stylesheet`)
    }
  })
  test('Sitemap listet alle Seiten in beiden Sprachen', () => {
    const sitemap = get('/sitemap.xml')
    for (const page of PAGES) for (const lang of ['de', 'en']) assert.ok(sitemap.includes(`<loc>${SITE}${page[lang]}</loc>`), page[lang])
  })
})

describe('Texte', () => {
  const all = () => htmlFiles().map(([file, html]) => [file, html.replace(/<script[\s\S]*?<\/script>/g, '')])
  test('der Name ist überall "Form Beats Ego", nie "Form schlägt Ego"', () => { // repo-text-rules: erlaubt
    for (const [file, text] of all()) assert.ok(!/form schlägt ego/i.test(text), file) // repo-text-rules: erlaubt
    assert.ok(get('/index.html').includes('Form Beats Ego.'))
    assert.ok(get('/en/index.html').includes('Form Beats Ego.'))
  })
  test('keine Pro-/Monatsbericht-Aussagen und keine zu hohe Übungszahl', () => {
    for (const [file, text] of all()) {
      assert.ok(!/monatsbericht|monthly report/i.test(text), `${file}: Monatsbericht`)
      assert.ok(!/1\.200|1,200/.test(text), `${file}: Übungszahl`)
    }
    assert.ok(get('/index.html').includes('Über 1.100 Übungen'))
    assert.ok(get('/en/index.html').includes('Over 1,100 exercises'))
  })
  test('Store-Knöpfe zeigen auf die App mit Kampagnen-Kennung', () => {
    const html = get('/index.html')
    assert.ok(html.includes(`${APP_STORE_URL}?ct=web-home`))
    assert.ok(html.includes('name="apple-itunes-app" content="app-id=6808702632"'))
  })
  test('Gesundheitshinweis steht auf jeder Seite', () => {
    for (const [file, html] of htmlFiles()) {
      if (file === '/404.html') continue
      assert.ok(html.includes(file.startsWith('/en/') ? content.en.footer.note : content.de.footer.note), file)
    }
  })
  test('keine Cookies und keine Zähl-/Werbedienste', () => {
    for (const [file, html] of htmlFiles()) assert.ok(!/google-analytics|googletagmanager|facebook|doubleclick|document\.cookie/i.test(html), file)
  })
  test('Kontakt: support@formbeatsego.de auf Support, Impressum und Datenschutz, die alte Adresse nirgends', () => {
    for (const file of ['/support/index.html', '/impressum/index.html', '/datenschutz/index.html', '/en/support/index.html', '/en/legal-notice/index.html', '/en/privacy/index.html']) {
      assert.ok(get(file).includes('support@formbeatsego.de'), file)
    }
    for (const [file, html] of htmlFiles()) assert.ok(!/push-pull-legs\.de/.test(html), `${file}: alte Domain`)
  })
  test('Seitengröße: höchstens 120 KB HTML je Seite', () => {
    for (const [file, html] of htmlFiles()) assert.ok(Buffer.byteLength(html) < 120 * 1024, file)
  })
  test('Datenschutzseite: Anschrift des Verantwortlichen in Teil A und in Teil B; Hosting-Text ohne Protokoll-Behauptung', () => {
    for (const [file, lang] of [['/datenschutz/index.html', 'de'], ['/en/privacy/index.html', 'en']]) {
      const html = get(file)
      const partB = html.split(lang === 'de' ? 'Teil B: Die App fbe' : 'Part B: The fbe app')[1]
      assert.ok(partB.includes('<pre>') && partB.includes('Deutschland'), `${file}: Anschrift in Teil B`)
      assert.ok(!/Protokolldaten|log data/i.test(html.split(lang === 'de' ? 'Teil B' : 'Part B')[0]), `${file}: Protokoll-Behauptung`)
    }
  })
  test('Datenschutzseite enthält Website-Teil und App-Teil', () => {
    assert.match(get('/datenschutz/index.html'), /Teil A: Diese Website[\s\S]*Teil B: Die App fbe/)
    assert.match(get('/en/privacy/index.html'), /Part A: This website[\s\S]*Part B: The fbe app/)
  })
})

describe('Header-Marke', () => {
  test('jede Seite: drei Buchstaben-Spans in der fertigen Seite', () => {
    for (const [file, html] of htmlFiles()) {
      const brand = html.match(/<a class="brand"[^>]*>([\s\S]*?)<\/a>/)
      assert.ok(brand, `${file}: kein Header-Link .brand`)
      assert.match(
        brand[1],
        /^<span class="bm-f"[^>]*>f<\/span><span class="bm-b"[^>]*>b<\/span><span[^>]*>e<\/span>$/,
        file
      )
    }
  })
  test('weiß (#ffffff), nicht in der Akzentfarbe, ohne Kerning', () => {
    const css = fs.readFileSync(path.join(here, '../assets/style.css'), 'utf8')
    const rule = css.match(/(?:^|\n)\.brand \{[^}]*\}/)
    assert.ok(rule, 'CSS-Regel .brand fehlt')
    assert.match(rule[0], /color: var\(--mark\)/)
    assert.doesNotMatch(rule[0], /var\(--accent\)/)
    // --mark nur einmal definiert, und zwar in :root
    const defs = css.match(/--mark:[^;]*;/g) || []
    assert.deepEqual(defs, ['--mark: #ffffff;'])
    const root = css.match(/:root\s*\{[^}]*\}/)
    assert.ok(root, 'CSS-Regel :root fehlt')
    assert.match(root[0], /--mark: #ffffff;/)
    assert.match(rule[0], /font-kerning: none/)
  })
})

describe('Seite Push/Pull/Legs erklärt', () => {
  const catalog = JSON.parse(fs.readFileSync(path.resolve(here, '../../client/public/data/default-exercises.json'), 'utf8'))
  // Echter Katalogeintrag der Beispielübung, damit Einordnung und Steigerungsschritt wie in der App gelten
  const bench = catalog.find((e) => e._id === 'ex_0025')
  const session = (weight, repsList) => ({ setDetails: repsList.map((reps) => ({ weight, reps })) })
  const pplHref = { de: '/push-pull-legs/', en: '/en/push-pull-legs/' }
  test('verlinkt von Startseite, Plan-Übersicht und beiden PPL-Plänen (DE und EN)', () => {
    for (const lang of ['de', 'en']) {
      for (const id of ['home', 'plans', 'ppl3', 'ppl6']) {
        const html = get(`${PAGES.find((p) => p.id === id)[lang]}index.html`)
        assert.ok(html.includes(`<a href="${pplHref[lang]}">${content[lang].ppl.link} →</a>`), `${id} (${lang})`)
      }
    }
  })
  test('Gegenprobe: nicht im Hauptmenü und nicht auf den anderen Plänen', () => {
    for (const lang of ['de', 'en']) {
      for (const id of ['ul4', 'fb3']) {
        const html = get(`${PAGES.find((p) => p.id === id)[lang]}index.html`)
        assert.ok(!html.includes(`href="${pplHref[lang]}"`), `${id} (${lang})`)
      }
      for (const [file, html] of htmlFiles()) {
        const nav = html.match(/<nav class="main"[\s\S]*?<\/nav>/)?.[0] || ''
        assert.ok(!nav.includes('push-pull-legs/"'), `${file}: Hauptmenü`)
      }
    }
  })
  test('Beispielübungen: englischer Name, auf Deutsch mit deutschem Begriff in Klammern', () => {
    const de = get('/push-pull-legs/index.html')
    const en = get('/en/push-pull-legs/index.html')
    assert.ok(de.includes('Bench Press Barbell <span class="de-name">(Bankdrücken mit der Langhantel)</span>'))
    assert.ok(en.includes('Bench Press Barbell') && !en.includes('Bankdrücken'))
    for (const lang of ['de', 'en']) for (const [, , , ids] of content[lang].ppl.days) for (const id of ids) {
      assert.ok(EXERCISE_DE[id], `deutscher Begriff fehlt: ${id}`)
      assert.ok(catalog.some((e) => e._id === id), `nicht im Katalog: ${id}`)
    }
  })
  test('Steigerungs-Beispiel folgt der Logik der App (8–12, mehr Gewicht erst bei 12 in allen Sätzen, +2,5 kg)', () => {
    assert.ok(bench, 'ex_0025 fehlt im Katalog')
    for (const lang of ['de', 'en']) {
      const rows = content[lang].ppl.example.map(([, w, r]) => [Number(w.replace(',', '.').replace(' kg', '')), Number.parseInt(r, 10)])
      assert.equal(rows[0][1], 8, 'Start bei 8')
      for (let i = 0; i < rows.length - 1; i += 1) {
        const [weight, reps] = rows[i]
        const [nextWeight, nextReps] = rows[i + 1]
        const status = getProgressionStatus(bench, session(weight, [reps, reps, reps]), 'hypertrophy')
        if (nextWeight === weight) {
          assert.equal(status.state, 'climb', `${lang} Zeile ${i}`)
          assert.equal(status.nextReps, nextReps, `${lang} Zeile ${i}`)
        } else {
          assert.equal(reps, 12, 'Gewicht erst bei 12')
          assert.equal(status.state, 'increase', `${lang} Zeile ${i}`)
          assert.equal(status.suggestion.suggestedWeights[0], nextWeight, `${lang} Zeile ${i}`)
        }
      }
    }
  })
  test('Legs-Karte nennt Waden und hat eine Wadenübung; Hinweis auf das Ziel Kraft verlinkt die Seite Wiederholungen', () => {
    for (const lang of ['de', 'en']) {
      const legs = content[lang].ppl.days.find(([name]) => name === 'Legs')
      assert.ok(/Waden|calves/.test(legs[2]))
      assert.ok(legs[3].some((id) => /calf raise/i.test(catalog.find((e) => e._id === id).name_en)), `Wadenübung fehlt (${lang})`)
      const html = get(pplHref[lang] + 'index.html')
      assert.ok(html.includes(`${content[lang].ppl.progStrength} <a href="${PAGES.find((p) => p.id === 'reps')[lang]}">`), `Kraft-Hinweis (${lang})`)
    }
  })
  test('Text nennt den Steigerungsschritt der App (2,5 kg Langhantel, 2 kg Kurzhantel)', () => {
    const dumbbell = catalog.find((e) => e._id === 'ex_0405')
    const up = getProgressionStatus(dumbbell, session(20, [12, 12, 12]), 'hypertrophy')
    assert.equal(up.suggestion.suggestedWeights[0], 22)
    assert.ok(content.de.ppl.prog.join(' ').includes('2,5 kg, bei Kurzhanteln 2 kg'))
    assert.ok(content.en.ppl.prog.join(' ').includes('2.5 kg, or 2 kg on dumbbells'))
  })
  test('Gegenprobe: 12 nur in zwei von drei Sätzen bringt kein höheres Gewicht', () => {
    const status = getProgressionStatus(bench, session(60, [12, 12, 11]), 'hypertrophy')
    assert.equal(status.state, 'climb')
    assert.equal(status.suggestion, null)
  })
})

describe('Kopfzeile auf dem Handy (Hamburger-Menü)', () => {
  const css = () => fs.readFileSync(path.join(here, '../assets/style.css'), 'utf8')
  // Regeln als [Selektor, Inhalt], Kommentare entfernt, Leerraum vereinheitlicht
  const rules = () => [...css().replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, sel, body]) => [sel.replace(/\s+/g, ' ').trim(), body.replace(/\s+/g, ' ').replace(/\s*:\s*/g, ': ')])
  test('jede Seite: Menüknopf steuert das Menü, Beschriftung DE/EN, Skript mit Inhalts-Kennung eingebunden', () => {
    for (const [file, html] of htmlFiles()) {
      const t = content[file.startsWith('/en/') ? 'en' : 'de'].nav
      const btn = html.match(/<button class="menu-btn"[^>]*>/)?.[0]
      assert.ok(btn, `${file}: Menüknopf fehlt`)
      assert.ok(btn.includes('aria-expanded="false"') && btn.includes('aria-controls="site-menu"'), file)
      assert.ok(btn.includes(`aria-label="${t.open}"`) && btn.includes(`data-label-close="${t.close}"`), `${file}: Beschriftung`)
      assert.ok(html.includes('<div class="menu" id="site-menu">'), `${file}: Menü-Ziel fehlt`)
      assert.match(html, /<script type="module" src="\/assets\/menu\.js\?v=[0-9a-f]{10}"><\/script>/, `${file}: menu.js`)
      assert.match(html, /<link rel="stylesheet" href="\/assets\/style\.css\?v=[0-9a-f]{10}">/, `${file}: style.css`)
    }
  })
  test('Gegenprobe: Sprachwahl liegt NICHT im zuklappbaren Menü (immer sichtbar)', () => {
    for (const [file, html] of htmlFiles()) {
      const menu = html.match(/<div class="menu" id="site-menu">([\s\S]*?)<\/div>\n/)?.[1] || ''
      assert.ok(menu.includes('<nav class="main"'), `${file}: Navigation im Menü`)
      assert.ok(!menu.includes('class="lang"'), `${file}: Sprachwahl im Menü`)
      assert.ok(html.includes('<div class="lang" role="group"'), `${file}: Sprachwahl fehlt`)
    }
  })
  test('Gegenprobe ohne JavaScript bzw. ohne menu.js: das Menü wird nur unter html.js versteckt, und "js" fällt weg, wenn menu.js nicht läuft', () => {
    const hiding = rules().filter(([sel, body]) => /\.menu(?![-\w])/.test(sel) && /display: none|visibility: hidden|max-height: 0|height: 0/.test(body))
    assert.ok(hiding.length > 0)
    for (const [sel] of hiding) for (const part of sel.split(',')) assert.ok(part.trim().startsWith('html.js '), `"${part.trim()}" versteckt das Menü auch ohne JavaScript`)
    // Ohne html.js darf die Kopfzeile auf dem Handy nicht am Umbrechen gehindert werden (sonst quetscht sich die Navigation)
    for (const [sel, body] of rules()) if (/nowrap/.test(body) && /\.bar/.test(sel)) assert.ok(sel.startsWith('html.js '), sel)
    const html = get('/index.html')
    assert.ok(html.includes("classList.contains('menu-ready'))h.classList.remove('js')"), 'Rückfall, wenn menu.js nicht läuft')
    assert.ok(fs.readFileSync(path.join(here, '../assets/menu.js'), 'utf8').includes("classList.add('menu-ready')"))
  })
  test('Regression 12.11.: Regeln für .shots-hero stehen nach .shots (sonst überschreibt .shots Wischleiste und Abstand)', () => {
    const all = rules()
    const base = all.findIndex(([sel]) => sel === '.shots')
    assert.ok(base >= 0)
    const hero = all.map(([sel], i) => [sel, i]).filter(([sel]) => /\.shots-hero/.test(sel))
    assert.ok(hero.length >= 3)
    for (const [sel, i] of hero) assert.ok(i > base, `"${sel}" steht vor .shots`)
    assert.ok(all.some(([sel, body]) => sel === '.shots-hero' && /display: flex/.test(body)), 'Wischleiste auf dem Handy')
    assert.ok(all.some(([sel, body]) => sel === '.shots-hero' && /grid-template-columns: repeat\(2, 1fr\)/.test(body)), '2 × 2 auf dem iPad')
  })
})
