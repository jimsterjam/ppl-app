import test from 'node:test';
import assert from 'node:assert/strict';
import exercises from '../../data/exercises.js';
import { isTimedCatalogEntry } from '../timedCatalogEntry.js';

test('Messart Zeit und Wdh. in fester Zeit zählen als Zeit-Übung', () => {
  assert.equal(isTimedCatalogEntry({ measureMode: 'time' }), true);
  assert.equal(isTimedCatalogEntry({ measureMode: 'repsTime' }), true);
});

test('Gegenprobe: Gewicht, fehlende oder unbekannte Messart bleiben normale Übungen', () => {
  assert.equal(isTimedCatalogEntry({ measureMode: 'weight' }), false);
  assert.equal(isTimedCatalogEntry({ measureMode: 'Time' }), false);
  assert.equal(isTimedCatalogEntry({ name: 'bench press' }), false);
  assert.equal(isTimedCatalogEntry(null), false);
  assert.equal(isTimedCatalogEntry('time'), false);
});

test('Katalog: Halteübungen sind als Zeit markiert, bewegte Varianten nicht', () => {
  const byName = new Map(exercises.map((e) => [e.name_en, e]));
  for (const name of ['tuck planche', 'tuck front lever', 'advanced tuck front lever', 'lean planche', 'l-sit on floor', 'front lever', 'handstand']) {
    assert.equal(isTimedCatalogEntry(byName.get(name)), true, name);
  }
  for (const name of ['hollow body rock', 'tuck front lever raise', 'pseudo planche push-up', 'archer row', 'handstand push-up', 'weighted front plank']) {
    assert.equal(isTimedCatalogEntry(byName.get(name)), false, name);
  }
});
