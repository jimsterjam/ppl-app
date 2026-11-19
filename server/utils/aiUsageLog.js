// Token-Nutzung der KI-Aufrufe als eine Logzeile (Messung für das Zwischenspeichern von Prompts, Absprache Jimmy 19.11.).
//
// OpenAI speichert lange, gleiche Prompt-Anfänge (ab ca. 1.000 Token) automatisch zwischen und liefert in der Antwort
// `usage.prompt_tokens_details.cached_tokens`. Der Coach-Systemprompt hat ca. 10.000, die Prüfliste ca. 3.300 Token und wird je
// Feedback 2- bis 3-mal gesendet; ob der Zwischenspeicher (auch über den Relay) greift, war bisher nicht zu sehen.
//
// Nur Zahlen und der Name des Aufrufs, nie Prompt-Text, Antworten oder Nutzerdaten. Die Zeile geht per console.log raus (der
// Logger gibt in Production nur warn/error aus). Abschalten: Umgebungsvariable AI_USAGE_LOG=0.
// In Render: Logs von `ppl-app-server`, Suche nach `[ai-usage]`.

function count(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null
}

/**
 * Zahlen aus `response.usage` (OpenAI). `cachedTokens` ist null, wenn die Antwort keine Angabe enthält (z. B. ältere
 * Modelle oder ein Relay, der das Feld nicht weitergibt) - das ist selbst eine nützliche Auskunft.
 * @returns {{ promptTokens: number|null, cachedTokens: number|null, completionTokens: number|null, cachedShare: number|null } | null}
 */
export function summarizeAiUsage(usage) {
  if (!usage || typeof usage !== 'object') return null
  const promptTokens = count(usage.prompt_tokens)
  const cachedTokens = count(usage.prompt_tokens_details?.cached_tokens)
  const completionTokens = count(usage.completion_tokens)
  const cachedShare = promptTokens && cachedTokens !== null ? Math.min(1, Math.round((cachedTokens / promptTokens) * 100) / 100) : null
  return { promptTokens, cachedTokens, completionTokens, cachedShare }
}

/**
 * Eine Logzeile je KI-Aufruf: `[ai-usage] {"call":"coach","model":"gpt-4o-mini","promptTokens":10400,"cachedTokens":9984,...}`.
 * Wirft nie (Logging darf einen KI-Aufruf nicht stören).
 * @param {string} call - Name des Aufrufs, z. B. 'coach', 'verifier', 'revision'
 * @param {object} usage - `response.usage`
 * @param {{ model?: string, requestId?: string, write?: Function, env?: object }} [options] - write/env nur für Tests
 */
export function logAiUsage(call, usage, { model, requestId, write = console.log, env = process.env } = {}) {
  try {
    if (String(env.AI_USAGE_LOG ?? '1').trim() === '0') return
    const summary = summarizeAiUsage(usage)
    if (!summary) return
    write(`[ai-usage] ${JSON.stringify({
      call: String(call || 'unknown').slice(0, 40),
      model: model ? String(model).slice(0, 60) : undefined,
      requestId: requestId ? String(requestId).slice(0, 60) : undefined,
      ...summary
    })}`)
  } catch {
    // nie stören
  }
}
