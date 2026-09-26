import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const server = await import(join(__dirname, '../repTargets.js'))
// Client-Modul ist bewusst frei von Vue-/Store-Imports und daher hier direkt importierbar.
const client = await import(join(__dirname, '../../../client/src/utils/weightSuggestion.js'))

describe('REP_TARGETS', () => {
  test('Server (Quick Generator) und Client (Gewichtsvorschlag) nutzen dieselben Bereiche', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(server.REP_TARGETS)), JSON.parse(JSON.stringify(client.REP_TARGETS)))
  })

  test('getRepRange', () => {
    assert.deepEqual(server.getRepRange('strength', false), [3, 5])
    assert.deepEqual(server.getRepRange('strength', true), [8, 10])
    assert.deepEqual(server.getRepRange('muscle_building', false), [6, 10])
    assert.deepEqual(server.getRepRange('hypertrophy', true), [10, 12])
  })
})
