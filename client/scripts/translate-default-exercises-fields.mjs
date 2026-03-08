import fs from 'node:fs/promises'
import path from 'node:path'

const DATA_PATH = path.resolve('client/public/data/default-exercises.json')
const CACHE_PATH = path.resolve('client/scripts/.translate-cache-en-de.json')
const CONCURRENCY = 8
const RETRIES = 4

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function toSourceName(entry) {
  return String(entry?.name_en || entry?.name || '').trim()
}

function toSourceInstructions(entry) {
  const source = Array.isArray(entry?.instructions_en) && entry.instructions_en.length
    ? entry.instructions_en
    : (Array.isArray(entry?.instructions) ? entry.instructions : [])
  return source.map((line) => String(line || '').trim()).filter(Boolean)
}

async function fetchTranslation(text) {
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: 'de',
    dt: 't',
    q: text
  })

  const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Translation HTTP ${res.status}`)
  }

  const data = await res.json()
  const translated = Array.isArray(data?.[0])
    ? data[0].map((part) => part?.[0] || '').join('').trim()
    : ''

  if (!translated) {
    throw new Error('Empty translation response')
  }

  return translated
}

async function translateWithRetry(text, cache) {
  if (!text) return text
  if (cache[text]) return cache[text]

  let lastError = null
  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    try {
      const translated = await fetchTranslation(text)
      cache[text] = translated
      return translated
    } catch (error) {
      lastError = error
      const backoffMs = 300 * attempt
      await sleep(backoffMs)
    }
  }

  throw new Error(`Failed to translate after retries: ${text.slice(0, 80)} (${String(lastError?.message || lastError)})`)
}

async function runPool(items, worker, concurrency) {
  const queue = [...items]
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const next = queue.shift()
      if (!next) break
      await worker(next)
    }
  })
  await Promise.all(workers)
}

async function main() {
  const exercises = await readJson(DATA_PATH, null)
  if (!Array.isArray(exercises)) {
    throw new Error(`Invalid exercise JSON at ${DATA_PATH}`)
  }

  const cache = await readJson(CACHE_PATH, {})

  const uniqueTexts = new Set()
  for (const entry of exercises) {
    const sourceName = toSourceName(entry)
    if (sourceName) uniqueTexts.add(sourceName)

    for (const line of toSourceInstructions(entry)) {
      uniqueTexts.add(line)
    }
  }

  const allTexts = [...uniqueTexts]
  let done = 0

  await runPool(
    allTexts,
    async (text) => {
      if (!cache[text]) {
        await translateWithRetry(text, cache)
      }
      done += 1
      if (done % 200 === 0 || done === allTexts.length) {
        console.log(`Translated ${done}/${allTexts.length}`)
      }
    },
    CONCURRENCY
  )

  const nextExercises = exercises.map((entry) => {
    const sourceName = toSourceName(entry)
    const sourceInstructions = toSourceInstructions(entry)

    const translatedName = sourceName ? (cache[sourceName] || sourceName) : ''
    const translatedInstructions = sourceInstructions.map((line) => cache[line] || line)

    return {
      ...entry,
      name_en: sourceName || String(entry?.name_en || '').trim(),
      name: translatedName || String(entry?.name || '').trim(),
      instructions_en: sourceInstructions,
      instructions: translatedInstructions
    }
  })

  await writeJson(DATA_PATH, nextExercises)
  await writeJson(CACHE_PATH, cache)

  console.log(`Updated ${nextExercises.length} exercises in ${DATA_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
