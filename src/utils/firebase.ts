import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase-konfigurasjon
// OPPDATER DISSE VERDIENE MED DINE EGNE FRA FIREBASE CONSOLE
// 1. Gå til https://console.firebase.google.com/
// 2. Velg prosjektet ditt (eller opprett et nytt)
// 3. Gå til Project settings (tannhjul-ikonet)
// 4. Scroll ned til "Your apps" og klikk Web-ikonet (</>)
// 5. Kopier verdiene fra firebaseConfig objektet
// 6. Opprett en .env fil i prosjektets rot-mappe og legg til verdiene der

// Firebase-konfigurasjon fra miljøvariabler
// I Docusaurus lastes miljøvariabler inn i docusaurus.config.ts via dotenv
// og eksponeres via customFields, som er tilgjengelig på klientsiden
function getFirebaseConfig() {
  // Prøv først å hente fra window.__docusaurus (klientside)
  if (typeof window !== 'undefined' && (window as any).__docusaurus) {
    const context = (window as any).__docusaurus;
    if (context?.siteConfig?.customFields?.firebase) {
      return context.siteConfig.customFields.firebase;
    }
  }
  
  // Fallback til process.env (server-side/byggetidspunkt)
  return {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || ''
  };
}

const firebaseConfig = getFirebaseConfig();

// Valider at alle nødvendige miljøvariabler er satt
if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error('Firebase-konfigurasjon mangler! Vennligst sett opp miljøvariabler i .env filen.');
}

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Debug: Log konfigurasjon (kun i utvikling)
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('Firebase konfigurasjon:', {
    apiKey: firebaseConfig.apiKey.substring(0, 10) + '...',
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket
  });
}

// Eksporter Firebase-tjenester
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;


