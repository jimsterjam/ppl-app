// Erzeugt alle Seiten als HTML-Text. Keine Abhängigkeiten, keine Skripte von Dritten, keine Cookies.
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { content, PAGES, APP_STORE_URL, APP_ID } from './content.mjs'
import { EXERCISE_DE } from './exercise-de.mjs'
import { PLAN_TEMPLATES } from '../../client/src/utils/planTemplates.js'
import { messages } from '../../client/src/i18n/index.js'
import { LEGAL_OWNER, legalAddressLines } from '../../client/src/config/legalOwner.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(fs.readFileSync(path.resolve(here, '../../client/public/data/default-exercises.json'), 'utf8'))
const byId = new Map(catalog.map((entry) => [entry._id, entry]))

// Eigene Dateien mit Inhalts-Kennung (?v=), damit nach einem Deploy keine alte style.css zu neuem HTML passt
const assetVersions = new Map()
export function asset(name) {
  if (!assetVersions.has(name)) {
    const data = fs.readFileSync(path.resolve(here, '../assets', name))
    assetVersions.set(name, createHash('sha256').update(data).digest('hex').slice(0, 10))
  }
  return `/assets/${name}?v=${assetVersions.get(name)}`
}

export const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const paragraphs = (text) => String(text).split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join('\n')
const SMALL_WORDS = new Set(['with', 'of', 'to', 'and', 'on', 'v.'])
export function titleCase(text) {
  return String(text).split(' ').map((word, i) => {
    if (i > 0 && SMALL_WORDS.has(word.replace(/^\(/, ''))) return word
    return word.replace(/^([("]?)([a-zäöü])/i, (_m, pre, ch) => pre + ch.toUpperCase())
  }).join(' ')
}

export function pageById(id) {
  return PAGES.find((page) => page.id === id)
}
export const urlFor = (id, lang) => pageById(id)[lang]
export const absolute = (siteUrl, pathName) => `${siteUrl.replace(/\/$/, '')}${pathName}`

function storeLink(id) {
  return `${APP_STORE_URL}?ct=web-${id}`
}

function storeButton(t, id) {
  return `<a class="btn" href="${esc(storeLink(id))}" aria-label="${esc(t.cta.storeAria)}" rel="noopener">${esc(t.cta.store)}</a>`
}

function layout({ lang, pageId, title, description, body, siteUrl, extraHead = '', noindex = false }) {
  const t = content[lang]
  const other = lang === 'de' ? 'en' : 'de'
  const page = pageById(pageId)
  const hasAlternate = Boolean(page)
  const canonical = page ? absolute(siteUrl, page[lang]) : ''
  const nav = (id, label) => {
    const href = urlFor(id, lang)
    const current = pageId === id ? ' aria-current="page"' : ''
    return `<a href="${href}"${current}>${esc(label)}</a>`
  }
  const langSwitch = hasAlternate
    ? `<span aria-current="true">${lang.toUpperCase()}</span><a href="${page[other]}" hreflang="${other}" lang="${other}" aria-label="${esc(content[other].langName)}">${other.toUpperCase()}</a>`
    : `<span aria-current="true">${lang.toUpperCase()}</span>`
  const orderedLangs = lang === 'de' ? langSwitch : `<a href="${page ? page.de : '/'}" hreflang="de" lang="de" aria-label="Deutsch">DE</a><span aria-current="true">EN</span>`
  const alternates = hasAlternate
    ? `<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="de" href="${esc(absolute(siteUrl, page.de))}">
<link rel="alternate" hreflang="en" href="${esc(absolute(siteUrl, page.en))}">
<link rel="alternate" hreflang="x-default" href="${esc(absolute(siteUrl, page.de))}">`
    : ''
  const og = hasAlternate
    ? `<meta property="og:type" content="website">
<meta property="og:site_name" content="fbe – Form Beats Ego">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${lang === 'de' ? 'de_DE' : 'en_US'}">
<meta property="og:image" content="${esc(absolute(siteUrl, '/assets/og.png'))}">
<meta name="twitter:card" content="summary_large_image">`
    : ''
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
${alternates}
${og}
<meta name="apple-itunes-app" content="app-id=${APP_ID}">
<meta name="theme-color" content="#0d0f12">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/Comfortaa-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${asset('style.css')}">
<script>document.documentElement.classList.add('js');addEventListener('load',()=>{const h=document.documentElement;if(!h.classList.contains('menu-ready'))h.classList.remove('js')})</script>
<script type="module" src="${asset('menu.js')}"></script>
${extraHead}
</head>
<body>
<a class="skip" href="#inhalt">${esc(t.footer.skip)}</a>
<header class="site"><div class="wrap bar">
<a class="brand" href="${urlFor('home', lang)}" aria-label="${esc(t.nav.home)}"><span class="bm-f" aria-hidden="true">f</span><span class="bm-b" aria-hidden="true">b</span><span aria-hidden="true">e</span></a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="${esc(t.nav.open)}" data-label-open="${esc(t.nav.open)}" data-label-close="${esc(t.nav.close)}"><span></span><span></span><span></span></button>
<div class="menu" id="site-menu">
<nav class="main" aria-label="${esc(t.nav.menu)}">${nav('rm', t.nav.rm)}${nav('reps', t.nav.reps)}${nav('plans', t.nav.plans)}${nav('support', t.nav.support)}</nav>
</div>
<div class="lang" role="group" aria-label="${esc(t.footer.language)}">${lang === 'de' ? langSwitch : orderedLangs}</div>
</div></header>
<main id="inhalt"><div class="wrap">
${body}
</div></main>
<footer class="site"><div class="wrap">
<nav aria-label="${esc(t.footer.legal)}"><a href="${urlFor('impressum', lang)}">${esc(t.footer.legal)}</a><a href="${urlFor('datenschutz', lang)}">${esc(t.footer.privacy)}</a><a href="${urlFor('support', lang)}">${esc(t.footer.support)}</a></nav>
<p>${esc(t.footer.note)}</p>
<p>${esc(t.footer.copyright)}</p>
</div></footer>
</body>
</html>
`
}

const faqHtml = (faq) => faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')

function appBlock(t, id, title, text) {
  return `<section class="callout"><h2>${esc(title)}</h2><p>${esc(text)}</p>${storeButton(t, id)}</section>`
}

export function renderHome(lang, siteUrl) {
  const t = content[lang]
  const h = t.home
  const shots = (lang === 'de' ? ['01', '02', '04', '05'] : ['01', '02', '03', '04'])
    .map((n, i) => `<img src="/assets/img/${lang}-${n}.webp" alt="${esc(h.shotsAlt[i])}" width="540" height="1173" loading="${i < 2 ? 'eager' : 'lazy'}">`).join('')
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'MobileApplication', name: 'fbe – Form Beats Ego',
    operatingSystem: 'iOS', applicationCategory: 'HealthApplication', url: absolute(siteUrl, urlFor('home', lang)),
    downloadUrl: APP_STORE_URL, inLanguage: ['de', 'en'], offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' }
  })
  const body = `
<div class="hero">
<div>
<h1>${esc(h.h1)}</h1>
<p class="lead">${esc(h.lead)}</p>
${storeButton(t, 'home')}
<p class="small">${esc(t.cta.small)}</p>
</div>
</div>
<div class="shots shots-hero" role="region" tabindex="0" aria-label="${esc(h.shotsLabel)}">${shots}</div>
<section><h2>${esc(h.whatTitle)}</h2><div class="cards">${h.what.map(([a, b, link]) => `<div class="card"><h3>${esc(a)}</h3><p>${esc(b)}</p>${link ? `<p class="small"><a href="${urlFor(link, lang)}">${esc(t[link].link)} →</a></p>` : ''}</div>`).join('')}</div></section>
<section class="callout"><h2>${esc(h.honestTitle)}</h2><p>${esc(h.honest)}</p></section>
<section><h2>${esc(h.moreTitle)}</h2><ul class="ticks">${h.more.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></section>
<section class="callout"><h2>${esc(h.freeTitle)}</h2><p>${esc(h.free)}</p>${storeButton(t, 'home-free')}</section>
<section><h2>${esc(h.toolsTitle)}</h2><div class="cards">${h.tools.map(([id, name, text]) => `<a class="card" href="${urlFor(id, lang)}"><h3>${esc(name)}</h3><p>${esc(text)}</p></a>`).join('')}</div></section>
<section id="faq"><h2>${esc(h.faqTitle)}</h2>${faqHtml(h.faq)}</section>`
  return layout({ lang, pageId: 'home', title: h.title, description: h.description, siteUrl, body, extraHead: `<script type="application/ld+json">${jsonLd}</script>` })
}

export function renderRm(lang, siteUrl) {
  const t = content[lang]
  const r = t.rm
  const num = lang === 'de' ? '101,3' : '101.3'
  const body = `
<h1>${esc(r.h1)}</h1>
<p class="lead">${esc(r.intro)}</p>
<form class="calc" id="rm-form" novalidate>
<label>${esc(r.weight)}<input type="text" inputmode="decimal" name="weight" autocomplete="off" required></label>
<label>${esc(r.reps)}<input type="text" inputmode="numeric" name="reps" autocomplete="off" required></label>
<button class="btn" type="submit">${esc(r.button)}</button>
</form>
<p class="err" id="rm-error" role="alert" hidden>${esc(r.error)}</p>
<div class="result" id="rm-result" hidden aria-live="polite">
<p class="muted">${esc(r.result)}</p><p class="big" id="rm-value"></p>
<h2>${esc(r.tableTitle)}</h2>
<div class="tablewrap"><table><thead><tr>${r.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody id="rm-table-body"></tbody></table></div>
</div>
<noscript><p class="err">${lang === 'de' ? 'Für den Rechner wird JavaScript benötigt.' : 'The calculator needs JavaScript.'}</p></noscript>
<section><h2>${esc(r.howTitle)}</h2><p>${esc(r.how)}</p><p>${esc(r.example.replace('101,3', num).replace('101.3', num))}</p></section>
<section><h2>${esc(r.goodTitle)}</h2><ul class="ticks">${r.good.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></section>
<section><h2>${esc(r.useTitle)}</h2><p>${esc(r.use)} <a href="${urlFor('reps', lang)}">${esc(r.useLink)}</a>.</p></section>
${appBlock(t, 'rm', r.appTitle, r.app)}`
  return layout({ lang, pageId: 'rm', title: r.title, description: r.description, siteUrl, body, extraHead: `<script type="module" src="${asset('calc.js')}"></script>` })
}

export function renderReps(lang, siteUrl) {
  const t = content[lang]
  const r = t.reps
  const body = `
<h1>${esc(r.h1)}</h1>
<section><h2>${esc(r.shortTitle)}</h2><ul class="ticks">${r.short.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<div class="tablewrap"><table><thead><tr>${r.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.rows.map((row) => `<tr>${row.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>
<p class="small">${esc(r.tableNote)}</p></section>
<section><h2>${esc(r.meanTitle)}</h2>${r.mean.map((m) => `<p>${esc(m)}</p>`).join('')}</section>
<section><h2>${esc(r.mixTitle)}</h2><p>${esc(r.mix)}</p></section>
<section><h2>${esc(r.useTitle)}</h2><ol>${r.use.map((u) => `<li>${esc(u).replace(/(1RM-Rechner|1RM calculator)/, `<a href="${urlFor('rm', lang)}">$1</a>`)}</li>`).join('')}</ol></section>
${appBlock(t, 'reps', r.appTitle, r.app)}`
  return layout({ lang, pageId: 'reps', title: r.title, description: r.description, siteUrl, body })
}

// Plan-Seiten mit Link zur Erklärseite: dieselben Pläne, die die Erklärseite unter „So fängst du an“ nennt
const PPL_PLANS = new Set(content.de.ppl.start.map(([id]) => id))
const pplLink = (t, lang) => `<p><a href="${urlFor('ppl', lang)}">${esc(t.ppl.link)} →</a></p>`

/** Beispielübung: englischer Name aus dem Katalog, auf Deutsch mit deutschem Begriff in Klammern. */
function exerciseLabel(id, lang) {
  const entry = byId.get(id)
  if (!entry || !EXERCISE_DE[id]) throw new Error(`Beispielübung ${id}: fehlt im Katalog oder in exercise-de.mjs`)
  const en = esc(titleCase(entry.name_en))
  return lang === 'de' ? `${en} <span class="de-name">(${esc(EXERCISE_DE[id])})</span>` : en
}

export function renderPpl(lang, siteUrl) {
  const t = content[lang]
  const x = t.ppl
  const planName = (id) => messages[lang].plans.templates[id].name
  const table = (cols, rows) => `<div class="tablewrap"><table><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`
  // Karten statt Tabelle: drei Spalten mit langen Übungsnamen passen auf dem Handy nicht nebeneinander
  const dayCards = x.days.map(([name, local, muscles, ids]) => `<div class="card"><h3>${esc(name)}${local ? ` <span class="de-name">(${esc(local)})</span>` : ''}</h3><p>${esc(muscles)}</p><ul class="ticks">${ids.map((id) => `<li>${exerciseLabel(id, lang)}</li>`).join('')}</ul></div>`).join('')
  const exampleRows = x.example.map(([week, weight, reps]) => `<tr><th scope="row">${esc(week)}</th><td>${esc(weight)}</td><td>${esc(reps)}</td></tr>`).join('')
  const body = `
<h1>${esc(x.h1)}</h1>
<p class="lead">${esc(x.intro)}</p>
<div class="cards">${dayCards}</div>
<section><h2>${esc(x.whyTitle)}</h2><ul class="ticks">${x.why.map(([a, b]) => `<li><strong>${esc(a)}</strong> ${esc(b)}</li>`).join('')}</ul></section>
<section><h2>${esc(x.whoTitle)}</h2>${x.who.map((w) => `<p>${esc(w)}</p>`).join('')}<p><a href="${urlFor('fb3', lang)}">${esc(planName('fb3'))} →</a></p></section>
<section><h2>${esc(x.startTitle)}</h2><ul class="ticks">${x.start.map(([id, days, text]) => `<li><strong>${esc(days)}:</strong> <a href="${urlFor(id, lang)}">${esc(planName(id))}</a> – ${esc(text)}</li>`).join('')}</ul></section>
<section><h2>${esc(x.progTitle)}</h2>${x.prog.map((q) => `<p>${esc(q)}</p>`).join('')}
<p>${esc(x.progStrength)} <a href="${urlFor('reps', lang)}">${esc(t.home.tools.find(([id]) => id === 'reps')[1])}</a></p>
<p>${esc(x.exampleIntro)}</p>
${table(x.exampleCols, exampleRows)}
<p><strong>${esc(x.whyNotTitle)}</strong> ${esc(x.whyNot)}</p>
${x.progEnd.map((q) => `<p>${esc(q)}</p>`).join('')}</section>
<section><h2>${esc(x.ownTitle)}</h2>${x.own.map((q) => `<p>${esc(q)}</p>`).join('')}<p><em>${esc(x.ownSign)}</em></p></section>
${appBlock(t, 'ppl', x.appTitle, x.app)}`
  return layout({ lang, pageId: 'ppl', title: x.title, description: x.description, siteUrl, body })
}

/** Plan-Daten aus den Vorlagen der App: je Stufe und Tag die Übungen mit Sätzen. */
export function planData(templateId) {
  const template = PLAN_TEMPLATES[templateId]
  return template.days.map((day) => ({
    labelKey: day.labelKey,
    levels: Object.fromEntries(Object.entries(day.levels).map(([level, list]) => [level, list.map(({ id, sets }) => {
      const entry = byId.get(id)
      return { id, sets, en: titleCase(entry.name_en), de: EXERCISE_DE[id] }
    })]))
  }))
}

export function renderPlan(templateId, lang, siteUrl) {
  const t = content[lang]
  const p = t.plans
  const tpl = messages[lang].plans.templates[templateId]
  const dayLabel = messages[lang].plans.dayLabel
  const days = planData(templateId)
  const levels = ['beginner', 'advanced']
  const levelHtml = levels.map((level) => `
<section id="${level}"><h2>${esc(p[level])}</h2>
<p class="muted">${esc(level === 'beginner' ? p.levelHintBeginner : p.levelHintAdvanced)}</p>
${paragraphs(tpl.explain[level])}
${days.map((day) => `<h3>${esc(dayLabel[day.labelKey])}</h3>
<div class="tablewrap"><table><thead><tr><th scope="col">${esc(p.dayCols[0])}</th><th scope="col">${esc(p.dayCols[1])}</th></tr></thead><tbody>
${day.levels[level].map((e) => `<tr><td>${esc(e.en)}${lang === 'de' ? ` <span class="de-name">(${esc(e.de)})</span>` : ''}</td><td>${e.sets}</td></tr>`).join('\n')}
</tbody></table></div>`).join('\n')}
</section>`).join('\n')
  const others = Object.keys(PLAN_TEMPLATES).filter((id) => id !== templateId)
    .map((id) => `<a class="card" href="${urlFor(id, lang)}"><h3>${esc(messages[lang].plans.templates[id].name)}</h3><p>${esc(messages[lang].plans.templates[id].desc)}</p></a>`).join('')
  const title = `${tpl.name}: ${p.titleSuffix} | fbe`
  const body = `
<p class="muted"><a href="${urlFor('plans', lang)}">← ${esc(p.back)}</a></p>
<h1>${esc(tpl.name)}</h1>
<p class="lead">${esc(tpl.desc)}</p>
${PPL_PLANS.has(templateId) ? pplLink(t, lang) : ''}
<div class="pillrow"><a href="#beginner">${esc(p.beginner)}</a><a href="#advanced">${esc(p.advanced)}</a></div>
<p>${esc(p.repsLine)}</p><p>${esc(p.tips)}</p>
${levelHtml}
${appBlock(t, templateId, p.startTitle, p.start)}
<section><h2>${esc(p.otherPlans)}</h2><div class="cards">${others}</div></section>`
  return layout({ lang, pageId: templateId, title, description: `${tpl.desc} ${p.title.split('|')[0].trim()}`.slice(0, 158), siteUrl, body })
}

export function renderPlans(lang, siteUrl) {
  const t = content[lang]
  const p = t.plans
  const cards = Object.keys(PLAN_TEMPLATES).map((id) => `<a class="card" href="${urlFor(id, lang)}"><h3>${esc(messages[lang].plans.templates[id].name)}</h3><p>${esc(messages[lang].plans.templates[id].desc)}</p><p class="small">${esc(p.open)} →</p></a>`).join('')
  const body = `<h1>${esc(p.h1)}</h1><p class="lead">${esc(p.intro)}</p>${pplLink(t, lang)}<div class="cards">${cards}</div>${appBlock(t, 'plans', p.startTitle, p.start)}`
  return layout({ lang, pageId: 'plans', title: p.title, description: p.description, siteUrl, body })
}

const mail = (email) => `<a href="mailto:${esc(email)}">${esc(email)}</a>`

export function renderSupport(lang, siteUrl) {
  const t = content[lang]
  const s = t.support
  const body = `<h1>${esc(s.h1)}</h1>
<section><h2>${esc(s.contact)}</h2><p>${esc(s.contactText)} ${mail(LEGAL_OWNER.email)}</p></section>
<section><h2>${esc(s.delTitle)}</h2><p>${esc(s.del)}</p></section>
<section><h2>${esc(s.faqTitle)}</h2><p><a href="${urlFor('home', lang)}#faq">${esc(s.faqLink)}</a></p></section>`
  return layout({ lang, pageId: 'support', title: s.title, description: s.description, siteUrl, body })
}

export function renderImpressum(lang, siteUrl) {
  const l = messages[lang].legal
  const address = legalAddressLines().join('\n')
  const responsible = legalAddressLines().slice(0, 3).join('\n')
  const body = `<div class="legal"><h1>${esc(l.title)}</h1>
<h2>${esc(l.section1Title)}</h2><pre>${esc(address)}</pre><p>${esc(l.section1Mail.replace('{email}', ''))}${mail(LEGAL_OWNER.email)}</p>
<p><strong>${esc(l.section1ResponsibleTitle)}</strong></p><pre>${esc(responsible)}</pre>
<h2>${esc(l.copyrightTitle)}</h2><p>${esc(l.copyrightNotice)}</p><p>${esc(l.copyrightLaw)}</p>
<h2>${esc(l.disclaimerTitle)}</h2><p>${esc(l.disclaimer1)}</p><p>${esc(l.disclaimer2)}</p>
<h2>${esc(l.userHintsTitle)}</h2><ul>${[l.userHint1, l.userHint2, l.userHint3, l.userHint4].map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
<p><a href="${urlFor('datenschutz', lang)}">${esc(l.privacyLink)}</a></p>
<p class="muted">${esc(l.lastUpdate)}</p></div>`
  return layout({ lang, pageId: 'impressum', title: `${l.title} | fbe`, description: `${l.title} fbe`, siteUrl, body })
}

const WEBSITE_PRIVACY = {
  de: {
    h1: 'Datenschutzerklärung',
    intro: 'Diese Seite hat zwei Teile: Teil A gilt für diese Website, Teil B für die App fbe.',
    aTitle: 'Teil A: Diese Website',
    a: [
      ['Verantwortlicher', 'Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:'],
      ['Das Wichtigste in Kürze', 'Diese Website setzt keine Cookies, nutzt keine Analyse- oder Werbedienste und lädt keine Schriften oder Skripte von anderen Anbietern. Der 1RM-Rechner rechnet in deinem Browser. Deine Eingaben werden nicht an uns gesendet.'],
      ['Hosting', 'Die Website wird bei Render (Render Services, Inc., USA) gehostet und über ein weltweites Netzwerk zur Auslieferung von Inhalten ausgeliefert. Beim Aufruf verarbeitet der Hosting-Anbieter technisch bedingt Verbindungsdaten wie die IP-Adresse, um die Seite auszuliefern und abzusichern (Art. 6 Abs. 1 lit. f DSGVO). Dabei können Daten auch außerhalb der EU verarbeitet werden. Wir selbst erhalten für diese Website keine Zugriffsprotokolle und werten keine Besucher aus.'],
      ['Links zum App Store', 'Die Knöpfe „Im App Store laden“ führen zu Apple. Ab dem Klick gelten die Datenschutzhinweise von Apple.'],
      ['Kontakt', 'Wenn du uns per E-Mail schreibst, verarbeiten wir deine E-Mail-Adresse und deinen Text, um dir zu antworten (Art. 6 Abs. 1 lit. f DSGVO).'],
      ['Deine Rechte', 'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren. Anfragen an:']
    ],
    bTitle: 'Teil B: Die App fbe'
  },
  en: {
    h1: 'Privacy policy',
    intro: 'This page has two parts: Part A applies to this website, Part B to the fbe app.',
    aTitle: 'Part A: This website',
    a: [
      ['Controller', 'The controller within the meaning of the General Data Protection Regulation (GDPR) is:'],
      ['In short', 'This website sets no cookies, uses no analytics or advertising services and loads no fonts or scripts from other providers. The 1RM calculator runs in your browser. Your inputs are not sent to us.'],
      ['Hosting', 'The website is hosted by Render (Render Services, Inc., USA) and delivered through a worldwide content delivery network. When you visit it, the hosting provider technically processes connection data such as your IP address to deliver and protect the site (Art. 6(1)(f) GDPR). Data may also be processed outside the EU. We ourselves receive no access logs for this website and do not analyse visitors.'],
      ['Links to the App Store', 'The “Download on the App Store” buttons lead to Apple. From the click on, Apple’s privacy information applies.'],
      ['Contact', 'If you write to us by email, we process your email address and your text to reply to you (Art. 6(1)(f) GDPR).'],
      ['Your rights', 'You have the right of access, rectification, erasure, restriction of processing, data portability and objection. You can also complain to a data protection authority. Requests to:']
    ],
    bTitle: 'Part B: The fbe app'
  }
}

export function renderPrivacy(lang, siteUrl) {
  const w = WEBSITE_PRIVACY[lang]
  const l = messages[lang].privacy
  const address = legalAddressLines().join('\n')
  const email = LEGAL_OWNER.email
  const appSections = []
  for (let n = 1; n <= 14; n += 1) {
    const title = l[`s${n}Title`]
    let text = l[`s${n}Text`]
    if (!title || !text) continue
    text = text.replace('{email}', email)
    appSections.push(`<h3>${esc(title)}</h3>${text.split('\n').map((line) => `<p>${esc(line)}</p>`).join('')}${n === 1 ? `<pre>${esc(address)}</pre>` : ''}${l[`s${n}Mail`] ? `<p>${esc(l[`s${n}Mail`].replace('{email}', email))}</p>` : ''}`)
  }
  const body = `<div class="legal"><h1>${esc(w.h1)}</h1><p>${esc(w.intro)}</p>
<h2>${esc(w.aTitle)}</h2>
${w.a.map(([title, text], i) => `<h3>${esc(title)}</h3><p>${esc(text)}</p>${i === 0 ? `<pre>${esc(address)}</pre><p>${mail(email)}</p>` : ''}${i === 5 ? `<p>${mail(email)}</p>` : ''}`).join('\n')}
<h2>${esc(w.bTitle)}</h2>
<p class="muted">${esc(l.lastUpdate)}</p>
${appSections.join('\n')}</div>`
  return layout({ lang, pageId: 'datenschutz', title: `${w.h1} | fbe`, description: `${w.h1} fbe`, siteUrl, body })
}

export function renderNotFound(siteUrl) {
  const t = content.de
  const n = t.notFound
  const body = `<h1>${esc(n.h1)}</h1><p>${esc(n.text)} <a href="/">${esc(n.link)}</a></p>`
  return layout({ lang: 'de', pageId: '404', title: n.title, description: n.title, siteUrl, body, noindex: true })
}

export function renderSitemap(siteUrl) {
  const urls = PAGES.map((page) => {
    const alt = ['de', 'en'].map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${absolute(siteUrl, page[l])}"/>`).join('')
    return ['de', 'en'].map((l) => `<url><loc>${absolute(siteUrl, page[l])}</loc>${alt}</url>`).join('')
  }).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`
}

export function renderAll(siteUrl) {
  const files = new Map()
  const add = (pathName, html) => files.set(pathName.endsWith('/') ? `${pathName}index.html` : pathName, html)
  for (const lang of ['de', 'en']) {
    add(urlFor('home', lang), renderHome(lang, siteUrl))
    add(urlFor('rm', lang), renderRm(lang, siteUrl))
    add(urlFor('reps', lang), renderReps(lang, siteUrl))
    add(urlFor('ppl', lang), renderPpl(lang, siteUrl))
    add(urlFor('plans', lang), renderPlans(lang, siteUrl))
    for (const id of Object.keys(PLAN_TEMPLATES)) add(urlFor(id, lang), renderPlan(id, lang, siteUrl))
    add(urlFor('support', lang), renderSupport(lang, siteUrl))
    add(urlFor('impressum', lang), renderImpressum(lang, siteUrl))
    add(urlFor('datenschutz', lang), renderPrivacy(lang, siteUrl))
  }
  add('/404.html', renderNotFound(siteUrl))
  add('/sitemap.xml', renderSitemap(siteUrl))
  add('/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${absolute(siteUrl, '/sitemap.xml')}\n`)
  return files
}
