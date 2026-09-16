// ---------------------------------------------------------------------------
// 1RM-Whitelist (Kap. "1RM vom Nutzer abfragen", Regel 19 in OpenAIProvider.js)
// ---------------------------------------------------------------------------
// Feste Liste der Default-Übungen (aus default-exercises.json), bei denen ein "echtes" 1RM
// fachlich Sinn ergibt - Absprache mit dem Nutzer, nachdem der frühere equipment-basierte
// Heuristik-Ansatz ("equipment != Körpergewicht") sich in der App als zu ungenau erwiesen hat
// (z.B. Bizeps-Curls oder Seitheben mit Kurzhantel hätten das Feld gezeigt).
//
// Bewusst als exakte ID-Whitelist statt Keyword-/Namens-Matching umgesetzt ("eine Whitelist
// ist womöglich zuverlässiger", O-Ton Nutzer) - die Übungsdatenbank enthält sehr viele
// Namensvarianten (z.B. "Kniebeuge" existiert als High-Bar/Low-Bar/Full-Squat/Zercher/Hack/
// Sissy/Goblet/Split/Jump/Speed-Variante), ein Keyword wie "squat" würde massiv über-matchen.
//
// Ausdrücklich NICHT enthalten (Absprache mit dem Nutzer): Isolationsübungen, Beinstrecker/
// -beuger, Wadenheben, instabile Übungen, Reha-/Mobilitätsübungen, Technikübungen (z.B.
// Airflare/Power Start), Schnellkraft-/Sprung-/Plyo-Übungen (z.B. Speed Squats) - diese
// Varianten sind in der DB vorhanden, aber absichtlich ausgeschlossen.
//
// IDs beziehen sich auf das "id"-Feld in default-exercises.json (4-stellig gepaddet, siehe
// normalizeDefaultExercise()).
export const ONE_REP_MAX_ELIGIBLE_EXERCISE_IDS = new Set([
  // Back Squat (Langhantel) - High-Bar, Low-Bar, Full Squat (zusammengeführt, siehe
  // default-exercises.json-Bereinigung: vormals 3 Dubletten, jetzt eine Übung "Full Squat")
  '1436', // Kniebeugen mit der Langhantel (High-Bar)
  '1435', // Langhantel-Low-Bar-Kniebeuge
  '1462', // Full Squat

  // Front Squat (Langhantel)
  '0042', // Frontkniebeuge Langhantel
  '0029', // Langhantel Front Squat (Clean Grip)

  // Bench Press (Langhantel, flach)
  '0025', // Bankdrücken Langhantel

  // Deadlift (Langhantel, konventionell)
  '0032', // Kreuzheben mit der Langhantel

  // Overhead Press / Military Press (Langhantel, stehend)
  '1456', // Langhantel im Stehen mit engem Griff, Militärpresse
  '1457', // Langhantel im Stehen, breite Militärpresse

  // Gewichtete Klimmzüge (1RM = Zusatzgewicht zum Körpergewicht, siehe Absprache mit dem Nutzer)
  '0841', // Klimmzug mit Gewicht
  '2987', // Klimmzug mit engem Griff und Gewicht am Dip-Käfig

  // Gewichtete Dips (1RM = Zusatzgewicht zum Körpergewicht)
  '1755', // Gewichtete Trizeps-Dips
  '1767', // Gewichteter Trizeps-Dip auf hohen Barren
  '0830', // Hantelbank-Dip (weighted bench dip)
  '3313', // gewichteter Dip mit gerader Stange

  // Olympische Gewichtheberübungen (technisch erfahrene Nutzer - kein separates
  // Erfahrungslevel-Feld vorhanden, der Opt-in-Charakter des Features filtert natürlich)
  '0648', // Power Clean
  '9009', // Clean
  '9010', // Snatch
  '9011'  // Clean and Jerk
])

// Übungen aus der obigen Liste, bei denen der eingetragene Wert das ZUSATZGEWICHT zum
// Körpergewicht ist, nicht das Gesamtgewicht (Absprache mit dem Nutzer: "bei dips ist das
// gewicht immer als zusatzgewicht gemeint zu körpergewicht" - gilt analog für Klimmzüge).
// Wird für die Eingabefeld-Beschriftung genutzt, damit der Nutzer nicht versehentlich sein
// Gesamtgewicht (Körpergewicht + Zusatzgewicht) einträgt.
export const ONE_REP_MAX_ADDED_WEIGHT_EXERCISE_IDS = new Set([
  '0841', '2987', // Klimmzüge
  '1755', '1767', '0830', '3313' // Dips
])

export function isDefaultExerciseOneRepMaxEligible(exerciseId) {
  if (!exerciseId) return false
  return ONE_REP_MAX_ELIGIBLE_EXERCISE_IDS.has(String(exerciseId).trim())
}

export function isAddedWeightOneRepMaxExercise(exerciseId) {
  if (!exerciseId) return false
  return ONE_REP_MAX_ADDED_WEIGHT_EXERCISE_IDS.has(String(exerciseId).trim())
}
