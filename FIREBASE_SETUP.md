# Firebase-oppsett for Rapportgenerator

Denne guiden forklarer hvordan du setter opp Firebase for arkiv-funksjonaliteten.

## Steg 1: Opprett Firebase-prosjekt

1. Gå til [Firebase Console](https://console.firebase.google.com/)
2. Klikk "Add project" eller "Legg til prosjekt"
3. Fyll inn prosjektnavn (f.eks. "uu-rapportgenerator")
4. Følg veiviseren for å opprette prosjektet

## Steg 2: Aktiver Authentication

1. I Firebase Console, gå til "Authentication" i venstre meny
2. Klikk "Get started"
3. Gå til "Sign-in method" tab
4. Aktiver "Email/Password" provider
5. Klikk "Save"

## Steg 3: Opprett Firestore Database

1. I Firebase Console, gå til "Firestore Database" i venstre meny
2. Klikk "Create database"
3. Velg "Start in test mode" (du kan endre regler senere)
4. Velg en lokasjon (f.eks. "europe-west1" for Norge)
5. Klikk "Enable"

## Steg 4: Opprett Storage

1. I Firebase Console, gå til "Storage" i venstre meny
2. Klikk "Get started"
3. Velg "Start in test mode" (du kan endre regler senere)
4. Velg samme lokasjon som Firestore
5. Klikk "Done"

## Steg 5: Hent Firebase-konfigurasjon

1. I Firebase Console, gå til "Project settings" (tannhjul-ikonet)
2. Scroll ned til "Your apps" seksjonen
3. Klikk på Web-ikonet (`</>`)
4. Registrer app med et navn (f.eks. "UU Rapportgenerator")
5. Kopier Firebase-konfigurasjonen (firebaseConfig objektet)

## Steg 6: Konfigurer miljøvariabler

**VIKTIG:** Aldri hardkod Firebase-konfigurasjonen direkte i koden! Bruk alltid miljøvariabler.

### For lokal utvikling

1. Kopier `env.example.txt` til `.env`:
   ```bash
   cp env.example.txt .env
   ```

2. Fyll inn dine Firebase-verdier i `.env`-filen:

```env
FIREBASE_API_KEY=din-api-key
FIREBASE_AUTH_DOMAIN=ditt-prosjekt.firebaseapp.com
FIREBASE_PROJECT_ID=ditt-prosjekt-id
FIREBASE_STORAGE_BUCKET=ditt-prosjekt.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

**Sikkerhet:** `.env` filen er allerede lagt til i `.gitignore`, så den vil ikke bli pushet til GitHub. Dette beskytter dine API-nøkler.

### For GitHub Pages deploy

For å deploye til GitHub Pages, må du sette opp Firebase-konfigurasjonen som **GitHub Secrets**:

1. Gå til ditt repository på GitHub
2. Klikk på **Settings** > **Secrets and variables** > **Actions**
3. Klikk på **New repository secret** for hver av følgende secrets:

   - **Name:** `FIREBASE_API_KEY`
     - **Value:** Din Firebase API Key (f.eks. `AIzaSyALpl9k6hK_BFe6I21v9tgnyZjjgDOuzYk`)

   - **Name:** `FIREBASE_AUTH_DOMAIN`
     - **Value:** Din Firebase Auth Domain (f.eks. `ditt-prosjekt.firebaseapp.com`)

   - **Name:** `FIREBASE_PROJECT_ID`
     - **Value:** Din Firebase Project ID (f.eks. `ditt-prosjekt-id`)

   - **Name:** `FIREBASE_STORAGE_BUCKET`
     - **Value:** Din Firebase Storage Bucket (f.eks. `ditt-prosjekt.firebasestorage.app`)

   - **Name:** `FIREBASE_MESSAGING_SENDER_ID`
     - **Value:** Din Firebase Messaging Sender ID (f.eks. `123456789`)

   - **Name:** `FIREBASE_APP_ID`
     - **Value:** Din Firebase App ID (f.eks. `1:123456789:web:abcdef123456`)

4. Klikk **Add secret** for hver secret

**VIKTIG:** 
- Sjekk at secret-navnene matcher **eksakt** (case-sensitive)
- Sjekk at du har kopiert alle verdiene korrekt (ingen mellomrom, ingen ekstra tegn)
- Hvis du oppdaterer secrets, må du manuelt trigge en ny workflow-kjøring eller pushe en ny commit

**Etter at secrets er satt opp:**
- GitHub Actions vil automatisk bruke disse secrets når den bygger og deployer
- Du trenger ikke gjøre noe mer - bare push til `main`-branchen

## Steg 7: Sett opp Firestore Security Rules

I Firebase Console, gå til "Firestore Database" > "Rules" og legg til:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kun innloggede brukere kan lese og skrive rapporter
    match /rapporter/{rapportId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Steg 8: Sett opp Storage Security Rules

I Firebase Console, gå til "Storage" > "Rules" og legg til:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Kun innloggede brukere kan laste opp og ned filer
    match /rapporter/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Steg 9: Test oppsettet

1. Start applikasjonen: `npm start`
2. Gå til `/login` for å opprette en bruker
3. Gå til `/arkiv` for å se arkivet
4. Eksporter en rapport fra `/rapport-generator` - den skal automatisk lagres i arkivet

## Notater

- **Gratis tier**: Firebase har en generøs gratis tier som passer for start
- **Sikkerhet**: Husk å oppdatere security rules før produksjon
- **Backup**: Vurder å sette opp automatisk backup av Firestore
- **Begrensninger**: Gratis tier har begrensninger på lagring og nedlasting - sjekk Firebase pricing for detaljer

## Feilsøking

- **"Firebase: Error (auth/configuration-not-found)"**: Sjekk at Firebase-konfigurasjonen er riktig
- **"Permission denied"**: Sjekk at security rules er satt opp riktig
- **"Storage quota exceeded"**: Du har nådd gratis tier-grensen - vurder å oppgradere


