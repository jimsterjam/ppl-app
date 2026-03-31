import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { curateDefaultExercises } from '../utils/exerciseCuration.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const defaultPath = path.resolve(__dirname, '..', '..', 'client', 'public', 'data', 'default-exercises.json')

let data = []
try {
  const raw = fs.readFileSync(defaultPath, 'utf8')
  const parsed = JSON.parse(raw)
  const enableCuration = String(process.env.EXERCISE_CURATION_ENABLED || '1').trim() !== '0'
  const enableExoticFilter = String(process.env.EXERCISE_EXOTIC_FILTER_ENABLED || '1').trim() !== '0'
  data = curateDefaultExercises(Array.isArray(parsed) ? parsed : [], {
    enableCuration,
    enableExoticFilter
  })
} catch {
  data = []
}

export default data
