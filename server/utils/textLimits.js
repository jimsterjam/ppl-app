// Regeln für Freitext von Nutzern (siehe CLAUDE.md, "Regeln für Texteingaben").
//
// Beim SPEICHERN: Steuerzeichen entfernen und auf eine feste Länge kürzen. Bewusst kürzen statt
// ablehnen - Workouts kommen auch aus der Offline-Synchronisation (client/src/utils/syncManager.js),
// ein abgelehnter Speichervorgang würde dort endlos wiederholt.
// Beim Weitergeben an die KI gilt zusätzlich: eingekapselt in eigene Tags, < > neutralisiert
// (OpenAIProvider.wrapUserNote / wrapExerciseName, wrapQuickGeneratorFreeText, wrapCorrectionText).

export const TEXT_LIMITS = Object.freeze({
  workoutName: 100,
  workoutNotes: 2000,
  exerciseName: 120,
  exerciseNote: 500,
  setNote: 300
});

// Steuerzeichen außer Tab/Zeilenumbruch (für mehrzeilige Felder) bzw. inkl. Zeilenumbruch.
// eslint-disable-next-line no-control-regex -- Steuerzeichen werden hier bewusst ENTFERNT.
const CONTROL_MULTILINE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u2028\u2029]/g;
// eslint-disable-next-line no-control-regex -- Steuerzeichen werden hier bewusst ENTFERNT.
const CONTROL_SINGLELINE = /[\u0000-\u001f\u007f\u2028\u2029]+/g;

/**
 * @param {*} value
 * @param {number} max - höchstens so viele Zeichen (Unicode-Codepoints, Emojis werden nicht zerteilt)
 * @param {{ multiline?: boolean }} [options]
 * @returns {*} null/undefined unverändert, sonst bereinigter String
 */
export function clampText(value, max, { multiline = false } = {}) {
  if (value === null || value === undefined) return value;
  const text = String(value);
  const cleaned = multiline
    ? text.replace(/\r\n?/g, '\n').replace(CONTROL_MULTILINE, '')
    : text.replace(CONTROL_SINGLELINE, ' ');
  const chars = Array.from(cleaned);
  return chars.length > max ? chars.slice(0, max).join('') : cleaned;
}

/** Mongoose-Setter: `set: textSetter(TEXT_LIMITS.exerciseNote, { multiline: true })` */
export function textSetter(max, options) {
  return (value) => clampText(value, max, options);
}
