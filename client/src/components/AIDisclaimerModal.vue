<template>
  <div v-if="show" class="disclaimer-modal-overlay" @click="onBackdropClick">
    <div class="disclaimer-modal" @click.stop>
      <div class="disclaimer-header">
        <h2>🤖 AI Workout Coach</h2>
        <button @click="decline" class="close-btn">&times;</button>
      </div>
      
      <div class="disclaimer-content">
        <div class="warning-box">
          <h3>⚠️ Wichtige Hinweise</h3>
          <ul>
            <li><strong>Experimentelle Funktion:</strong> Unser AI Coach befindet sich in der Beta-Phase</li>
            <li><strong>Eigene Verantwortung:</strong> Alle Empfehlungen erfolgen auf eigene Gefahr</li>
            <li><strong>Kein Arzt-Ersatz:</strong> Bei gesundheitlichen Problemen konsultiere einen Arzt</li>
            <li><strong>Höre auf deinen Körper:</strong> Stoppe bei Schmerzen oder Unwohlsein</li>
            <li><strong>Feedback erwünscht:</strong> Hilf uns dabei, den AI Coach zu verbessern</li>
          </ul>
        </div>

        <div class="beta-info">
          <h4>🧪 Beta-Funktion</h4>
          <p>Der AI Coach ist eine experimentelle Funktion, die sich noch in der Entwicklung befindet. 
             Empfehlungen können ungenau oder ungeeignet sein. Nutze immer deinen gesunden Menschenverstand!</p>
        </div>

        <div class="data-info">
          <h4>📊 Datennutzung</h4>
          <p>Deine Workout-Daten werden anonymisiert zur Verbesserung der AI verwendet. 
             Keine persönlichen Informationen werden gespeichert oder weitergegeben.</p>
        </div>

        <div class="consent-options">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="acceptTerms"
              class="consent-checkbox"
            >
            <span class="checkmark"></span>
            Ich verstehe die Risiken und möchte den AI Coach trotzdem nutzen
          </label>

          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="hideInFuture"
              class="consent-checkbox"
            >
            <span class="checkmark"></span>
            Diese Warnung in Zukunft nicht mehr anzeigen
          </label>
        </div>
      </div>

      <div class="disclaimer-actions">
        <button @click="decline" class="btn-secondary">
          Lieber nicht
        </button>
        <button 
          @click="accept" 
          class="btn-primary"
        >
          AI Coach nutzen
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AIDisclaimerModal',
  props: {
    show: {
      type: Boolean,
      default: false
    }
  },
  emits: ['accept', 'decline'],
  data() {
    return {
      acceptTerms: false,
      hideInFuture: false
    }
  },
  methods: {
    accept() {
      // Consent in localStorage speichern
      const consent = {
        accepted: true,
        timestamp: Date.now(),
        hideInFuture: this.hideInFuture,
        version: '1.0' // Für zukünftige Updates
      };
      
      localStorage.setItem('ai_coach_consent', JSON.stringify(consent));
      
      this.$emit('accept', consent);
    },
    
    decline() {
      this.$emit('decline');
    },
    
    onBackdropClick() {
      this.decline();
    }
  }
}
</script>

<style scoped>
.disclaimer-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1400;
  padding: 20px;
}

.disclaimer-modal {
  background: color-mix(in srgb, var(--card-bg) 95%, #ffffff 5%);
  color: var(--fg);
  border-radius: 16px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border: 1px solid var(--card-border);
}

.disclaimer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 0;
  border-bottom: 1px solid var(--card-border);
  margin-bottom: 24px;
}

.disclaimer-header h2 {
  margin: 0;
  color: var(--accent);
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--surface-strong);
  color: var(--fg);
}

.disclaimer-content {
  padding: 0 24px;
}

.warning-box {
  background: color-mix(in srgb, #ff6b6b 12%, transparent);
  border: 1px solid color-mix(in srgb, #ff6b6b 45%, transparent);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.warning-box h3 {
  margin: 0 0 16px 0;
  color: #ff6b6b;
  font-size: 1.1rem;
}

.warning-box ul {
  margin: 0;
  padding-left: 20px;
}

.warning-box li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.beta-info, .data-info {
  background: color-mix(in srgb, var(--surface) 90%, #ffffff 4%);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  border: 1px solid color-mix(in srgb, var(--card-border) 70%, transparent);
}

.beta-info h4, .data-info h4 {
  margin: 0 0 12px 0;
  color: var(--accent);
  font-size: 1rem;
}

.beta-info p, .data-info p {
  margin: 0;
  line-height: 1.5;
  color: var(--muted);
}

.consent-options {
  margin-bottom: 24px;
}

.checkbox-label {
  display: flex;
  align-items: flex-start;
  margin-bottom: 16px;
  cursor: pointer;
  line-height: 1.5;
}

.consent-checkbox {
  display: none;
}

.checkmark {
  width: 20px;
  height: 20px;
  border: 2px solid var(--card-border);
  border-radius: 4px;
  margin-right: 12px;
  margin-top: 2px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.consent-checkbox:checked + .checkmark {
  background: var(--accent);
  border-color: var(--accent);
}

.consent-checkbox:checked + .checkmark::after {
  content: '✓';
  color: white;
  font-size: 14px;
  font-weight: bold;
}

.disclaimer-actions {
  display: flex;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid var(--card-border);
}

.btn-secondary, .btn-primary {
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-secondary {
  background: color-mix(in srgb, var(--surface) 85%, #ffffff 8%);
  color: var(--fg);
  border: 1px solid color-mix(in srgb, var(--card-border) 60%, transparent);
}

.btn-secondary:hover {
  background: color-mix(in srgb, var(--surface) 75%, #ffffff 12%);
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-contrast);
}

.btn-primary:hover {
  background: var(--primary-hover, #0057a8);
  transform: translateY(-1px);
}

.btn-primary.disabled {
  background: #ccc;
  color: #888;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .disclaimer-modal {
    margin: 20px;
    max-height: calc(100vh - 40px);
  }
  
  .disclaimer-header, .disclaimer-content, .disclaimer-actions {
    padding-left: 20px;
    padding-right: 20px;
  }
  
  .disclaimer-actions {
    flex-direction: column;
  }
}
</style>