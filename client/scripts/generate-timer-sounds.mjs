// Erzeugt die Timer-Töne für das iOS-Plugin TimerSound: ios/App/App/timer-*.wav
// (Liste: src/utils/timerSoundFiles.js, Klang: scripts/timerSoundSynth.mjs = utils/timerAudio.js).
//
// Aufruf: cd client && node scripts/generate-timer-sounds.mjs
// Die WAV-Dateien nicht von Hand ändern. Neue Datei? Zusätzlich im Xcode-Projekt unter "Copy Bundle Resources" eintragen.
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TIMER_SOUND_FILES } from '../src/utils/timerSoundFiles.js'
import { renderTimerSound, SR } from './timerSoundSynth.mjs'

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../ios/App/App')
// Gemeinsamer Spitzenpegel: der lauteste Ton erreicht PEAK, alle anderen behalten ihr Verhältnis dazu.
const PEAK = 0.9

export function wavBuffer(samples, sampleRate) {
  const dataSize = samples.length * 2
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0, 'latin1')
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVEfmt ', 8, 'latin1')
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(1, 22) // Mono
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36, 'latin1')
  buffer.writeUInt32LE(dataSize, 40)
  samples.forEach((value, i) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2))
  return buffer
}

export function renderAll() {
  const raw = new Map(TIMER_SOUND_FILES.map((file) => [file, renderTimerSound(file)]))
  let peak = 0
  for (const samples of raw.values()) for (const v of samples) peak = Math.max(peak, Math.abs(v))
  const scale = peak > 0 ? PEAK / peak : 0
  const fade = Math.round(0.01 * SR)
  return new Map([...raw].map(([file, samples]) => {
    const out = new Float32Array(samples.length)
    for (let i = 0; i < samples.length; i += 1) out[i] = samples[i] * scale * Math.min(1, (samples.length - 1 - i) / fade)
    return [file, out]
  }))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  for (const [file, samples] of renderAll()) {
    writeFileSync(resolve(outDir, file), wavBuffer(samples, SR))
    let peak = 0
    for (const v of samples) peak = Math.max(peak, Math.abs(v))
    console.log(`${file}: ${(samples.length / SR).toFixed(2)} s, Spitze ${peak.toFixed(2)}`)
  }
}
