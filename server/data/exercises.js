import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const defaultPath = path.resolve(__dirname, '..', '..', 'client', 'public', 'data', 'default-exercises.json')

let data = []
try {
  const raw = fs.readFileSync(defaultPath, 'utf8')
  const parsed = JSON.parse(raw)
  data = Array.isArray(parsed) ? parsed : []
} catch {
  data = []
}

export default data
