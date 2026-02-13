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
[
  {"name":"Liegestütze auf Knien","name_en":"Knee Push-Ups","category":"Push","muscleGroup":"Brust","muscleGroup_en":"Chest","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Hindu Push-Ups","name_en":"Hindu Push-Ups","category":"Push","muscleGroup":"Brust","muscleGroup_en":"Chest","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Pike Push-Ups","name_en":"Pike Push-Ups","category":"Push","muscleGroup":"Schultern","muscleGroup_en":"Shoulders","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Handstand Push-Ups (an der Wand)","name_en":"Handstand Push-Ups (Wall)","category":"Push","muscleGroup":"Schultern","muscleGroup_en":"Shoulders","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Superman","name_en":"Superman Hold","category":"Pull","muscleGroup":"Rücken","muscleGroup_en":"Back","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Reverse Snow Angels","name_en":"Reverse Snow Angels","category":"Pull","muscleGroup":"Rücken","muscleGroup_en":"Back","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Doorway Rows","name_en":"Doorway Rows","category":"Pull","muscleGroup":"Rücken","muscleGroup_en":"Back","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Towel Curls","name_en":"Towel Curls","category":"Pull","muscleGroup":"Bizeps","muscleGroup_en":"Biceps","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Reverse Plank","name_en":"Reverse Plank","category":"Core","muscleGroup":"Bauch","muscleGroup_en":"Abs","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Flutter Kicks","name_en":"Flutter Kicks","category":"Core","muscleGroup":"Bauch","muscleGroup_en":"Abs","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Donkey Kicks","name_en":"Donkey Kicks","category":"Legs","muscleGroup":"Gluteus","muscleGroup_en":"Glutes","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Fire Hydrants","name_en":"Fire Hydrants","category":"Legs","muscleGroup":"Gluteus","muscleGroup_en":"Glutes","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Side Leg Raises","name_en":"Side Leg Raises","category":"Legs","muscleGroup":"Abduktoren","muscleGroup_en":"Abductors","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Calf Raises einbeinig","name_en":"Single-Leg Calf Raises","category":"Legs","muscleGroup":"Waden","muscleGroup_en":"Calves","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Skater Jumps","name_en":"Skater Jumps","category":"Legs","muscleGroup":"Beine","muscleGroup_en":"Legs","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Bear Crawl","name_en":"Bear Crawl","category":"Full Body","muscleGroup":"Ganzkörper","muscleGroup_en":"Full Body","equipment":"Körpergewicht","equipment_en":"Bodyweight"},
  {"name":"Climber Taps","name_en":"Cross-Body Mountain Climbers","category":"Core","muscleGroup":"Bauch","muscleGroup_en":"Abs","equipment":"Körpergewicht","equipment_en":"Bodyweight"}
]
