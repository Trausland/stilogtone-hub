#!/usr/bin/env node

/**
 * Sjekk at alle nødvendige miljøvariabler er satt opp
 * Dette scriptet kan kjøres lokalt for å verifisere at .env-filen er konfigurert korrekt
 */

const fs = require('fs');
const path = require('path');

const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID'
];

console.log('🔍 Sjekker miljøvariabler...\n');

// Last inn .env-fil hvis den eksisterer
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('✅ .env-fil funnet\n');
} else {
  console.log('⚠️  .env-fil ikke funnet');
  console.log('   Kopier env.example.txt til .env og fyll inn dine Firebase-verdier\n');
}

// Sjekk hver miljøvariabel
let allSet = true;
const missing = [];

for (const envVar of requiredEnvVars) {
  const value = process.env[envVar];
  if (!value || value.trim() === '') {
    console.log(`❌ ${envVar}: IKKE SATT`);
    missing.push(envVar);
    allSet = false;
  } else {
    // Vis første og siste tegn for sikkerhet
    const displayValue = value.length > 10 
      ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
      : '***';
    console.log(`✅ ${envVar}: ${displayValue}`);
  }
}

console.log('');

if (allSet) {
  console.log('✅ Alle miljøvariabler er satt opp korrekt!');
  console.log('   Du kan nå kjøre "npm start" for lokal utvikling\n');
  process.exit(0);
} else {
  console.log('❌ Noen miljøvariabler mangler!');
  console.log('\nManglende variabler:');
  missing.forEach(envVar => {
    console.log(`   - ${envVar}`);
  });
  console.log('\n📖 Se FIREBASE_SETUP.md for instruksjoner om hvordan du setter opp miljøvariabler\n');
  process.exit(1);
}

