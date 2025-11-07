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
// og eksponeres via inline script tag i HTML-en
function getFirebaseConfig() {
  // Prøv først å hente fra inline script tag i HTML-en (klientside)
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Prøv flere ganger - script tag kan ikke være lastet ennå
    const configScript = document.getElementById('firebase-config');
    if (configScript) {
      const content = configScript.textContent || configScript.innerHTML;
      if (content && content.trim()) {
        try {
          const config = JSON.parse(content);
          if (config.apiKey && config.authDomain && config.projectId) {
            console.log('Firebase-konfigurasjon hentet fra script tag');
            return config;
          } else {
            console.warn('Firebase-konfigurasjon i script tag mangler nødvendige felter:', config);
          }
        } catch (e) {
          console.error('Feil ved parsing av Firebase-konfigurasjon fra script tag:', e, 'Content:', content);
        }
      } else {
        console.warn('Firebase-konfigurasjon script tag er tom');
      }
    } else {
      console.warn('Firebase-konfigurasjon script tag ikke funnet i DOM');
    }
    
    // Fallback: Prøv å hente fra window.__docusaurus (hvis tilgjengelig)
    const docusaurus = (window as any).__docusaurus;
    if (docusaurus?.siteConfig?.customFields?.firebase) {
      const config = docusaurus.siteConfig.customFields.firebase;
      if (config.apiKey && config.authDomain && config.projectId) {
        console.log('Firebase-konfigurasjon hentet fra Docusaurus context');
        return config;
      }
    }
  }
  
  // Fallback til process.env (kun på server-side/byggetidspunkt)
  // Sjekk at process eksisterer før vi prøver å bruke det
  if (typeof process !== 'undefined' && process.env) {
    const config = {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || ''
    };
    if (config.apiKey && config.authDomain && config.projectId) {
      console.log('Firebase-konfigurasjon hentet fra process.env');
      return config;
    }
  }
  
  // Hvis vi er på klientsiden og ikke har funnet konfigurasjon, returner tomme verdier
  console.error('Firebase-konfigurasjon ikke funnet! Sjekk at miljøvariabler er satt opp.');
  return {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  };
}

// Lazy initialization - Firebase initialiseres kun når det faktisk brukes
let app: any = null;
let auth: any = null;
let db: any = null;
let storage: any = null;
let initialized = false;

function initializeFirebase() {
  if (initialized) {
    return { app, auth, db, storage };
  }

  const firebaseConfig = getFirebaseConfig();
  
  // Valider at alle nødvendige miljøvariabler er satt
  const isValidConfig = firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId;

  if (!isValidConfig) {
    console.warn('Firebase-konfigurasjon mangler! Vennligst sett opp miljøvariabler i .env filen.');
    // Opprett dummy-objekter
    app = {} as any;
    auth = {} as any;
    db = {} as any;
    storage = {} as any;
    initialized = true;
    return { app, auth, db, storage };
  }

  // Kun initialiser Firebase på klientsiden eller hvis konfigurasjonen er gyldig
  // Sjekk at process eksisterer før vi prøver å bruke det
  const hasEnvVar = typeof process !== 'undefined' && process.env && process.env.FIREBASE_API_KEY;
  if (isValidConfig && (typeof window !== 'undefined' || hasEnvVar)) {
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

  initialized = true;
  return { app, auth, db, storage };
}

// Initialiser Firebase ved første bruk
// På klientsiden, vent til DOM-en er klar og script tag er lastet
if (typeof window !== 'undefined') {
  const tryInitialize = () => {
    // Vent litt ekstra for å sikre at script tag er lastet
    setTimeout(() => {
      initializeFirebase();
    }, 100);
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInitialize);
  } else {
    // DOM-en er allerede klar, men vent litt for script tag
    tryInitialize();
  }
} else {
  // Server-side/byggetidspunkt
  initializeFirebase();
}

// Eksporter getters som sjekker initialisering før bruk
// Dette sikrer at Firebase alltid er initialisert når det brukes
export const getAuthInstance = () => {
  // Prøv å initialisere hvis ikke allerede gjort
  if (!initialized) {
    initializeFirebase();
  }
  
  // Hvis auth ikke er gyldig, prøv å initialisere på nytt (i tilfelle script tag ikke var klar)
  if (!auth || (typeof auth === 'object' && Object.keys(auth).length === 0)) {
    // Reset initialisering og prøv igjen
    initialized = false;
    initializeFirebase();
    
    // Sjekk igjen etter ny initialisering
    if (!auth || (typeof auth === 'object' && Object.keys(auth).length === 0)) {
      const config = getFirebaseConfig();
      console.error('Firebase Authentication feilet. Konfigurasjon:', {
        hasApiKey: !!config.apiKey,
        hasAuthDomain: !!config.authDomain,
        hasProjectId: !!config.projectId,
        apiKeyLength: config.apiKey?.length || 0
      });
      throw new Error('Firebase Authentication er ikke initialisert. Sjekk at Firebase-konfigurasjonen er riktig og at miljøvariabler er satt opp i GitHub Secrets.');
    }
  }
  return auth;
};

export const getDbInstance = () => {
  if (!initialized) initializeFirebase();
  if (!db || (typeof db === 'object' && Object.keys(db).length === 0)) {
    throw new Error('Firestore er ikke initialisert. Sjekk at Firebase-konfigurasjonen er riktig.');
  }
  return db;
};

export const getStorageInstance = () => {
  if (!initialized) initializeFirebase();
  if (!storage || (typeof storage === 'object' && Object.keys(storage).length === 0)) {
    throw new Error('Firebase Storage er ikke initialisert. Sjekk at Firebase-konfigurasjonen er riktig.');
  }
  return storage;
};

// Eksporter direkte for bakoverkompatibilitet (bruk getters i stedet)
// Disse kan være null hvis Firebase ikke er initialisert
export { auth, db, storage };
export default app;


