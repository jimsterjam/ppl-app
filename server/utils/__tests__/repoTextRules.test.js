// Repo-weite Textregeln (CLAUDE.md): wiederkehrende Review-Funde als Test statt als Kommentar.
// - Marke immer "Form Beats Ego", nie die deutsche Übersetzung (auch in deutschen Texten)
// - Kontakt nur noch support@formbeatsego.de, keine Adresse der alten Domain push-pull-legs.de
// Geprüft werden die versionierten Dateien (`git ls-files`), lokale Dateien stören nicht.
// Eine Zeile, die die Regel selbst nennt, trägt den Marker `repo-text-rules: erlaubt`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const ALLOW_MARKER = 'repo-text-rules: erlaubt'

const TEXT_EXT = new Set([
  '.js', '.mjs', '.cjs', '.vue', '.json', '.md', '.html', '.css', '.svg', '.txt', '.yml',
  '.yaml', '.plist', '.strings', '.sh', '.swift', '.storyboard', '.xml',
])
const SKIP_FILES = new Set(['package-lock.json'])

// Schreibvarianten: ä als ä, ae, &auml; oder &#228;; beliebiger Leerraum (auch NBSP)
const BRAND_DE = /form[\s\u00a0]+schl(?:ä|ae|&auml;|&#228;)gt[\s\u00a0]+ego/i
const OLD_MAIL = /@push-pull-legs\.de/i

export const RULES = [
  { name: 'Markenname', pattern: BRAND_DE, hint: 'Der Name bleibt "Form Beats Ego", auch auf Deutsch.' },
  {
    name: 'alte Kontaktadresse',
    pattern: OLD_MAIL,
    hint: 'Kontakt ist support@formbeatsego.de (client/src/config/legalOwner.js).',
  },
]

function trackedTextFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' })
  return out
    .split('\0')
    .filter(Boolean)
    .filter((rel) => TEXT_EXT.has(path.extname(rel).toLowerCase()))
    .filter((rel) => !SKIP_FILES.has(path.basename(rel)))
}

export function findViolations(rel, text) {
  const findings = []
  // Zeilenumbrüche zwischen den Wörtern zählen mit (Markdown, i18n-Strings)
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    if (line.includes(ALLOW_MARKER)) return
    const joined = i + 1 < lines.length ? `${line} ${lines[i + 1]}` : line
    for (const rule of RULES) {
      if (rule.pattern.test(line) || (!rule.pattern.test(lines[i + 1] || '') && rule.pattern.test(joined))) {
        findings.push(`${rel}:${i + 1} (${rule.name}) – ${rule.hint}`)
      }
    }
  })
  return findings
}

// Beispieltexte werden zusammengesetzt, damit diese Datei selbst den Repo-Scan nicht auslöst.
const brand = (verb, gap = ' ') => ['Form', verb, 'Ego'].join(gap)
const oldMail = () => ['admin', 'push-pull-legs.de'].join('@')

test('Regeln erkennen Schreibvarianten und respektieren den Marker', () => {
  assert.equal(findViolations('a.md', brand('schl\u00e4gt')).length, 1)
  assert.equal(findViolations('a.md', brand('schlaegt')).length, 1)
  assert.equal(findViolations('a.html', brand('schl&auml;gt', '\u00a0')).length, 1)
  // über zwei Zeilen verteilt (Markdown, i18n-Strings)
  assert.equal(findViolations('a.md', ['Form schl\u00e4gt', 'Ego'].join('\n')).length, 1)
  assert.equal(findViolations('a.md', `mail ${oldMail()}`).length, 1)
  assert.equal(findViolations('a.md', `${brand('schl\u00e4gt')} <!-- ${ALLOW_MARKER} -->`).length, 0)
  assert.equal(findViolations('a.md', 'Form Beats Ego, support@formbeatsego.de').length, 0)
})

test('Repo-Texte: keine deutsche Markenübersetzung und keine alte Kontaktadresse', () => {
  const files = trackedTextFiles()
  assert.ok(files.length > 100, `zu wenige Dateien geprüft (${files.length}) – stimmt REPO_ROOT?`)
  const findings = []
  for (const rel of files) {
    const full = path.join(REPO_ROOT, rel)
    if (!fs.existsSync(full)) continue // im Arbeitsbaum gelöscht, noch nicht committet
    findings.push(...findViolations(rel, fs.readFileSync(full, 'utf8')))
  }
  assert.deepEqual(findings, [])
})
