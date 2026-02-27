<template>
  <div v-if="show" class="upgrade-modal-overlay" @click.self="$emit('close')">
    <div class="upgrade-modal glass">
      <div class="modal-header">
        <h2>🚀 Upgrade to Pro</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-content">
        <!-- Current Limit Reached -->
        <div v-if="limitType === 'workouts'" class="limit-notice">
          <div class="limit-icon">💪</div>
          <h3>{{ t('upgrade.workoutLimitReached') }}</h3>
          <p>{{ t('upgrade.workoutLimitMsg', { limit: 3 }) }}</p>
        </div>
        
        <div v-if="limitType === 'exercises'" class="limit-notice">
          <div class="limit-icon">🏋️‍♂️</div>
          <h3>{{ t('upgrade.exerciseLimitReached') }}</h3>
          <p>{{ t('upgrade.exerciseLimitMsg', { limit: 6 }) }}</p>
        </div>
        
        <!-- Pricing Plans -->
        <div class="pricing-plans">
          <div class="plan-card pro-plan" :class="{ selected: selectedPlan === 'pro' }" @click="selectedPlan = 'pro'">
            <div class="plan-header">
              <h3>Pro</h3>
              <div class="plan-price">
                <span class="price">€{{ billingCycle === 'yearly' ? '49.99' : '4.99' }}</span>
                <span class="period">/{{ billingCycle === 'yearly' ? t('upgrade.yearly') : t('upgrade.monthly') }}</span>
              </div>
              <div v-if="billingCycle === 'yearly'" class="savings">{{ t('upgrade.save2Months') }}</div>
            </div>
            
            <div class="plan-features">
              <div v-for="feature in proFeatures" :key="feature" class="feature">
                <span class="check">✓</span>
                <span>{{ t(`upgrade.features.${feature}`) }}</span>
              </div>
            </div>
            
            <div class="most-popular" v-if="selectedPlan === 'pro'">{{ t('upgrade.mostPopular') }}</div>
          </div>
          
          <div class="plan-card elite-plan" :class="{ selected: selectedPlan === 'elite' }" @click="selectedPlan = 'elite'">
            <div class="plan-header">
              <h3>Elite</h3>
              <div class="plan-price">
                <span class="price">€{{ billingCycle === 'yearly' ? '99.99' : '9.99' }}</span>
                <span class="period">/{{ billingCycle === 'yearly' ? t('upgrade.yearly') : t('upgrade.monthly') }}</span>
              </div>
              <div v-if="billingCycle === 'yearly'" class="savings">{{ t('upgrade.save2Months') }}</div>
            </div>
            
            <div class="plan-features">
              <div v-for="feature in eliteFeatures" :key="feature" class="feature">
                <span class="check">✓</span>
                <span>{{ t(`upgrade.features.${feature}`) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Billing Cycle Toggle -->
        <div class="billing-toggle">
          <label class="toggle-option" :class="{ active: billingCycle === 'monthly' }">
            <input type="radio" v-model="billingCycle" value="monthly" />
            <span>{{ t('upgrade.monthly') }}</span>
          </label>
          <label class="toggle-option" :class="{ active: billingCycle === 'yearly' }">
            <input type="radio" v-model="billingCycle" value="yearly" />
            <span>{{ t('upgrade.yearly') }}</span>
            <span class="discount">-17%</span>
          </label>
        </div>
        
        <!-- CTA Buttons -->
        <div class="modal-actions">
          <button class="upgrade-btn" @click="handleUpgrade" :disabled="isProcessing">
            <span v-if="isProcessing">🔄</span>
            <span v-else>💳</span>
            {{ isProcessing ? t('upgrade.processing') : t('upgrade.upgradeNow') }}
          </button>
          
          <button class="continue-free-btn" @click="$emit('continue-free')">
            {{ t('upgrade.continueFree') }}
          </button>
        </div>
        
        <!-- Trust Signals -->
        <div class="trust-signals">
          <div class="signal">
            <span class="icon">🔒</span>
            <span>{{ t('upgrade.securePayment') }}</span>
          </div>
          <div class="signal">
            <span class="icon">↩️</span>
            <span>{{ t('upgrade.cancelAnytime') }}</span>
          </div>
          <div class="signal">
            <span class="icon">📱</span>
            <span>{{ t('upgrade.allDevices') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useToastStore } from '@/stores/toastStore'
import { logger } from '@/utils/logger'

const props = defineProps({
  show: Boolean,
  limitType: String // 'workouts', 'exercises', 'general'
})

const emit = defineEmits(['close', 'continue-free', 'upgraded'])

const { t } = useI18n()
const subscriptionStore = useSubscriptionStore()
const toast = useToastStore()

const selectedPlan = ref('pro')
const billingCycle = ref('yearly')
const isProcessing = ref(false)

const proFeatures = [
  'unlimitedWorkouts',
  'aiCoach',
  'advancedStats',
  'workoutSharing',
  'customTemplates',
  'up50Friends'
]

const eliteFeatures = [
  'everythingPro',
  'unlimitedFriends',
  'personalCoaching',
  'prioritySupport',
  'earlyAccess',
  'exportData'
]

const handleUpgrade = async () => {
  logger.debug('🧪 UpgradeModal: Starting upgrade process...')
  isProcessing.value = true
  
  try {
    logger.debug('🧪 UpgradeModal: Calling upgradeSubscription...')
    const result = await subscriptionStore.upgradeSubscription(selectedPlan.value, {
      cycle: billingCycle.value
    })
    
    logger.debug('🧪 UpgradeModal: Upgrade result:', result)
    
    // Processing beenden BEVOR Toast und Events
    isProcessing.value = false
    
    // Toast Message
    if (result && result.demo) {
      toast.success(`🧪 Demo: ${t('upgrade.upgradeSuccess')}`)
    } else {
      toast.success(t('upgrade.upgradeSuccess'))
    }
    
    logger.debug('🧪 UpgradeModal: Emitting upgraded event...')
    // Events emittieren
    emit('upgraded')
    
    // Kleiner Delay damit der User den Success sieht
    setTimeout(() => {
      logger.debug('🧪 UpgradeModal: Closing modal...')
      emit('close')
    }, 500)
    
  } catch (error) {
    logger.error('🧪 UpgradeModal: Upgrade error:', error)
    isProcessing.value = false
    toast.error(t('upgrade.upgradeError'))
  }
}
</script>

<style scoped>
.upgrade-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.upgrade-modal {
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  border-radius: 24px;
  border: 1px solid color-mix(in srgb, var(--border-color) 30%, transparent);
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.25);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 24px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-color) 20%, transparent);
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: color-mix(in srgb, var(--bg-secondary) 50%, transparent);
}

.modal-content {
  padding: 24px;
}

.limit-notice {
  text-align: center;
  margin-bottom: 32px;
  padding: 24px;
  background: color-mix(in srgb, var(--accent-color) 10%, transparent);
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--accent-color) 20%, transparent);
}

.limit-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.limit-notice h3 {
  margin: 0 0 8px;
  color: var(--text-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.limit-notice p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.pricing-plans {
  display: grid;
  gap: 16px;
  margin-bottom: 24px;
}

.plan-card {
  border: 2px solid color-mix(in srgb, var(--border-color) 30%, transparent);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: color-mix(in srgb, var(--bg-secondary) 40%,  #fff 82%);
  color:  #fff 82%;
}

.plan-card:hover {
  border-color: var(--accent-color);
  transform: translateY(-2px);
}

.plan-card.selected {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 18%, #fff 82%);
  color: #222;
}

.plan-header {
  text-align: center;
  margin-bottom: 20px;
}

.plan-header h3 {
  margin: 0 0 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: #222;
}

.plan-price {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}

.price {
  font-size: 2rem;
  font-weight: 800;
  color: var(--accent-color);
}

.period {
  color: #555;
  font-size: 0.9rem;
}

.savings {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  display: inline-block;
  box-shadow: 0 1px 4px rgba(102,126,234,0.12);
}

.plan-features {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
}

.check {
  color: #22c55e;
  font-weight: bold;
  font-size: 1rem;
}

.most-popular {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
}

.billing-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 32px;
  background: color-mix(in srgb, var(--bg-secondary) 50%, transparent);
  border-radius: 12px;
  padding: 4px;
}

.toggle-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.toggle-option input {
  display: none;
}

.toggle-option.active {
  background: var(--accent-color);
  color: #fff;
  box-shadow: 0 2px 8px rgba(102,126,234,0.08);
}

.discount {
  background: #22c55e;
  color: white;
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.upgrade-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.upgrade-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
}

.upgrade-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.continue-free-btn {
  background: #fff;
  border: 1px solid var(--accent-color);
  color: #222;
  padding: 12px 24px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.continue-free-btn:hover {
  border-color: var(--accent-color);
  color: #111;
  background: color-mix(in srgb, var(--accent-color) 8%, #fff 92%);
}

.trust-signals {
  display: flex;
  justify-content: space-around;
  padding-top: 24px;
  border-top: 1px solid color-mix(in srgb, var(--border-color) 20%, transparent);
}

.signal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
  flex: 1;
}

.signal .icon {
  font-size: 1.2rem;
}

.signal span:last-child {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .upgrade-modal {
    margin: 0;
    border-radius: 24px 24px 0 0;
    max-height: 85vh;
  }
  
  .pricing-plans {
    grid-template-columns: 1fr;
  }
  
  .trust-signals {
    flex-direction: column;
    gap: 16px;
  }
  
  .signal {
    flex-direction: row;
    justify-content: center;
  }
}
</style>