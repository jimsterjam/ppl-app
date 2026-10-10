// Erzeugt die Wecker-Töne für das Pausenende: ios/App/App/rest-alarm-<id>.wav
// aus den Noten in src/utils/restMelodies.js (dieselben Noten spielt die App im Vordergrund).
//
// Aufruf: cd client && node scripts/generate-rest-melodies.mjs
// Die WAV-Dateien nicht von Hand ändern - Noten in restMelodies.js anpassen und neu erzeugen.
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REST_MELODIES, renderAlarmSamples, alarmSoundFile } from '../src/utils/restMelodies.js'

const SAMPLE_RATE = 22050
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../ios/App/App')

function wavBuffer(samples) {
  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'latin1')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVEfmt ', 8, 'latin1')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // Mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'latin1')
  buffer.writeUInt32LE(dataSize, 40)
  samples.forEach((value, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2))
  return buffer
}

for (const id of Object.keys(REST_MELODIES)) {
  const file = resolve(outDir, alarmSoundFile(id))
  const samples = renderAlarmSamples(id, SAMPLE_RATE)
  writeFileSync(file, wavBuffer(samples))
  console.log(`${alarmSoundFile(id)}: ${(samples.length / SAMPLE_RATE).toFixed(1)} s`)
}
