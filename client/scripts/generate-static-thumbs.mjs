import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const inputDir = path.resolve(__dirname, '../public/exercises/180')
const outputDir = path.resolve(__dirname, '../public/exercises/static/180')
const force = process.argv.includes('--force')

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true })
}

const isGif = (name) => name.toLowerCase().endsWith('.gif')

const generateThumb = async (fileName) => {
  const inputPath = path.join(inputDir, fileName)
  const outputName = fileName.replace(/\.gif$/i, '.jpg')
  const outputPath = path.join(outputDir, outputName)

  if (!force) {
    try {
      await fs.access(outputPath)
      return { fileName, skipped: true }
    } catch {}
  }

  await sharp(inputPath, { animated: true, page: 0, pages: 1 })
    .resize({ width: 180, height: 180, fit: 'cover' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(outputPath)

  return { fileName, skipped: false }
}

const run = async () => {
  await ensureDir(outputDir)
  const entries = await fs.readdir(inputDir)
  const gifs = entries.filter(isGif)

  let created = 0
  let skipped = 0

  for (const fileName of gifs) {
    try {
      const result = await generateThumb(fileName)
      if (result.skipped) {
        skipped += 1
      } else {
        created += 1
      }
    } catch (err) {
      console.error('[thumbs] Failed:', fileName, err?.message || err)
    }
  }

  console.log(`[thumbs] Done. Created: ${created}, Skipped: ${skipped}, Total: ${gifs.length}`)
}

run().catch((err) => {
  console.error('[thumbs] Fatal:', err?.message || err)
  process.exit(1)
})
