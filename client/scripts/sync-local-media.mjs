import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sourceDir = path.resolve(__dirname, '../../assets-cdn/exercises/mp4/360')
const targetDir = path.resolve(__dirname, '../public/exercises/mp4/360')
const force = process.argv.includes('--force')

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true })
}

const isMp4 = (name) => name.toLowerCase().endsWith('.mp4')

const statSafe = async (filePath) => {
  try {
    return await fs.stat(filePath)
  } catch {
    return null
  }
}

const shouldCopy = async (srcPath, destPath) => {
  if (force) return true

  const [srcStat, destStat] = await Promise.all([statSafe(srcPath), statSafe(destPath)])
  if (!srcStat) return false
  if (!destStat) return true

  if (srcStat.size !== destStat.size) return true
  return srcStat.mtimeMs > destStat.mtimeMs
}

const run = async () => {
  const sourceStat = await statSafe(sourceDir)
  if (!sourceStat || !sourceStat.isDirectory()) {
    console.log(`[media-sync] Source not found, skipping: ${sourceDir}`)
    return
  }

  await ensureDir(targetDir)

  const entries = await fs.readdir(sourceDir)
  const files = entries.filter(isMp4)

  let copied = 0
  let skipped = 0

  for (const fileName of files) {
    const srcPath = path.join(sourceDir, fileName)
    const destPath = path.join(targetDir, fileName)

    if (!(await shouldCopy(srcPath, destPath))) {
      skipped += 1
      continue
    }

    await fs.copyFile(srcPath, destPath)
    copied += 1
  }

  console.log(`[media-sync] Done. Copied: ${copied}, Skipped: ${skipped}, Total: ${files.length}`)
}

run().catch((err) => {
  console.error('[media-sync] Fatal:', err?.message || err)
  process.exit(1)
})
