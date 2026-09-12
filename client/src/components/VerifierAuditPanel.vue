<template>
  <div class="verifier-audit-panel">
    <div class="key-row">
      <input
        v-model="adminKey"
        type="password"
        class="key-input"
        placeholder="Admin-Schlüssel"
        autocomplete="off"
        @keyup.enter="load"
      />
      <button class="primary-btn" :disabled="!adminKey || loading" @click="load">
        {{ loading ? 'Lädt…' : 'Laden' }}
      </button>
    </div>

    <div v-if="loaded" class="filter-row">
      <select v-model="modeFilter" class="filter-select" @change="load">
        <option value="">Alle Modi</option>
        <option value="shadow">Shadow</option>
        <option value="active">Aktiv</option>
      </select>
      <label class="checkbox-label">
        <input v-model="onlyViolations" type="checkbox" @change="load" />
        nur Beanstandungen
      </label>
      <button class="outline-btn" :disabled="loading" @click="load">Aktualisieren</button>
    </div>

    <p v-if="error" class="error-text">{{ error }}</p>

    <!-- Zusammenfassung zuerst (Text statt JSON) - beantwortet direkt "welche Regel schlägt wie
         oft an", ohne dass man sich erst durch einzelne Einträge klicken muss. -->
    <div v-if="loaded && summary" class="summary-box">
      <p class="summary-headline">
        Letzte {{ summary.periodDays }} Tage: {{ summary.totalRuns }} Prüfungen insgesamt.
      </p>
      <p v-if="summary.rules.length === 0" class="muted">Keine Regel wurde beanstandet.</p>
      <ul v-else class="rule-summary-list">
        <li v-for="r in summary.rules" :key="r.rule">
          Regel {{ r.rule }} ({{ r.label }}): {{ r.count }}×
        </li>
      </ul>
    </div>

    <p v-if="loaded && !loading && !entries.length" class="muted">Keine Einträge gefunden.</p>

    <div v-if="entries.length" class="entry-list">
      <article v-for="entry in entries" :key="entry.id" class="entry">
        <div class="entry-top">
          <span class="badge" :class="entryBadgeClass(entry)">{{ entryBadgeLabel(entry) }}</span>
          <span class="badge badge-mode">{{ entry.mode === 'shadow' ? 'Shadow' : 'Aktiv' }}</span>
          <span class="entry-time">{{ formatDateTime(entry.createdAt) }}</span>
        </div>

        <p class="entry-summary">{{ entry.summary }}</p>

        <ul v-if="entry.ruleDetails.length" class="rule-list">
          <li v-for="r in entry.ruleDetails" :key="r.rule">
            Regel {{ r.rule }}: {{ r.label }}
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { listVerifierAuditEntries, getVerifierAuditSummary } from '@/api/verifierAudit'

// Admin-only Auswertung des Feedback-Qualitäts-Loops (Phase 1: Shadow-Modus, siehe
// server/services/feedbackVerificationService.js + models/VerifierAudit.js). Zeigt bewusst
// ausschließlich vorformulierten Klartext statt Roh-JSON (User-Wunsch: "das JSON bringt mir da
// nichts") - die Regel-Erklärungen kommen fertig vom Server (getRuleLabel), damit Client und
// Server nicht getrennt gepflegte Übersetzungen der Regel-Nummern haben.
const STORAGE_KEY = 'admin_feedback_key'

const adminKey = ref(localStorage.getItem(STORAGE_KEY) || '')
const modeFilter = ref('')
const onlyViolations = ref(false)
const entries = ref([])
const summary = ref(null)
const loading = ref(false)
const loaded = ref(false)
const error = ref('')

function entryBadgeLabel(entry) {
  if (entry.aiCheckFailed) return 'KI-Prüfung fehlgeschlagen'
  if (entry.deterministicViolation || entry.aiViolation) return 'Beanstandet'
  return 'Ohne Befund'
}

function entryBadgeClass(entry) {
  if (entry.aiCheckFailed) return 'badge-failed'
  if (entry.deterministicViolation || entry.aiViolation) return 'badge-violation'
  return 'badge-ok'
}

function formatDateTime(d) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleString('de-DE')
  } catch {
    return ''
  }
}

async function load() {
  if (!adminKey.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    localStorage.setItem(STORAGE_KEY, adminKey.value)
    const [entriesResult, summaryResult] = await Promise.all([
      listVerifierAuditEntries(adminKey.value, {
        mode: modeFilter.value,
        onlyViolations: onlyViolations.value,
        limit: 50
      }),
      getVerifierAuditSummary(adminKey.value, { days: 30 })
    ])
    entries.value = entriesResult
    summary.value = summaryResult
    loaded.value = true
  } catch (e) {
    error.value = e?.message || 'Laden fehlgeschlagen.'
  } finally {
    loading.value = false
  }
}

if (adminKey.value) {
  load()
}
</script>

<style scoped>
.key-row {
  display: flex;
  gap: 10px;
  margin: 12px 0 16px;
}

.key-input {
  flex: 1;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  color: var(--fg);
}

.primary-btn {
  min-height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 700;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.filter-select {
  min-height: 40px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  color: var(--fg);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  color: var(--fg);
}

.outline-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}

.error-text {
  color: color-mix(in srgb, var(--danger) 70%, var(--fg));
}

.muted {
  color: var(--muted);
  font-size: 0.9rem;
}

.summary-box {
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 16px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.summary-headline {
  margin: 0 0 8px;
  font-weight: 700;
}

.rule-summary-list {
  margin: 0;
  padding-left: 20px;
}

.entry-list {
  display: grid;
  gap: 12px;
}

.entry {
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.entry-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--muted) 20%, var(--bg-elevated));
  color: var(--fg);
}

.badge-ok {
  background: color-mix(in srgb, #2ecc71 24%, var(--bg-elevated));
}

.badge-violation {
  background: color-mix(in srgb, #f5a623 26%, var(--bg-elevated));
}

.badge-failed {
  background: color-mix(in srgb, var(--danger) 24%, var(--bg-elevated));
}

.badge-mode {
  background: color-mix(in srgb, var(--accent) 16%, var(--bg-elevated));
}

.entry-time {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--muted);
}

.entry-summary {
  margin: 0 0 8px;
  font-size: 0.92rem;
}

.rule-list {
  margin: 0;
  padding-left: 20px;
  font-size: 0.88rem;
  color: var(--fg);
}
</style>
