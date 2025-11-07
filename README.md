# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Første gang oppsett

### 1. Installer avhengigheter

```bash
npm install
# eller
yarn
```

### 2. Sett opp miljøvariabler

**VIKTIG:** Du må sette opp Firebase-konfigurasjon før du kan bruke applikasjonen.

1. Kopier `env.example.txt` til `.env`:
   ```bash
   cp env.example.txt .env
   ```

2. Fyll inn dine Firebase-verdier i `.env`-filen. Du finner disse i [Firebase Console](https://console.firebase.google.com/) under Project Settings > Your apps > Web app.

3. Verifiser at miljøvariablene er satt opp korrekt:
   ```bash
   npm run check-env
   ```

4. Se [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detaljerte instruksjoner.

**Sikkerhet:** `.env`-filen er allerede i `.gitignore` og vil ikke bli committet til Git.

## Lokal utvikling

```bash
npm start
# eller
yarn start
```

Dette starter en lokal utviklingsserver og åpner nettleseren. De fleste endringer reflekteres live uten å restarte serveren.

## Bygge prosjektet

```bash
npm run build
# eller
yarn build
```

Dette genererer statisk innhold i `build`-mappen som kan serveres med en hvilken som helst statisk innholdshosting-tjeneste.

## Deploy til GitHub Pages

### Automatisk deploy (anbefalt)

Prosjektet er konfigurert med GitHub Actions for automatisk deploy når du pusher til `main`-branchen.

**Første gang oppsett:**

1. **Sett opp GitHub Secrets:**
   - Gå til ditt repository på GitHub
   - Klikk på **Settings** > **Secrets and variables** > **Actions**
   - Legg til følgende secrets (se [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detaljer):
     - `FIREBASE_API_KEY`
     - `FIREBASE_AUTH_DOMAIN`
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_STORAGE_BUCKET`
     - `FIREBASE_MESSAGING_SENDER_ID`
     - `FIREBASE_APP_ID`

2. **Push til main:**
   ```bash
   git push origin main
   ```

3. GitHub Actions vil automatisk bygge og deploye til GitHub Pages.

**Ved oppdateringer:**

Bare push til `main`-branchen, og deploy skjer automatisk:

```bash
git add .
git commit -m "Beskrivelse av endringene"
git push origin main
```

### Manuell deploy (ikke anbefalt)

Hvis du vil deploye manuelt:

```bash
# Med SSH
USE_SSH=true npm run deploy

# Uten SSH
GIT_USER=<Your GitHub username> npm run deploy
```

**Merk:** Manuell deploy vil ikke inkludere miljøvariabler fra GitHub Secrets, så Firebase-funksjonalitet vil ikke fungere. Bruk automatisk deploy i stedet.

## Feilsøking

### Firebase fungerer ikke lokalt

- Sjekk at `.env`-filen eksisterer og inneholder riktige verdier
- Sjekk at du har kopiert alle Firebase-verdiene korrekt
- Se [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) for detaljerte instruksjoner

### Firebase fungerer ikke på GitHub Pages

- Sjekk at alle GitHub Secrets er satt opp korrekt
- Sjekk at workflow-kjøringen ikke feilet (se Actions-fanen på GitHub)
- Sjekk at secrets-navnene matcher eksakt (case-sensitive)

### Build feiler

- Sjekk at alle avhengigheter er installert: `npm install`
- Sjekk at Node.js-versjonen er >= 20.0
- Sjekk at alle miljøvariabler er satt (lokalt: `.env`, GitHub: Secrets)

## Utviklingsarbeidsflyt

1. **Lokal utvikling:**
   - Gjør endringer lokalt
   - Test med `npm start`
   - Test at Firebase fungerer

2. **Commit og push:**
   ```bash
   git add .
   git commit -m "Beskrivelse av endringene"
   git push origin main
   ```

3. **Automatisk deploy:**
   - GitHub Actions bygger automatisk
   - Hvis build lykkes, deployes til GitHub Pages
   - Hvis build feiler, sjekk Actions-fanen for feilmeldinger

4. **Verifiser:**
   - Vent til deploy er ferdig (se Actions-fanen)
   - Test på produksjons-URL: https://trausland.github.io/stilogtone-hub/

## Sikkerhet

- **Aldri** commit `.env`-filen til Git (den er allerede i `.gitignore`)
- **Aldri** hardkod API-nøkler eller andre sensitive data i koden
- **Alltid** bruk miljøvariabler for konfigurasjon
- **Alltid** sett opp GitHub Secrets for produksjon
