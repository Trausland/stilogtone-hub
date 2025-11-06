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
const isValidConfig = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId;

if (!isValidConfig) {
  console.warn('Firebase-konfigurasjon mangler! Vennligst sett opp miljøvariabler i .env filen.');
}

// Initialiser Firebase kun hvis konfigurasjonen er gyldig
// Under bygget (SSG) kan miljøvariabler være tomme, så vi må håndtere dette
let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;

// Kun initialiser Firebase på klientsiden eller hvis konfigurasjonen er gyldig
if (isValidConfig && (typeof window !== 'undefined' || process.env.FIREBASE_API_KEY)) {
  try {
    app = initializeApp(firebaseConfig);
    
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
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error('Feil ved Firebase-initialisering:', error);
    // Under bygget, opprett dummy-objekter for å unngå feil
    if (typeof window === 'undefined') {
      app = {} as any;
      auth = {} as any;
      db = {} as any;
      storage = {} as any;
    }
  }
} else {
  // Under bygget (SSG) eller manglende konfigurasjon, opprett dummy-objekter
  app = {} as any;
  auth = {} as any;
  db = {} as any;
  storage = {} as any;
}

export { auth, db, storage };
export default app;


