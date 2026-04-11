<template>
  <div class="features-test-page">
    <HeaderBar title="Features" />
    <!-- AI Coach (vorerst deaktiviert) -->
    <div class="test-content">
      <p class="placeholder-text">Diese Seite ist vorübergehend nicht verfügbar.</p>
    </div>
  </div>
</template>

<script setup>
import HeaderBar from '@/components/HeaderBar.vue'
</script>

<style scoped>
.features-test-page {
  min-height: 100vh;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: calc(140px + var(--safe-bottom, 0px));
}

.test-content {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.test-section {
  margin-bottom: 30px;
}

.test-section h3 {
  color: var(--text-primary);
  margin-bottom: 20px;
  font-size: 1.4rem;
}

.test-card {
  background: color-mix(in srgb, var(--surface) 92%, #ffffff 6%);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid color-mix(in srgb, var(--card-border) 85%, transparent);
  box-shadow: 0 18px 45px color-mix(in srgb, #000000 12%, transparent);
}

.test-card h4 {
  color: var(--text-primary);
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.consent-status {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 15px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-item label {
  font-weight: 500;
  color: var(--text-secondary);
}

.success {
  color: color-mix(in srgb, var(--success-color) 80%, #ffffff 20%);
  background: color-mix(in srgb, var(--success-color) 15%, transparent);
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 6px;
}
.warning {
  color: color-mix(in srgb, var(--warning-color) 85%, #ffffff 15%);
  background: color-mix(in srgb, var(--warning-color) 18%, transparent);
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 6px;
}
.error {
  color: color-mix(in srgb, var(--error-color) 82%, #ffffff 18%);
  background: color-mix(in srgb, var(--error-color) 18%, transparent);
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 6px;
}

.ai-consent-card {
  border: 2px solid color-mix(in srgb, var(--primary-color) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 92%, #ffffff 4%);
}

.test-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 15px;
}

.test-actions button,
.config-actions button {
  background: var(--primary-color);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border-radius: 8px;
  padding: 12px 24px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.test-actions button:hover,
.config-actions button:hover {
  background: var(--primary-hover, #0057a8);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.test-actions button.warning {
  background: var(--warning-color);
}

.test-actions button.warning:hover {
  background: #e88a00;
}

.config-actions button.secondary {
  background: #999;
}

.config-actions button.secondary:hover {
  background: #777;
}

.config-actions button:disabled {
  background: #ccc;
  color: #888;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.config-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-item label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.config-label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 1rem;
}

.config-value {
  font-weight: 700;
  color: var(--primary-color);
  font-size: 1.1rem;
}

.config-select {
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--card-border) 75%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface) 92%, #ffffff 5%);
  color: var(--fg);
  font-size: 1rem;
  font-family: inherit;
  cursor: pointer;
}

.config-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px rgba(0,116,217,0.1);
}

.config-slider {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-border) 70%, transparent);
  outline: none;
  cursor: pointer;
  appearance: none;
}

.config-slider::-webkit-slider-thumb {
  appearance: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover, #ff3333));
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  border: 2px solid white;
}

.config-slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--primary-color);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.config-actions {
  margin-top: 20px;
}

.ai-request-btn {
  width: 100%;
  padding: 15px;
  background: var(--accent);
  color: var(--accent-contrast);
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.ai-request-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.2);
}

.ai-request-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.ai-result {
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--primary-color) 50%, transparent);
  padding: 24px;
  background: color-mix(in srgb, var(--surface) 90%, #ffffff 6%);
  box-shadow: 0 16px 40px color-mix(in srgb, #000000 15%, transparent);
}

.rec-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.rec-header strong {
  color: var(--text-primary);
  font-size: 1.1rem;
}

.source-indicator {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.ai-source { background: var(--primary-color); color: white; }
.demo-source { background: var(--warning-color); color: white; }
.unknown-source { background: var(--text-secondary); color: white; }

.rec-details {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.confidence-badge {
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: bold;
}

.confidence-badge.high { background: var(--success-color); color: white; }
.confidence-badge.medium { background: var(--warning-color); color: white; }
.confidence-badge.low { background: var(--error-color); color: white; }

.exercises-preview h5 {
  color: var(--text-primary);
  margin-bottom: 10px;
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.exercise-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: color-mix(in srgb, var(--surface) 85%, #ffffff 8%);
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--card-border) 75%, transparent);
}

.exercise-name {
  font-weight: 500;
  color: var(--text-primary);
}

.exercise-details {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: bold;
}

.workout-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  min-width: 120px;
  padding: 12px 16px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: transform 0.2s;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn.primary {
  background: var(--primary-color);
  color: var(--accent-contrast);
}

.action-btn.secondary {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .test-content {
    padding: 15px;
  }
  
  .rec-details {
    gap: 15px;
  }
  
  .workout-actions {
    flex-direction: column;
  }
  
  .action-btn {
    min-width: 100%;
  }
}
</style>