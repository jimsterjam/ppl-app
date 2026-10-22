import test from 'node:test'
import assert from 'node:assert/strict'
import { isMockUpgradeAllowed } from '../mockUpgradeGate.js'

test('Mock-Upgrade ist ohne Flag gesperrt', () => {
  assert.equal(isMockUpgradeAllowed({}), false)
  assert.equal(isMockUpgradeAllowed({ NODE_ENV: 'development' }), false)
})

test('Mock-Upgrade ist in Produktion immer gesperrt, auch mit Flag', () => {
  assert.equal(isMockUpgradeAllowed({ NODE_ENV: 'production', ALLOW_MOCK_UPGRADE: 'true' }), false)
})

test('Mock-Upgrade nur lokal mit ausdrücklichem Flag', () => {
  assert.equal(isMockUpgradeAllowed({ NODE_ENV: 'development', ALLOW_MOCK_UPGRADE: 'true' }), true)
  assert.equal(isMockUpgradeAllowed({ ALLOW_MOCK_UPGRADE: 'true' }), true)
  assert.equal(isMockUpgradeAllowed({ ALLOW_MOCK_UPGRADE: '1' }), false)
})
