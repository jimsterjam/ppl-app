#!/usr/bin/env node
/**
 * Test-Script für Ollama-Integration
 * Nutzer: Starte dein Backend mit `npm run dev` in einem anderen Terminal
 * Dann führe dies aus: `node test-ollama-integration.mjs`
 */

import { checkOllamaHealth, generateProgressFeedback } from './utils/ollamaClient.js';

const API_BASE = 'http://localhost:3001/api';
const TEST_USER_TOKEN = 'test-token'; // Demo-Token für Tests

console.log('🧪 Starting Ollama Integration Tests...\n');

// Test 1: Ollama Health Check
async function testOllamaHealth() {
  console.log('📋 Test 1: Ollama Health Check');
  try {
    const healthy = await checkOllamaHealth();
    if (healthy) {
      console.log('✅ Ollama is healthy and accessible\n');
      return true;
    } else {
      console.log('❌ Ollama health check failed\n');
      return false;
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    return false;
  }
}

// Test 2: Direct Ollama Call (util function)
async function testDirectOllamaCall() {
  console.log('📋 Test 2: Direct Ollama Call (generateProgressFeedback)');
  try {
    const trainingData = {
      exercise: 'Bankdrücken',
      period: '8 weeks',
      weight_change: 5,
      rep_change: 2,
      volume_change: 15,
      progression: 'positive'
    };

    console.log('  Sending training data:', trainingData);
    const feedback = await generateProgressFeedback(trainingData, {
      requestId: 'test_direct_001'
    });

    console.log('✅ Feedback from Qwen3:');
    console.log(`  "${feedback}"\n`);
    return true;
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    return false;
  }
}

// Test 3: API Endpoint (simulated request)
async function testApiEndpoint() {
  console.log('📋 Test 3: Test API Endpoint /api/workouts/ai-progress-feedback');
  console.log('  Note: This test requires your backend to be running with npm run dev\n');

  try {
    const payload = {
      exercise: 'Kreuzheben konventionell',
      period: '4 weeks',
      weight_change: 10,
      rep_change: 0,
      volume_change: 25,
      progression: 'strong_positive'
    };

    console.log('  Payload:', payload);

    // Versuch ohne Auth (wird 401 geben, aber wir sehen ob der Endpunkt existiert)
    const response = await fetch(`${API_BASE}/workouts/ai-progress-feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_USER_TOKEN}`
      },
      body: JSON.stringify(payload),
      timeout: 60000 // Ollama kann eine Weile brauchen
    });

    if (response.status === 401) {
      console.log('⚠️  Got 401 (auth required) – that\'s expected for this test');
      console.log('✅ Endpoint exists and responds\n');
      return true;
    }

    if (!response.ok) {
      const error = await response.text();
      console.log(`❌ API Error (${response.status}):`, error);
      return false;
    }

    const data = await response.json();
    console.log('✅ Success!');
    console.log('  Response:', JSON.stringify(data, null, 2));
    console.log();
    return true;

  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      console.log('❌ Backend not running. Start it with: npm run dev\n');
    } else {
      console.log(`❌ Error: ${error.message}\n`);
    }
    return false;
  }
}

// Main Test Runner
async function runTests() {
  const results = [];

  results.push(await testOllamaHealth());
  results.push(await testDirectOllamaCall());
  results.push(await testApiEndpoint());

  // Summary
  console.log('📊 Test Summary');
  console.log(`✅ Passed: ${results.filter(r => r).length}/${results.length}`);
  console.log(`❌ Failed: ${results.filter(r => !r).length}/${results.length}\n`);

  if (results.every(r => r)) {
    console.log('🎉 All tests passed! You\'re ready for Schritt 2 (iPhone Integration)');
  } else {
    console.log('⚠️  Some tests failed. Check your setup:');
    console.log('  1. Is Ollama running? (http://localhost:11434)');
    console.log('  2. Is Qwen3 1.7B downloaded? (ollama pull qwen3:1.7b)');
    console.log('  3. Is the backend running? (npm run dev)\n');
  }
}

runTests().catch(console.error);
