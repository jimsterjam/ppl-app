import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeFeedbackLanguage } from '../feedbackLanguage.js';

test('gültige Sprachen werden übernommen (auch in Großbuchstaben/mit Leerraum)', () => {
  assert.equal(sanitizeFeedbackLanguage('de'), 'de');
  assert.equal(sanitizeFeedbackLanguage(' EN '), 'en');
});

test('unbekannte oder fehlende Werte werden zu null (nie ein Fehler beim Speichern)', () => {
  assert.equal(sanitizeFeedbackLanguage('fr'), null);
  assert.equal(sanitizeFeedbackLanguage('de-DE'), null);
  assert.equal(sanitizeFeedbackLanguage(undefined), null);
  assert.equal(sanitizeFeedbackLanguage({}), null);
});
