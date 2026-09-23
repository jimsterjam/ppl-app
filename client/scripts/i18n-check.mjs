#!/usr/bin/env node
// i18n-Konsistenzprüfung (deterministischer "Evaluator", siehe CLAUDE.md/agents.md).
//
// Prüft ohne KI, rein anhand des Codes:
//   1. keyParity:     Keys, die nur in `de` oder nur in `en` existieren (client/src/i18n/index.js)
//   2. missingKeys:   t('a.b') / $t('a.b') mit statischem Key, der in de oder en fehlt
//   3. hardcodedText: sichtbarer, fest im Template stehender Text (Textknoten und statische
//                     Attribute wie placeholder/title/aria-label/label), der nicht über t() läuft
//   4. hardcodedScriptText: deutsche String-Literale, die direkt an toast.show()/alert()/
//                     confirm() gehen oder einer error-/message-Variable zugewiesen werden
//
// Aufruf:  node scripts/i18n-check.mjs            -> Bericht, Exit-Code 1 bei NEUEN Funden
//          node scripts/i18n-check.mjs --all      -> alle Funde inkl. Baseline anzeigen
//          node scripts/i18n-check.mjs --write-baseline -> aktuelle Funde als Baseline speichern
//
// Baseline (scripts/i18n-baseline.json): bereits bekannte, noch nicht behobene Altlasten. Der Test
// (src/i18n/__tests__/i18nConsistency.test.js) schlägt nur bei Funden fehl, die NICHT in der
// Baseline stehen - so blockiert der Altbestand keinen Deploy, aber jede neue Stelle ohne
// Übersetzung fällt sofort auf. Wird eine Altlast behoben, fliegt sie beim nächsten
// --write-baseline aus der Liste (die Baseline soll nur schrumpfen).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse as parseSfc } from 'vue/compiler-sfc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CLIENT_ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(CLIENT_ROOT, 'src')
export const BASELINE_PATH = path.join(__dirname, 'i18n-baseline.json')

// Attribute, deren statischer Wert für den Nutzer sichtbar bzw. vorgelesen wird.
const VISIBLE_ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label'])

// Texte, die in beiden Sprachen identisch sind und deshalb keine Übersetzung brauchen.
// Bewusst klein halten - im Zweifel lieber übersetzen.
const LANGUAGE_NEUTRAL = new Set([
  'push', 'pull', 'legs', 'fullbody', 'full body', 'ppl', 'ppl fundamentals', 'ok', 'kg', 'lbs',
  'min', 'sek', 'sec', 'rpe', 'rir', '1rm', 'ki', 'ai', 'id', 'email', 'e-mail', 'apple', 'google',
  'deutsch', 'english', 'timer', 'reset', 'start', 'pause', 'status', 'workout', 'workouts',
  'feedback', 'dashboard', 'x', 'max', 'set', 'sets', 'reps', 'bodyweight', 'gym', 'pro', 'premium'
])

const GERMAN_WORDS = /\b(und|oder|nicht|kein|keine|bitte|wird|werden|ist|sind|mit|für|fur|der|die|das|dein|deine|dich|dir|noch|jetzt|speichern|abbrechen|löschen|loeschen|fehler|zurück|zurueck|weiter|schließen|schliessen|übung|übungen|satz|sätze|gewicht|wiederholungen|einstellungen|erfolgreich|hinzufügen|bearbeiten|wählen|auswählen|laden|lädt|konnte|kann|neu|alle|heute|gestern)\b/i
const GERMAN_CHARS = /[äöüÄÖÜß]/

export function looksGerman(text) {
  return GERMAN_CHARS.test(text) || GERMAN_WORDS.test(text)
}

function flattenKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flattenKeys(v, key, out)
    else out.add(key)
  }
  return out
}

function walkFiles(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, exts, out)
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full)
  }
  return out
}

function rel(file) {
  return path.relative(CLIENT_ROOT, file).split(path.sep).join('/')
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length
}

// Nur "echter" Text: mindestens zwei Buchstaben, nicht rein technisch/sprachneutral.
function isTranslatableText(raw) {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return false
  const letters = text.replace(/[^A-Za-zÄÖÜäöüß]/g, '')
  if (letters.length < 2) return false
  const normalized = text.toLowerCase().replace(/[^a-zäöüß0-9 +-]/g, '').trim()
  if (LANGUAGE_NEUTRAL.has(normalized)) return false
  return true
}

function collectTemplateFindings(node, file, source, templateOffset, findings) {
  if (!node) return
  // NodeTypes: 1 = ELEMENT, 2 = TEXT, 6 = ATTRIBUTE
  if (node.type === 2) {
    const text = node.content.replace(/\s+/g, ' ').trim()
    if (isTranslatableText(text)) {
      findings.push({
        check: 'hardcodedText',
        file: rel(file),
        line: lineOf(source, templateOffset + node.loc.start.offset),
        text,
        german: looksGerman(text)
      })
    }
  }
  if (node.type === 1) {
    for (const prop of node.props || []) {
      if (prop.type === 6 && VISIBLE_ATTRS.has(prop.name) && prop.value) {
        const text = prop.value.content.trim()
        if (isTranslatableText(text)) {
          findings.push({
            check: 'hardcodedText',
            file: rel(file),
            line: lineOf(source, templateOffset + prop.loc.start.offset),
            text: `${prop.name}="${text}"`,
            german: looksGerman(text)
          })
        }
      }
    }
  }
  for (const child of node.children || []) {
    collectTemplateFindings(child, file, source, templateOffset, findings)
  }
}

// Kommentare entfernen, damit auskommentierter Code/Doku keine Treffer erzeugt. Grob, aber für
// diesen Zweck ausreichend (Strings mit "//" darin sind in UI-Texten selten).
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}

const SCRIPT_SINK = /(toast\.show|window\.alert|\balert|window\.confirm|\bconfirm)\(\s*(['"`])((?:(?!\2)[^\\]|\\.)*)\2|\b(error|errorMessage|message|statusMessage|infoText)\.value\s*=\s*(['"`])((?:(?!\5)[^\\]|\\.)*)\5/g

function collectScriptFindings(code, offset, file, source, findings) {
  const cleaned = stripComments(code)
  let m
  SCRIPT_SINK.lastIndex = 0
  while ((m = SCRIPT_SINK.exec(cleaned))) {
    const text = (m[3] ?? m[6] ?? '').trim()
    if (!text || !looksGerman(text)) continue
    findings.push({
      check: 'hardcodedScriptText',
      file: rel(file),
      line: lineOf(source, offset + m.index),
      text,
      german: true
    })
  }
}

const T_CALL = /(?<![A-Za-z0-9_$.])\$?t\(\s*(['"])([A-Za-z0-9_.-]+)\1/g

function collectUsedKeys(code, offset, file, source, used) {
  const cleaned = stripComments(code)
  let m
  T_CALL.lastIndex = 0
  while ((m = T_CALL.exec(cleaned))) {
    used.push({ key: m[2], file: rel(file), line: lineOf(source, offset + m.index) })
  }
}

export async function loadMessages() {
  const mod = await import(pathToFileURL(path.join(SRC_DIR, 'i18n', 'index.js')).href)
  return mod.messages
}

export async function runI18nCheck() {
  const messages = await loadMessages()
  const deKeys = flattenKeys(messages.de)
  const enKeys = flattenKeys(messages.en)

  const findings = []

  for (const key of deKeys) {
    if (!enKeys.has(key)) findings.push({ check: 'keyParity', file: 'src/i18n/index.js', key, text: `nur DE: ${key}` })
  }
  for (const key of enKeys) {
    if (!deKeys.has(key)) findings.push({ check: 'keyParity', file: 'src/i18n/index.js', key, text: `nur EN: ${key}` })
  }

  const used = []
  const files = walkFiles(SRC_DIR, ['.vue', '.js'])
  for (const file of files) {
    if (file.endsWith(path.join('i18n', 'index.js'))) continue
    const source = fs.readFileSync(file, 'utf8')
    if (file.endsWith('.vue')) {
      const { descriptor } = parseSfc(source, { filename: file })
      if (descriptor.template?.ast) {
        collectTemplateFindings(descriptor.template.ast, file, source, 0, findings)
        collectUsedKeys(descriptor.template.content, descriptor.template.loc.start.offset, file, source, used)
      }
      for (const block of [descriptor.script, descriptor.scriptSetup]) {
        if (!block) continue
        collectScriptFindings(block.content, block.loc.start.offset, file, source, findings)
        collectUsedKeys(block.content, block.loc.start.offset, file, source, used)
      }
    } else {
      collectScriptFindings(source, 0, file, source, findings)
      collectUsedKeys(source, 0, file, source, used)
    }
  }

  const seenMissing = new Set()
  for (const { key, file, line } of used) {
    // Nur vollständige Keys prüfen ("a.b"), keine Präfixe für dynamische Keys.
    if (!key.includes('.') || key.endsWith('.')) continue
    const inDe = deKeys.has(key)
    const inEn = enKeys.has(key)
    if (inDe && inEn) continue
    const id = `${file}:${key}`
    if (seenMissing.has(id)) continue
    seenMissing.add(id)
    findings.push({
      check: 'missingKeys',
      file,
      line,
      key,
      text: `${key} fehlt in ${[!inDe && 'DE', !inEn && 'EN'].filter(Boolean).join('+')}`
    })
  }

  return findings
}

// Stabile Kennung ohne Zeilennummer, damit reine Verschiebungen im Code die Baseline nicht brechen.
export function findingId(f) {
  return `${f.check}|${f.file}|${f.key || f.text}`
}

export function loadBaseline() {
  try {
    return new Set(JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).known || [])
  } catch {
    return new Set()
  }
}

function summarize(findings) {
  const byCheck = {}
  for (const f of findings) byCheck[f.check] = (byCheck[f.check] || 0) + 1
  return byCheck
}

function printFindings(findings) {
  const byFile = new Map()
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, [])
    byFile.get(f.file).push(f)
  }
  for (const [file, list] of [...byFile.entries()].sort()) {
    console.log(`\n${file}`)
    for (const f of list.sort((a, b) => (a.line || 0) - (b.line || 0))) {
      console.log(`  ${f.line ? `L${f.line}`.padEnd(6) : '      '}[${f.check}] ${f.text}`)
    }
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const findings = await runI18nCheck()

  if (args.has('--write-baseline')) {
    const known = [...new Set(findings.map(findingId))].sort()
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({
      _comment: 'Bekannte i18n-Altlasten (scripts/i18n-check.mjs). Soll nur schrumpfen - neue Einträge nicht von Hand ergänzen, sondern den Text übersetzen.',
      known
    }, null, 2) + '\n')
    console.log(`Baseline geschrieben: ${known.length} Einträge -> ${rel(BASELINE_PATH)}`)
    return
  }

  const baseline = loadBaseline()
  const fresh = findings.filter((f) => !baseline.has(findingId(f)))
  const shown = args.has('--all') ? findings : fresh

  printFindings(shown)
  console.log('\nZusammenfassung (alle Funde):', summarize(findings))
  console.log(`Davon in Baseline: ${findings.length - fresh.length}, NEU: ${fresh.length}`)
  if (fresh.length > 0) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}
