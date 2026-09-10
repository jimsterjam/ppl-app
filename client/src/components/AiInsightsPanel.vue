<template>
  <div class="ai-insights-panel">
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
      <select v-model="statusFilter" class="filter-select" @change="load">
        <option value="">Alle Status</option>
        <option value="pending">Offen</option>
        <option value="approved">Freigegeben</option>
        <option value="rejected">Abgelehnt</option>
      </select>
      <button class="outline-btn" :disabled="loading" @click="load">Aktualisieren</button>
      <button class="analyze-btn" :disabled="analyzing || !adminKey" @click="runAnalysis">
        {{ analyzing ? 'Analysiere…' : '🔍 Neue Analyse starten' }}
      </button>
    </div>

    <!-- "Aktualisieren" lädt NUR die Vorschlagsliste neu, zeigt also keine rohen Bewertungen -
         ohne diesen Hinweis war nicht erkennbar, ob neue FeedbackRating-Einträge überhaupt zur
         Analyse bereitstehen (siehe Rückmeldung: neue Bewertung landet in der DB, "erscheint"
         aber nirgends, bis man aktiv "Neue Analyse starten" klickt). -->
    <p v-if="loaded && pendingCount > 0" class="pending-hint">
      🆕 {{ pendingCount }} neue Bewertung{{ pendingCount === 1 ? '' : 'en' }} noch nicht analysiert – klicke "Neue Analyse starten", um daraus einen Vorschlag zu erzeugen.
    </p>
    <p v-else-if="loaded && pendingCount === 0" class="muted">Keine neuen, unanalysierten Bewertungen.</p>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-if="analyzeMessage" class="info-text">{{ analyzeMessage }}</p>
    <p v-else-if="loaded && !loading && !proposals.length" class="muted">Keine Vorschläge gefunden.</p>

    <div v-if="proposals.length" class="proposal-list">
      <article v-for="p in proposals" :key="p.id" class="proposal">
        <div class="proposal-top">
          <span class="badge" :class="`badge-${p.status}`">{{ statusLabel(p.status) }}</span>
          <span class="proposal-time">{{ formatDateTime(p.createdAt) }}</span>
        </div>

        <h4 class="proposal-summary">{{ p.summary }}</h4>
        <p class="proposal-text">{{ p.proposalText }}</p>

        <div class="proposal-meta">
          Basiert auf {{ p.sourceRatingCount }} Bewertung{{ p.sourceRatingCount === 1 ? '' : 'en' }}
          <span v-if="p.reviewedAt"> · geprüft am {{ formatDateTime(p.reviewedAt) }}</span>
        </div>
        <p v-if="p.reviewNote" class="proposal-review-note">Notiz: {{ p.reviewNote }}</p>

        <div v-if="p.status === 'pending'" class="proposal-actions">
          <textarea
            v-model="reviewNotes[p.id]"
            class="review-note-input"
            placeholder="Optionale Notiz zur Entscheidung…"
            rows="2"
          />
          <div class="proposal-buttons">
            <button class="approve-btn" :disabled="updatingId === p.id" @click="decide(p, 'approved')">
              ✅ Freigeben
            </button>
            <button class="reject-btn" :disabled="updatingId === p.id" @click="decide(p, 'rejected')">
              ✖️ Ablehnen
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { listInsightProposals, analyzeFeedbackInsights, updateInsightProposal, getPendingInsightCount } from '@/api/feedbackInsights'

// Admin-only Review-Oberfläche für KI-generierte Verbesserungsvorschläge zum KI-Feedback-
// System-Prompt (siehe server/routes/adminFeedbackInsights.js). Nutzt denselben localStorage-
// Schlüssel wie AdminFeedbackPanel.vue, damit ein einmal eingegebener Admin-Schlüssel für
// beide Panels gilt, ohne ihn zweimal einzugeben. Freigabe hier setzt NUR den Status - die
// eigentliche Anpassung des System-Prompts in OpenAIProvider.js bleibt bewusst ein separater,
// manueller Schritt (kein Auto-Patch, siehe Kommentar in PromptImprovementProposal.js).
const STORAGE_KEY = 'admin_feedback_key'

const adminKey = ref(localStorage.getItem(STORAGE_KEY) || '')
const statusFilter = ref('')
const proposals = ref([])
const loading = ref(false)
const loaded = ref(false)
const analyzing = ref(false)
const error = ref('')
const analyzeMessage = ref('')
const updatingId = ref('')
const reviewNotes = ref({})
const pendingCount = ref(0)

function statusLabel(status) {
  return { pending: 'Offen', approved: 'Freigegeben', rejected: 'Abgelehnt' }[status] || status
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
  analyzeMessage.value = ''
  try {
    localStorage.setItem(STORAGE_KEY, adminKey.value)
    proposals.value = await listInsightProposals(adminKey.value, { status: statusFilter.value, limit: 50 })
    pendingCount.value = await getPendingInsightCount(adminKey.value)
    loaded.value = true
  } catch (e) {
    error.value = e?.message || 'Laden fehlgeschlagen.'
  } finally {
    loading.value = false
  }
}

async function runAnalysis() {
  if (!adminKey.value || analyzing.value) return
  analyzing.value = true
  error.value = ''
  analyzeMessage.value = ''
  try {
    const result = await analyzeFeedbackInsights(adminKey.value)
    if (result?.skipped) {
      analyzeMessage.value = result.message || 'Keine neuen Bewertungen seit der letzten Analyse.'
    } else {
      analyzeMessage.value = 'Neuer Vorschlag erstellt.'
    }
    await load()
  } catch (e) {
    error.value = e?.message || 'Analyse fehlgeschlagen.'
  } finally {
    analyzing.value = false
  }
}

async function decide(proposal, status) {
  if (updatingId.value) return
  updatingId.value = proposal.id
  error.value = ''
  try {
    await updateInsightProposal(adminKey.value, proposal.id, {
      status,
      reviewNote: reviewNotes.value[proposal.id] || ''
    })
    await load()
  } catch (e) {
    error.value = e?.message || 'Aktualisieren fehlgeschlagen.'
  } finally {
    updatingId.value = ''
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

.outline-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}

.analyze-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 700;
  cursor: pointer;
}

.analyze-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-text {
  color: color-mix(in srgb, var(--danger) 70%, var(--fg));
}

.info-text {
  color: var(--muted);
  font-size: 0.9rem;
}

.pending-hint {
  color: var(--fg);
  font-size: 0.9rem;
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line-soft));
  border-radius: 10px;
  padding: 8px 12px;
  margin-bottom: 12px;
}

.muted {
  color: var(--muted);
  font-size: 0.9rem;
}

.proposal-list {
  display: grid;
  gap: 12px;
}

.proposal {
  border: 1px solid var(--line-soft);
  border-radius: 14px;
  padding: 14px;
  background: color-mix(in srgb, var(--bg-elevated) 92%, transparent);
}

.proposal-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
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

.badge-approved {
  background: color-mix(in srgb, #2ecc71 24%, var(--bg-elevated));
}

.badge-rejected {
  background: color-mix(in srgb, var(--danger) 24%, var(--bg-elevated));
}

.proposal-time {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--muted);
}

.proposal-summary {
  margin: 0 0 6px;
  font-size: 1rem;
}

.proposal-text {
  margin: 0 0 8px;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.92rem;
}

.proposal-meta {
  font-size: 0.78rem;
  color: var(--muted);
  margin-bottom: 4px;
}

.proposal-review-note {
  font-size: 0.85rem;
  color: var(--muted);
  font-style: italic;
}

.proposal-actions {
  margin-top: 10px;
  border-top: 1px solid var(--line-soft);
  padding-top: 10px;
}

.review-note-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--bg-panel);
  color: var(--fg);
  font-family: inherit;
  resize: vertical;
  margin-bottom: 8px;
}

.proposal-buttons {
  display: flex;
  gap: 10px;
}

.approve-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: none;
  background: color-mix(in srgb, #2ecc71 30%, var(--bg-elevated));
  color: var(--fg);
  font-weight: 700;
  cursor: pointer;
}

.reject-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--fg);
  cursor: pointer;
}

.approve-btn:disabled,
.reject-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
