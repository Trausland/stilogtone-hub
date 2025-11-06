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
// 5. Kopier verdiene fra firebaseConfig objektet og lim dem inn nedenfor

// Firebase-konfigurasjon - direkte fra Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyA_GTqMR6p5q2xvCsEW4lUiPXudm_ymCsk",
  authDomain: "uu-rapportgenerator.firebaseapp.com",
  projectId: "uu-rapportgenerator",
  storageBucket: "uu-rapportgenerator.firebasestorage.app",
  messagingSenderId: "839509330331",
  appId: "1:839509330331:web:c55bed3a460b24840db93e"
};

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


