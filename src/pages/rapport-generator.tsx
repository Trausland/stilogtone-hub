import React, { useState, useEffect, useRef } from 'react';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';
import '@skatteetaten/ds-core-designtokens/index.css';
import { TextField, TextArea, Select, FileUploader } from '@skatteetaten/ds-forms';
import { Button } from '@skatteetaten/ds-buttons';
import { Card, Panel } from '@skatteetaten/ds-content';
import { Alert, Tag } from '@skatteetaten/ds-status';
import { Table } from '@skatteetaten/ds-table';
import { Paragraph } from '@skatteetaten/ds-typography';
import { Document, Packer, Paragraph as DocxParagraph, TextRun, HeadingLevel, Table as DocxTable, TableRow, TableCell, WidthType, AlignmentType, ImageRun, ExternalHyperlink } from 'docx';
import { saveAs } from 'file-saver';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc as firestoreDoc } from 'firebase/firestore';
import { getAuthInstance, getDbInstance, getStorageInstance } from '@site/src/utils/firebase';

// Typer
type WCAGStatus = 'Åpent' | 'Lukket' | 'Revidert';

type SkjermbildeElement = {
  id: string;
  type: 'text' | 'image';
  content: string; // For tekst: tekstinnhold, for bilde: base64 data URL
  width?: number; // For bilde: visningsbredde i piksler
  height?: number; // For bilde: visningshøyde i piksler
  originalWidth?: number; // For bilde: original bredde i piksler (for å bevare kvalitet)
  originalHeight?: number; // For bilde: original høyde i piksler (for å bevare kvalitet)
};

type WCAGBrudd = {
  id: string;
  wcagKode: string;
  omrade: string;
  beskrivelse: string;
  tiltak: string;
  skjermbilder: SkjermbildeElement[]; // Array av tekst og bilder
  status: WCAGStatus;
  internKommentar: string;
};

type Forbedringsforslag = {
  id: string;
  skjermbilder: SkjermbildeElement[]; // Array av tekst og bilder
};

type Revisjon = {
  dato: string;
  endretAv: string;
  endringstype: string;
  kommentar: string;
};

type RapportData = {
  // Metadata
  tittel: string;
  testdato: string;
  testetAv: string;
  testUrl: string;
  testbruker: string;
  versjon: string;
  kommentar: string;
  sammendrag: string; // Eget felt for sammendrag
  
  // Brudd og forbedringer
  wcagBrudd: WCAGBrudd[];
  forbedringsforslag: Forbedringsforslag[];
  
  // Revisjoner
  revisjoner: Revisjon[];
};

// WCAG-kriterier dropdown - basert på offisiell liste fra uutilsynet.no
// Kun A og AA krav (48 krav for offentlig sektor)
const wcagKriterier = [
  { kode: '1.1.1', navn: '1.1.1 Ikke-tekstlig innhold (Nivå A)' },
  { kode: '1.2.1', navn: '1.2.1 Bare lyd og bare video (forhåndsinnspilt) (Nivå A)' },
  { kode: '1.2.2', navn: '1.2.2 Teksting (forhåndsinnspilt) (Nivå A)' },
  { kode: '1.2.5', navn: '1.2.5 Synstolking (forhåndsinnspilt) (Nivå AA)' },
  { kode: '1.3.1', navn: '1.3.1 Informasjon og relasjoner (Nivå A)' },
  { kode: '1.3.2', navn: '1.3.2 Meningsfylt rekkefølge (Nivå A)' },
  { kode: '1.3.3', navn: '1.3.3 Sensoriske egenskaper (Nivå A)' },
  { kode: '1.3.4', navn: '1.3.4 Visningsretning (Nivå AA)' },
  { kode: '1.3.5', navn: '1.3.5 Identifiser formål med inndata (Nivå AA)' },
  { kode: '1.4.1', navn: '1.4.1 Bruk av farge (Nivå A)' },
  { kode: '1.4.2', navn: '1.4.2 Styring av lyd (Nivå A)' },
  { kode: '1.4.3', navn: '1.4.3 Kontrast (minimum) (Nivå AA)' },
  { kode: '1.4.4', navn: '1.4.4 Endring av tekststørrelse (Nivå AA)' },
  { kode: '1.4.5', navn: '1.4.5 Bilder av tekst (Nivå AA)' },
  { kode: '1.4.10', navn: '1.4.10 Dynamisk tilpasning (Reflow) (Nivå AA)' },
  { kode: '1.4.11', navn: '1.4.11 Kontrast for ikke-tekstlig innhold (Nivå AA)' },
  { kode: '1.4.12', navn: '1.4.12 Tekstavstand (Nivå AA)' },
  { kode: '1.4.13', navn: '1.4.13 Pekerfølsomt innhold eller innhold ved tastaturfokus (Nivå AA)' },
  { kode: '2.1.1', navn: '2.1.1 Tastatur (Nivå A)' },
  { kode: '2.1.2', navn: '2.1.2 Ingen tastaturfelle (Nivå A)' },
  { kode: '2.1.4', navn: '2.1.4 Hurtigtaster som består av ett tegn (Nivå A)' },
  { kode: '2.2.1', navn: '2.2.1 Justerbar hastighet (Nivå A)' },
  { kode: '2.2.2', navn: '2.2.2 Pause, stopp, skjul (Nivå A)' },
  { kode: '2.3.1', navn: '2.3.1 Terskelverdi på maksimalt tre glimt (Nivå A)' },
  { kode: '2.4.1', navn: '2.4.1 Hoppe over blokker (Nivå A)' },
  { kode: '2.4.2', navn: '2.4.2 Sidetitler (Nivå A)' },
  { kode: '2.4.3', navn: '2.4.3 Fokusrekkefølge (Nivå A)' },
  { kode: '2.4.4', navn: '2.4.4 Formål med lenke (i kontekst) (Nivå A)' },
  { kode: '2.4.5', navn: '2.4.5 Flere måter (Nivå AA)' },
  { kode: '2.4.6', navn: '2.4.6 Overskrifter og ledetekster (Nivå AA)' },
  { kode: '2.4.7', navn: '2.4.7 Synlig fokus (Nivå AA)' },
  { kode: '2.5.1', navn: '2.5.1 Pekerbevegelser (Nivå A)' },
  { kode: '2.5.2', navn: '2.5.2 Pekeravbrytelse (Nivå A)' },
  { kode: '2.5.3', navn: '2.5.3 Ledetekst i navn (Nivå A)' },
  { kode: '2.5.4', navn: '2.5.4 Bevegelsesaktivering (Nivå A)' },
  { kode: '3.1.1', navn: '3.1.1 Språk på siden (Nivå A)' },
  { kode: '3.1.2', navn: '3.1.2 Språk på deler av innhold (Nivå AA)' },
  { kode: '3.2.1', navn: '3.2.1 Fokus (Nivå A)' },
  { kode: '3.2.2', navn: '3.2.2 Inndata (Nivå A)' },
  { kode: '3.2.3', navn: '3.2.3 Konsekvent navigasjon (Nivå AA)' },
  { kode: '3.2.4', navn: '3.2.4 Konsekvent identifikasjon (Nivå AA)' },
  { kode: '3.3.1', navn: '3.3.1 Identifikasjon av feil (Nivå A)' },
  { kode: '3.3.2', navn: '3.3.2 Ledetekster eller instruksjoner (Nivå A)' },
  { kode: '3.3.3', navn: '3.3.3 Forslag ved feil (Nivå AA)' },
  { kode: '3.3.4', navn: '3.3.4 Forhindring av feil (juridiske feil, økonomiske feil, datafeil) (Nivå AA)' },
  { kode: '4.1.1', navn: '4.1.1 Parsing (oppdeling) (Nivå A)' },
  { kode: '4.1.2', navn: '4.1.2 Navn, rolle, verdi (Nivå A)' },
  { kode: '4.1.3', navn: '4.1.3 Statusbeskjeder (Nivå AA)' },
];

// Standardtekster for tilgjengelighetserklæringer
const standardtekster: Record<string, string[]> = {
  '1.1.1': ['Noen bilder og grafikk har unøyaktig eller ingen alternativ tekst. Feilen er utilsiktet. Brukere som ikke kan se, må ha tilgang til en tekstlig beskrivelse av hva som vises.'],
  '1.2.1': ['Vi har lydklipp på nettstedet, men mangler et tekstalternativ. Dette er utilsiktet. Hørselshemmede vil ikke få med seg hva lydklippet inneholder.'],
  '1.2.2': ['Enkelte videoer på nettstedet mangler undertekster og bryter krav om dette. Dette er utilsiktet. Mange hørselshemmede brukere vil gå glipp av det som sies i videoen.'],
  '1.3.1': [
    'Overskrifter\n\nVi har feil overskriftsnivåer på deler av nettstedet. Det kan skyldes at riktig kodet nivå ikke har ønsket utseende. Synshemmede brukere kan oppleve nettsiden som uoversiktlig.',
    'Vi har kode for overskrifter uten innhold. Dette er utilsiktet. Skjermleserbrukere, som bruker kodede overskrifter til å skaffe seg oversikt over nettsiden og til navigering, vil oppleve dette som forvirrende og dårlig brukskvalitet.',
    'Vi har tekst som ser ut som overskrifter, men ikke er kodet som det. Vi mangler også noen overskrifter på innholdsdeler som burde hatt det. Dette er utilsiktet. Synshemmede brukere kan oppleve nettsiden som uoversiktlig.',
    'Tabeller\n\nNoen tabeller på nettstedet er ikke kodet i henhold til spesifikasjon og bryter kravet. Dette er utilsiktet. Synshemmede brukere kan ha problemer med å forstå organiseringen av tabellen.',
    'Kodet inndeling av innhold\n\nNettstedet mangler eller har feil koding for god inndeling av innholdet på siden. Dette er utilsiktet. Brukere som ikke kan se den visuelle inndelingen, kan oppleve siden om uorganisert.',
    'PDF\n\nVi har PDF-dokumenter på nettstedet som ikke har koder for struktur og informasjon om innholdet. Årsaken er at produksjonsverktøyet ikke har tilstrekkelig støtte for dette. Spesielt skjermleserbrukere vil ha utfordringer med å få oversikt og forstå organiseringen av dokumentet.',
    'Innhold er ikke merket for å formidle informasjon\n\nNoe innhold er ikke kodet riktig for å formidle informasjon, for eksempel, at noe ligger i en liste, bruker fet skrift eller vises i et avsnitt. Dette er ikke tilsiktet. Spesielt skjermleserbrukere kan gå glipp av informasjon som er tydelig og gir mening visuelt.'
  ],
  '1.3.2': ['Vi har innhold som ikke er plassert riktig med tanke på leserekkefølge. Dette er utilsiktet. Spesielt skjermleserbrukere vil ha utfordringer med å finne frem til innholdet eller bli forvirret av plasseringen.'],
  '1.3.5': ['Det finnes enkelte skjemafelt på nettstedet som ikke er kodet i henhold til kravet. Dette er utilsiktet. Brukere som har behov for enklere og automatisert utfylling av noen typer felt, vil ikke ha mulighet til dette.'],
  '1.4.1': ['Vi har lenker som mangler et alternativ til farge, for eksempel understreking. Årsaken er at elementet ikke følger våre retningslinjer for utforming. Fargeblinde brukere vil ha problemer med å oppfatte at det er lenker.'],
  '1.4.3': ['Vi oppfyller ikke alltid kravet til god kontrast mellom tekst og bakgrunn. Det skyldes at ikke alt innhold følger våre retningslinjer for utforming. Det er vanskeligere for alle brukere å lese innholdet.'],
  '1.4.4': ['Vi har tekst og innhold som ikke tilpasser seg når du forstørrer nettsiden til 200%. Det skyldes at siden ikke følger våre retningslinjer for utforming. Svaksynte brukere vil oppleve innholdet som vanskeligere å lese.'],
  '1.4.5': ['Vi har noen bilder av tekst, hvor teksten kunne blitt presentert som vanlig tekst. Dette er utilsiktet. Synshemmede og brukere med kognitive vansker, vil kunne ha utfordringer med informasjonen som blir formidlet.'],
  '1.4.10': ['Nettstedet følger ikke kravet til forstørring av innholdet opptil 400%. Det skyldes at siden ikke følger våre retningslinjer for utforming. Svaksynte og brukere på mobil vil oppleve at innholdet er vanskeligere å lese.'],
  '1.4.11': ['Vi oppfyller ikke alltid kravet til god kontrast for grafiske elementer som formidler informasjon. Årsaken er at elementet ikke følger våre retningslinjer for utforming. Fargeblinde og svaksynte brukere vil ha problemer med å oppfatte informasjonen som gis.'],
  '1.4.12': ['Vi oppfyller ikke alltid kravet til tekstavstander på nettstedet. Dette skyldes at våre retningslinjer for utforming ikke brukes her. Personer med nedsatt syn og/eller dysleksi vil kunne oppleve at tekster vil være vanskeligere å lese.'],
  '1.4.13': ['Vi har innhold som dukker opp ved tastaturfokus og bryter dette kravet. Feilen er utilsiktet. Brukere som ikke kan se vil kunne ha problemer med å få med seg innholdet og enkelte andre brukere vil synes det er et forstyrrende element.'],
  '2.1.1': ['Vi har elementer som kun kan brukes med mus og dermed bryter kravet om tastaturstøtte. Dette er utilsiktet. Tastaturbrukere vil ikke kunne bruke funksjonen det gjelder.'],
  '2.1.2': ['Vi har innhold som det ikke er mulig å navigere videre fra med bruk av tastatur. Dette er utilsiktet. Tastaturbrukere vil kunne hindres fra å utføre oppgaven sin.'],
  '2.2.1': ['Ved inaktivitet blir du logget ut av nettstedet uten mulighet til å forlenge sesjonen ved behov. Dette er utilsiktet. Brukere som trenger ekstra tid, kan oppleve å bli avbrutt i utførelsen av en oppgave uten varsel.'],
  '2.4.1': ['Nettstedet mangler funksjon for hoppe til hovedinnholdet. Årsaken er at våre retningslinjer for utforming ikke brukes. Tastaturbrukere kan oppleve sidene mer krevende med tanke på navigasjon.'],
  '2.4.2': ['Noen av nettsidene mangler en beskrivende tittel. Feilen er utilsiktet. Alle brukere skal på enkel måte kunne identifisere hvor de er og hva siden inneholder.'],
  '2.4.3': [
    'Forvirrende rekkefølge\n\nNoe navigasjon oppleves som forvirrende, for eksempel at fokus ikke følger tenkt leserekkefølge. Grunnen kan være koderekkefølge og/eller feil koding. Tastaturbrukere vil oppleve at navigeringen på nettsiden er forvirrende.',
    'Plassering av fokus\n\nNoen interaktive elementer setter ikke tastaturfokus til riktig sted. Feilen er utilsiktet. Tastaturbrukere vil oppleve at navigeringen på nettsiden er forvirrende.'
  ],
  '2.4.4': [
    'Lenkenavn\n\nNoen lenker har navn som ikke gir mening for brukerne i konteksten de brukes. Dette er utilsiktet. Det skal være enkelt å forstå hva formålet med lenkene er for alle brukere.',
    'Lenker til eksterne sider\n\nNoen lenker til eksterne sider gir ikke nok informasjon om hvor du sendes, noe som er utilsiktet og kan være forvirrende. Det skal være tydelig at du forlater det nåværende nettstedet når du velger slike lenker.',
    'Tomme lenker\n\nNoen lenker er tomme, selv om de kan være visuelt synlige på nettsiden. Dette er utilsiktet. Det skal være enkelt å forstå hva formålet med lenkene er for alle brukere.',
    'PDF\n\nVi har lenker til PDF-dokumenter som ikke er merket som det. Dette er utilsiktet. Brukerne skal være informert om at det lenkes til en annen filtype, som kan åpnes i en applikasjon utenfor nettleseren.'
  ],
  '2.4.5': ['Nettstedet mangler et ekstra alternativ for navigering mellom sidene. Dette er utilsiktet. Alle brukere skal enkelt kunne navigere mellom sidene, for eksempel ved hjelp av faste menyvalg og nettstedskart.'],
  '2.4.6': ['Vi har overskrifter og ledetekster som ikke tydelig beskriver tema eller hensikten med innholdet. Feilen er utilsiktet. Dette gjør det vanskelig for brukere å orientere seg og finne frem til relevant informasjon.'],
  '2.4.7': ['Ikke alle interaktive elementer følger krav om synlig fokusindikator. Årsaken kan være at elementet ikke følger våre retningslinjer for utforming. Tastaturbrukere vil oppleve utfordringer med å navigere på nettstedet.'],
  '2.5.3': ['Vi har elementer hvor det tilgjengelige navnet er i uoverensstemmelse med navnet som presenteres visuelt. Dette er utilsiktet. Brukere med hjelpemidler skal kunne støtte seg på det visuelle navnet for å utføre oppgaver.'],
  '3.1.1': ['Nettstedet mangler kode for hovedspråk. Dette er utilsiktet. Brukere som benytter talesyntese, vil kanskje få lest opp innholdet med feil uttale. Dette kan gjøre det krevende å forstå innholdet.'],
  '3.1.2': ['Vi har noe tekst på et annet språk enn hovedspråket på siden, hvor dette ikke er merket i koden. Feilen er utilsiktet. Brukere som benytter talesyntese, vil ikke kunne bytte syntese automatisk ved språkendring.'],
  '3.2.1': ['Det finnes enkelte tilfeller der fokus uventet flyttes til et annet sted på siden. Dette er utilsiktet og er ikke i tråd med våre retningslinjer for fokushåndtering. Denne typen feil kan være forvirrende for mange brukere, spesielt for synshemmede, tastaturbrukere og personer med kognitive utfordringer.'],
  '3.2.2': ['Det finnes skjemalementer som endrer konteksten uten at bruker er kjent med det eller får varsel om det. Feilen er utilsiktet. Endringen kan oppleves som uforutsigbar og forvirrende for mange brukere, spesielt for synshemmede, personer med motoriske vansker og personer med kognitive utfordringer.'],
  '3.3.1': ['Nettstedet oppfyller ikke alltid kravet til feilmeldinger i skjema. Dette er utilsiktet. Spesielt skjermleserbrukere vil oppleve utfordringer med å oppdage feilmeldingene som har dukket opp.'],
  '3.3.2': [
    'Ledetekster\n\nEnkelte skjemafelt på nettstedet har feil koding av ledetekst (label). Feilen er utilsiktet. Brukere med hjelpemidler kan oppleve feil eller forvirrende opplesing av feltets ledetekst.',
    'Obligatoriske felt\n\nNoen skjema mangler informasjon om obligatoriske felt. Dette er utilsiktet. Alle brukere skal få tydelig beskjed om alle felt er obligatoriske eller merket med stjernesymbol.',
    'Noen skjema mangler informasjon om visuell merking av obligatoriske felt. Dette er utilsiktet. Alle brukere skal få tydelig beskjed om hvordan påkrevde felt er merket.'
  ],
  '3.3.3': ['Enkelte feilmeldinger i tilknytning til skjemautfylling, har ikke gode nok løsningsforslag. Dette er utilsiktet. Konkrete forslag til hvordan feil kan løses, vil gagne alle brukere.'],
  '3.3.4': ['I enkelte skjema mangler det en mulighet for brukerne å bekrefte at opplysningene hen sender inn er korrekte. Dette er utilsiktet.'],
  '4.1.1': ['Duplikate ID-er\n\nNoen elementer på en nettside har samme id, som ikke er gyldig kode. Årsaken kan være kopiering av kode. Dette kan skape problemer for brukere med hjelpemidler, for eksempel skjermlesere.'],
  '4.1.2': [
    'Manglende koding for tilgjengelighet (ARIA)\n\nNoe innhold mangler eller har feil kode for tilgjengelighet. Dette er utilsiktet. Spesielt synshemmede vil ha problemer med å få med seg enkelte funksjoner og tilstander.',
    'Videoramme (iframe)\n\nEnkelte videoavspillere på nettstedet bruker en ramme uten navn, som ikke er gyldig kode. Feilen er utilsiktet. Skjermleserbrukere har behov for å få beskjed om hva rammen inneholder.'
  ],
  '4.1.3': ['Vi har relevant informasjon som dukker opp dynamisk på nettstedet og ikke er kodet riktig. Feilen er utilsiktet. Skjermleserbrukere vil ikke få med seg at informasjonen har dukket opp.']
};

export default function RapportGenerator(): React.JSX.Element {
  const baseUrl = useBaseUrl('/');
  const [rapportData, setRapportData] = useState<RapportData>({
    tittel: '',
    testdato: new Date().toISOString().split('T')[0],
    testetAv: '',
    testUrl: '',
    testbruker: '',
    versjon: '1.0',
    kommentar: '',
    sammendrag: '',
    wcagBrudd: [],
    forbedringsforslag: [],
    revisjoner: [],
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [ekspanderteBrudd, setEkspanderteBrudd] = useState<Set<string>>(new Set());
  const [autosaveStatus, setAutosaveStatus] = useState<'saved' | 'saving' | null>(null);
  const [visLagredeRapporter, setVisLagredeRapporter] = useState(false);
  const [lagredeRapporter, setLagredeRapporter] = useState<Array<{id: string, tittel: string, lagretNavn?: string, dato: string, data: RapportData}>>([]);
  const [navaerendeRapportId, setNavaerendeRapportId] = useState<string | null>(null);
  const [redigererNavn, setRedigererNavn] = useState<string | null>(null);
  const [nyttNavn, setNyttNavn] = useState<string>('');
  const [metadataApen, setMetadataApen] = useState<boolean>(true);
  const [sammendragApen, setSammendragApen] = useState<boolean>(true);
  const [visTilgjengelighetserklaring, setVisTilgjengelighetserklaring] = useState<boolean>(false);
  const [nyttBruddIdTilScroll, setNyttBruddIdTilScroll] = useState<string | null>(null);
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hent alle lagrede rapporter
  const hentLagredeRapporter = (): Array<{id: string, tittel: string, lagretNavn?: string, dato: string, data: RapportData}> => {
    try {
      const lagredeData = localStorage.getItem('uu-rapporter-liste');
      if (lagredeData) {
        return JSON.parse(lagredeData);
      }
    } catch (error) {
      console.error('Kunne ikke hente lagrede rapporter:', error);
    }
    return [];
  };

  // Lagre liste over rapporter
  const lagreRapporterListe = (rapporter: Array<{id: string, tittel: string, lagretNavn?: string, dato: string, data: RapportData}>) => {
    try {
      localStorage.setItem('uu-rapporter-liste', JSON.stringify(rapporter));
      setLagredeRapporter(rapporter);
    } catch (error) {
      console.error('Kunne ikke lagre rapporter-liste:', error);
    }
  };

  // Last inn liste over lagrede rapporter ved oppstart
  useEffect(() => {
    try {
      const rapporter = hentLagredeRapporter();
      if (rapporter.length > 0) {
        setLagredeRapporter(rapporter);
      }
    } catch (error) {
      console.error('Kunne ikke laste inn lagrede rapporter:', error);
    }
  }, []);

  // Scroll til nytt brudd når det er lagt til
  useEffect(() => {
    if (!nyttBruddIdTilScroll) return;
    
    const scrollToElement = (attempt: number = 0) => {
      // Prøv først å finne h3-elementet (tittelen)
      const h3Element = document.getElementById(`brudd-h3-${nyttBruddIdTilScroll}`);
      if (h3Element) {
        // Beregn posisjon manuelt for bedre kontroll
        const rect = h3Element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 100; // 100px offset fra toppen for å være mer synlig
        
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
        setNyttBruddIdTilScroll(null);
        return;
      }
      
      // Fallback til hele div-elementet hvis h3 ikke finnes
      const element = document.getElementById(`brudd-${nyttBruddIdTilScroll}`);
      if (element) {
        // Beregn posisjon manuelt for bedre kontroll
        const rect = element.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 100; // 100px offset fra toppen for å være mer synlig
        
        window.scrollTo({
          top: targetY,
          behavior: 'smooth'
        });
        setNyttBruddIdTilScroll(null);
        return;
      }
      
      // Prøv igjen hvis elementet ikke finnes ennå (maks 5 forsøk)
      if (attempt < 5) {
        setTimeout(() => {
          scrollToElement(attempt + 1);
        }, 100 * (attempt + 1));
      } else {
        // Hvis vi ikke finner elementet etter 5 forsøk, nullstill state
        setNyttBruddIdTilScroll(null);
      }
    };
    
    // Start scrolling etter en liten delay for å sikre at DOM er oppdatert
    // Bruk requestAnimationFrame for å vente til neste render-syklus
    let timer: NodeJS.Timeout | null = null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        timer = setTimeout(() => {
          scrollToElement(0);
        }, 100);
      });
    });
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [nyttBruddIdTilScroll, rapportData.wcagBrudd.length]);

  // Autosave når rapportData endres
  useEffect(() => {
    // Sjekk om det er noe data å lagre (ikke tom rapport)
    const hasData = rapportData.tittel || 
                    rapportData.wcagBrudd.length > 0 || 
                    rapportData.forbedringsforslag.length > 0 ||
                    rapportData.testetAv ||
                    rapportData.testUrl;

    if (!hasData) {
      setAutosaveStatus(null);
      // Hvis rapporten er tom, fjern den fra lagrede rapporter hvis den finnes
      if (navaerendeRapportId) {
        const rapporter = hentLagredeRapporter();
        const filtrerte = rapporter.filter(r => r.id !== navaerendeRapportId);
        lagreRapporterListe(filtrerte);
        setNavaerendeRapportId(null);
      }
      return; // Ikke lagre tom rapport
    }

    // Rydd opp tidligere timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    // Sett status til "saving"
    setAutosaveStatus('saving');

    // Lagre etter 2 sekunder uten endringer (debounce)
    autosaveTimeoutRef.current = setTimeout(() => {
      try {
        // Generer eller bruk eksisterende rapport-ID
        let rapportId = navaerendeRapportId;
        if (!rapportId) {
          rapportId = `rapport-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          setNavaerendeRapportId(rapportId);
        }

        // Hent eksisterende rapporter
        const rapporter = hentLagredeRapporter();
        
        // Opprett eller oppdater rapport
        const rapportTittel = rapportData.tittel || 'Uten tittel';
        const rapportDato = new Date().toISOString();
        
        const eksisterendeIndex = rapporter.findIndex(r => r.id === rapportId);
        const eksisterendeRapport = eksisterendeIndex >= 0 ? rapporter[eksisterendeIndex] : null;
        
        // Generer navn hvis det ikke finnes, eller oppdater hvis tittel er endret
        let lagretNavn = eksisterendeRapport?.lagretNavn;
        if (!lagretNavn) {
          // Bruk rapporttittel hvis den finnes, ellers generer navn basert på dato
          if (rapportData.tittel && rapportData.tittel !== 'Uten tittel') {
            lagretNavn = rapportData.tittel;
          } else {
            const dato = new Date();
            lagretNavn = `Rapport ${dato.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dato.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}`;
          }
        } else if (rapportData.tittel && rapportData.tittel !== 'Uten tittel') {
          // Oppdater lagretNavn hvis tittel er satt og ikke er "Uten tittel"
          // Sjekk om lagretNavn er et generert navn (starter med "Rapport " og har dato) eller om tittelen er endret
          const erGenerertNavn = lagretNavn && lagretNavn.startsWith('Rapport ') && lagretNavn.match(/\d{2}\.\d{2}\.\d{4}/);
          if (erGenerertNavn || rapportData.tittel !== eksisterendeRapport.tittel) {
            lagretNavn = rapportData.tittel;
          }
        }
        
        const rapportEntry = {
          id: rapportId,
          tittel: rapportTittel,
          lagretNavn: lagretNavn,
          dato: rapportDato,
          data: rapportData
        };

        if (eksisterendeIndex >= 0) {
          // Oppdater eksisterende rapport
          rapporter[eksisterendeIndex] = rapportEntry;
        } else {
          // Legg til ny rapport
          rapporter.push(rapportEntry);
        }

        // Sorter etter dato (nyeste først) og begrens til 20 siste
        rapporter.sort((a, b) => new Date(b.dato).getTime() - new Date(a.dato).getTime());
        const begrensedeRapporter = rapporter.slice(0, 20);

        // Lagre listen
        lagreRapporterListe(begrensedeRapporter);
        
        setAutosaveStatus('saved');
        // Fjern "saved"-status etter 3 sekunder
        setTimeout(() => setAutosaveStatus(null), 3000);
      } catch (error) {
        console.error('Autosave feilet:', error);
        setAutosaveStatus(null);
      }
    }, 2000);

    // Cleanup
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [rapportData, navaerendeRapportId]);

  // Generer unik ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // Legg til nytt WCAG-brudd
  const leggTilBrudd = () => {
    const nyttBrudd: WCAGBrudd = {
      id: generateId(),
      wcagKode: '',
      omrade: '',
      beskrivelse: '',
      tiltak: '',
      skjermbilder: [],
      status: 'Åpent',
      internKommentar: '',
    };
    setRapportData({
      ...rapportData,
      wcagBrudd: [...rapportData.wcagBrudd, nyttBrudd],
    });
    // Nye brudd skal være ekspandert som standard
    setEkspanderteBrudd(prev => new Set([...prev, nyttBrudd.id]));
    
    // Sett ID for å trigge scroll i useEffect
    // Bruk setTimeout for å sikre at state er oppdatert først
    setTimeout(() => {
      setNyttBruddIdTilScroll(nyttBrudd.id);
    }, 0);
  };

  // Toggle ekspandert/minimert for et brudd
  const toggleBruddEkspandert = (id: string) => {
    setEkspanderteBrudd(prev => {
      const nytt = new Set(prev);
      if (nytt.has(id)) {
        nytt.delete(id);
      } else {
        nytt.add(id);
      }
      return nytt;
    });
  };

  // Oppdater WCAG-brudd
  const oppdaterBrudd = (id: string, felt: keyof WCAGBrudd, verdi: any) => {
    setRapportData({
      ...rapportData,
      wcagBrudd: rapportData.wcagBrudd.map(brudd =>
        brudd.id === id ? { ...brudd, [felt]: verdi } : brudd
      ),
    });
  };

  // Slett WCAG-brudd
  const slettBrudd = (id: string) => {
    setRapportData({
      ...rapportData,
      wcagBrudd: rapportData.wcagBrudd.filter(brudd => brudd.id !== id),
    });
  };

  // Kopier WCAG-brudd
  const kopierBrudd = (id: string) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === id);
    if (brudd) {
      const kopiertBrudd: WCAGBrudd = {
        ...brudd,
        id: generateId(),
        status: 'Åpent' as WCAGStatus,
        internKommentar: '',
      };
      setRapportData({
        ...rapportData,
        wcagBrudd: [...rapportData.wcagBrudd, kopiertBrudd],
      });
      // Kopierte brudd skal være ekspandert som standard
      setEkspanderteBrudd(prev => new Set([...prev, kopiertBrudd.id]));
    }
  };

  // Lagre rapport manuelt (samme som autosave, men med bekreftelse)
  const lagreRapport = () => {
    try {
      const hasData = rapportData.tittel || 
                      rapportData.wcagBrudd.length > 0 || 
                      rapportData.forbedringsforslag.length > 0 ||
                      rapportData.testetAv ||
                      rapportData.testUrl;

      if (!hasData) {
        alert('Ingen data å lagre.');
        return;
      }

      // Generer eller bruk eksisterende rapport-ID
      let rapportId = navaerendeRapportId;
      if (!rapportId) {
        rapportId = `rapport-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setNavaerendeRapportId(rapportId);
      }

      // Hent eksisterende rapporter
      const rapporter = hentLagredeRapporter();
      
      // Opprett eller oppdater rapport
      const rapportTittel = rapportData.tittel || 'Uten tittel';
      const rapportDato = new Date().toISOString();
      
      const eksisterendeIndex = rapporter.findIndex(r => r.id === rapportId);
      const eksisterendeRapport = eksisterendeIndex >= 0 ? rapporter[eksisterendeIndex] : null;
      
      // Generer navn hvis det ikke finnes, eller oppdater hvis tittel er endret
      let lagretNavn = eksisterendeRapport?.lagretNavn;
      if (!lagretNavn) {
        // Bruk rapporttittel hvis den finnes, ellers generer navn basert på dato
        if (rapportData.tittel && rapportData.tittel !== 'Uten tittel') {
          lagretNavn = rapportData.tittel;
        } else {
          const dato = new Date();
          lagretNavn = `Rapport ${dato.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dato.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })}`;
        }
      } else if (rapportData.tittel && rapportData.tittel !== 'Uten tittel') {
        // Oppdater lagretNavn hvis tittel er satt og ikke er "Uten tittel"
        // Sjekk om lagretNavn er et generert navn (starter med "Rapport " og har dato) eller om tittelen er endret
        const erGenerertNavn = lagretNavn && lagretNavn.startsWith('Rapport ') && lagretNavn.match(/\d{2}\.\d{2}\.\d{4}/);
        if (erGenerertNavn || rapportData.tittel !== eksisterendeRapport.tittel) {
          lagretNavn = rapportData.tittel;
        }
      }
      
      const rapportEntry = {
        id: rapportId,
        tittel: rapportTittel,
        lagretNavn: lagretNavn,
        dato: rapportDato,
        data: rapportData
      };

      if (eksisterendeIndex >= 0) {
        rapporter[eksisterendeIndex] = rapportEntry;
      } else {
        rapporter.push(rapportEntry);
      }

      // Sorter etter dato og begrens til 20 siste
      rapporter.sort((a, b) => new Date(b.dato).getTime() - new Date(a.dato).getTime());
      const begrensedeRapporter = rapporter.slice(0, 20);

      lagreRapporterListe(begrensedeRapporter);
      alert('Rapport lagret!');
    } catch (error) {
      alert('Kunne ikke lagre rapport: ' + error);
    }
  };

  // Start ny rapport
  const startNyRapport = () => {
    if (confirm('Er du sikker på at du vil starte en ny rapport? Eventuelle endringer som ikke er lagret vil gå tapt.')) {
      setRapportData({
        tittel: '',
        testdato: new Date().toISOString().split('T')[0],
        testetAv: '',
        testUrl: '',
        testbruker: '',
        versjon: '1.0',
        kommentar: '',
        sammendrag: '',
        wcagBrudd: [],
        forbedringsforslag: [],
        revisjoner: [],
      });
      setNavaerendeRapportId(null);
      setEkspanderteBrudd(new Set());
      setMetadataApen(true);
      setSammendragApen(true);
      setVisTilgjengelighetserklaring(false);
      setAutosaveStatus(null);
      alert('Ny rapport startet!');
    }
  };

  // Last inn spesifikk rapport
  const lastInnRapport = (rapportId?: string) => {
    try {
      const rapporter = hentLagredeRapporter();
      
      if (rapporter.length === 0) {
        alert('Ingen lagrede rapporter funnet.');
        return;
      }

      // Hvis rapportId er gitt, last inn den spesifikke rapporten
      if (rapportId) {
        const rapport = rapporter.find(r => r.id === rapportId);
        if (rapport) {
          setRapportData(rapport.data);
          setNavaerendeRapportId(rapport.id);
          setVisLagredeRapporter(false);
          // Åpne metadata og sammendrag når rapport lastes inn
          setMetadataApen(true);
          setSammendragApen(true);
          alert('Rapport lastet inn!');
        } else {
          alert('Rapport ikke funnet.');
        }
        return;
      }

      // Hvis ingen rapportId, vis liste over rapporter
      setVisLagredeRapporter(true);
    } catch (error) {
      alert('Kunne ikke laste inn rapporter: ' + error);
    }
  };

  // Oppdater navn på lagret rapport
  const oppdaterRapportNavn = (rapportId: string, nyttNavn: string) => {
    try {
      const rapporter = hentLagredeRapporter();
      const rapportIndex = rapporter.findIndex(r => r.id === rapportId);
      
      if (rapportIndex >= 0) {
        rapporter[rapportIndex] = {
          ...rapporter[rapportIndex],
          lagretNavn: nyttNavn.trim() || undefined
        };
        lagreRapporterListe(rapporter);
        setRedigererNavn(null);
        setNyttNavn('');
      }
    } catch (error) {
      console.error('Kunne ikke oppdatere rapportnavn:', error);
    }
  };

  // Slett lagret rapport
  const slettLagretRapport = (rapportId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne rapporten?')) {
      return;
    }

    try {
      const rapporter = hentLagredeRapporter();
      const filtrerte = rapporter.filter(r => r.id !== rapportId);
      lagreRapporterListe(filtrerte);
      
      // Hvis vi sletter den nåværende rapporten, nullstill skjemaet
      if (rapportId === navaerendeRapportId) {
        setRapportData({
          tittel: '',
          testdato: new Date().toISOString().split('T')[0],
          testetAv: '',
          testUrl: '',
          testbruker: '',
          versjon: '1.0',
          kommentar: '',
          sammendrag: '',
          wcagBrudd: [],
          forbedringsforslag: [],
          revisjoner: [],
        });
        setNavaerendeRapportId(null);
      }
      
      alert('Rapport slettet!');
    } catch (error) {
      alert('Kunne ikke slette rapport: ' + error);
    }
  };

  // Importer rapport fra JSON-fil
  const importerRapport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const data = JSON.parse(reader.result as string);
          setRapportData(data);
          // Åpne metadata og sammendrag når rapport importeres
          setMetadataApen(true);
          setSammendragApen(true);
          alert('Rapport importert!');
        } catch (error) {
          alert('Kunne ikke importere rapport: ' + error);
        }
      };
      reader.readAsText(file);
    }
  };

  // Kopier brudd fra importert rapport (kan brukes senere for å vise importerte brudd)
  const kopierBruddFraImportert = (brudd: WCAGBrudd) => {
    const kopiertBrudd: WCAGBrudd = {
      ...brudd,
      id: generateId(),
      status: 'Åpent' as WCAGStatus,
      internKommentar: '',
    };
    setRapportData({
      ...rapportData,
      wcagBrudd: [...rapportData.wcagBrudd, kopiertBrudd],
    });
  };

  // Eksporter rapport som JSON
  const eksporterTilJSON = () => {
    try {
      const data = JSON.stringify(rapportData, null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uu-rapport-${rapportData.tittel || 'rapport'}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Kunne ikke eksportere rapport: ' + error);
    }
  };

  // Legg til forbedringsforslag
  const leggTilForbedringsforslag = () => {
    const nyttForslag: Forbedringsforslag = {
      id: generateId(),
      skjermbilder: [],
    };
    setRapportData({
      ...rapportData,
      forbedringsforslag: [...rapportData.forbedringsforslag, nyttForslag],
    });
  };

  // Oppdater forbedringsforslag
  const oppdaterForbedringsforslag = (id: string, felt: keyof Forbedringsforslag, verdi: any) => {
    setRapportData({
      ...rapportData,
      forbedringsforslag: rapportData.forbedringsforslag.map(forslag =>
        forslag.id === id ? { ...forslag, [felt]: verdi } : forslag
      ),
    });
  };

  // Legg til tekst i skjermbilder-array for forbedringsforslag
  const leggTilForbedringsforslagSkjermbildeTekst = (forslagId: string) => {
    const forslag = rapportData.forbedringsforslag.find(f => f.id === forslagId);
    if (forslag) {
      const nyttElement: SkjermbildeElement = {
        id: generateId(),
        type: 'text',
        content: '',
      };
      const oppdaterteSkjermbilder = [...forslag.skjermbilder, nyttElement];
      oppdaterForbedringsforslag(forslagId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Legg til bilde i skjermbilder-array for forbedringsforslag
  const leggTilForbedringsforslagSkjermbildeBilde = (forslagId: string, imageData: string) => {
    const forslag = rapportData.forbedringsforslag.find(f => f.id === forslagId);
    if (forslag) {
      // Beregn opprinnelige dimensjoner
      const img = new Image();
      img.onload = () => {
        const opprinneligBredde = img.naturalWidth;
        const opprinneligHoyde = img.naturalHeight;
        // Standard størrelse for Word (600px bredde, proporsjonal høyde)
        const standardBredde = 600;
        const standardHoyde = Math.round((standardBredde / opprinneligBredde) * opprinneligHoyde);
        
        const forslagOppdatert = rapportData.forbedringsforslag.find(f => f.id === forslagId);
        if (forslagOppdatert) {
          const element = forslagOppdatert.skjermbilder.find(el => el.content === imageData && !el.width);
          if (element) {
            oppdaterForbedringsforslagSkjermbildeElement(forslagId, element.id, imageData, standardBredde, standardHoyde, opprinneligBredde, opprinneligHoyde);
          }
        }
      };
      img.src = imageData;
      
      const nyttElement: SkjermbildeElement = {
        id: generateId(),
        type: 'image',
        content: imageData,
        width: 600,
        height: 400,
      };
      const oppdaterteSkjermbilder = [...forslag.skjermbilder, nyttElement];
      oppdaterForbedringsforslag(forslagId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Oppdater skjermbilde-element for forbedringsforslag
  const oppdaterForbedringsforslagSkjermbildeElement = (forslagId: string, elementId: string, content: string, width?: number, height?: number, originalWidth?: number, originalHeight?: number) => {
    const forslag = rapportData.forbedringsforslag.find(f => f.id === forslagId);
    if (forslag) {
      const oppdaterteSkjermbilder = forslag.skjermbilder.map(el => {
        if (el.id === elementId) {
          const oppdatert: SkjermbildeElement = { ...el, content };
          if (width !== undefined && height !== undefined) {
            oppdatert.width = width;
            oppdatert.height = height;
          }
          if (originalWidth !== undefined && originalHeight !== undefined) {
            oppdatert.originalWidth = originalWidth;
            oppdatert.originalHeight = originalHeight;
          }
          return oppdatert;
        }
        return el;
      });
      oppdaterForbedringsforslag(forslagId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Flytt skjermbilde-element opp for forbedringsforslag
  const flyttForbedringsforslagSkjermbildeOpp = (forslagId: string, elementId: string) => {
    const forslag = rapportData.forbedringsforslag.find(f => f.id === forslagId);
    if (forslag) {
      const index = forslag.skjermbilder.findIndex(el => el.id === elementId);
      if (index > 0) {
        const oppdaterteSkjermbilder = [...forslag.skjermbilder];
        [oppdaterteSkjermbilder[index - 1], oppdaterteSkjermbilder[index]] = 
          [oppdaterteSkjermbilder[index], oppdaterteSkjermbilder[index - 1]];
        oppdaterForbedringsforslag(forslagId, 'skjermbilder', oppdaterteSkjermbilder);
      }
    }
  };

  // Flytt skjermbilde-element ned for forbedringsforslag
  const flyttForbedringsforslagSkjermbildeNed = (forslagId: string, elementId: string) => {
    const forslag = rapportData.forbedringsforslag.find(f => f.id === forslagId);
    if (forslag) {
      const index = forslag.skjermbilder.findIndex(el => el.id === elementId);
      if (index < forslag.skjermbilder.length - 1) {
        const oppdaterteSkjermbilder = [...forslag.skjermbilder];
        [oppdaterteSkjermbilder[index], oppdaterteSkjermbilder[index + 1]] = 
          [oppdaterteSkjermbilder[index + 1], oppdaterteSkjermbilder[index]];
        oppdaterForbedringsforslag(forslagId, 'skjermbilder', oppdaterteSkjermbilder);
      }
    }
  };

  // Slett skjermbilde-element for forbedringsforslag
  const slettForbedringsforslagSkjermbildeElement = (forslagId: string, elementId: string) => {
    const forslag = rapportData.forbedringsforslag.find(f => f.id === forslagId);
    if (forslag) {
      const oppdaterteSkjermbilder = forslag.skjermbilder.filter(el => el.id !== elementId);
      oppdaterForbedringsforslag(forslagId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Håndter paste av bilder for forbedringsforslag
  const handleForbedringsforslagPaste = (event: React.ClipboardEvent, forslagId: string) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const imageData = reader.result as string;
            leggTilForbedringsforslagSkjermbildeBilde(forslagId, imageData);
          };
          reader.readAsDataURL(blob);
          event.preventDefault();
          break;
        }
      }
    }
  };

  // Slett forbedringsforslag
  const slettForbedringsforslag = (id: string) => {
    setRapportData({
      ...rapportData,
      forbedringsforslag: rapportData.forbedringsforslag.filter(forslag => forslag.id !== id),
    });
  };

  // Legg til tekst i skjermbilder-array
  const leggTilSkjermbildeTekst = (bruddId: string) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === bruddId);
    if (brudd) {
      const nyttElement: SkjermbildeElement = {
        id: generateId(),
        type: 'text',
        content: '',
      };
      const oppdaterteSkjermbilder = [...brudd.skjermbilder, nyttElement];
      oppdaterBrudd(bruddId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Legg til bilde i skjermbilder-array
  const leggTilSkjermbildeBilde = (bruddId: string, imageData: string) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === bruddId);
    if (brudd) {
      // Beregn opprinnelige dimensjoner
      const img = new Image();
      img.onload = () => {
        const opprinneligBredde = img.naturalWidth;
        const opprinneligHoyde = img.naturalHeight;
        // Standard størrelse for Word (600px bredde, proporsjonal høyde)
        const standardBredde = 600;
        const standardHoyde = Math.round((standardBredde / opprinneligBredde) * opprinneligHoyde);
        
        const bruddOppdatert = rapportData.wcagBrudd.find(b => b.id === bruddId);
        if (bruddOppdatert) {
          const element = bruddOppdatert.skjermbilder.find(el => el.content === imageData && !el.width);
          if (element) {
            oppdaterSkjermbildeElement(bruddId, element.id, imageData, standardBredde, standardHoyde, opprinneligBredde, opprinneligHoyde);
          }
        }
      };
      img.src = imageData;
      
      const nyttElement: SkjermbildeElement = {
        id: generateId(),
        type: 'image',
        content: imageData,
        width: 600, // Standard bredde
        height: 400, // Midlertidig høyde, oppdateres når bildet lastes
      };
      const oppdaterteSkjermbilder = [...brudd.skjermbilder, nyttElement];
      oppdaterBrudd(bruddId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Oppdater tekst i skjermbilde-element
  const oppdaterSkjermbildeElement = (bruddId: string, elementId: string, content: string, width?: number, height?: number, originalWidth?: number, originalHeight?: number) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === bruddId);
    if (brudd) {
      const oppdaterteSkjermbilder = brudd.skjermbilder.map(el => {
        if (el.id === elementId) {
          const oppdatert: SkjermbildeElement = { ...el, content };
          if (width !== undefined && height !== undefined) {
            oppdatert.width = width;
            oppdatert.height = height;
          }
          if (originalWidth !== undefined && originalHeight !== undefined) {
            oppdatert.originalWidth = originalWidth;
            oppdatert.originalHeight = originalHeight;
          }
          return oppdatert;
        }
        return el;
      });
      oppdaterBrudd(bruddId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Flytt skjermbilde-element opp
  const flyttSkjermbildeOpp = (bruddId: string, elementId: string) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === bruddId);
    if (brudd) {
      const index = brudd.skjermbilder.findIndex(el => el.id === elementId);
      if (index > 0) {
        const oppdaterteSkjermbilder = [...brudd.skjermbilder];
        [oppdaterteSkjermbilder[index - 1], oppdaterteSkjermbilder[index]] = 
          [oppdaterteSkjermbilder[index], oppdaterteSkjermbilder[index - 1]];
        oppdaterBrudd(bruddId, 'skjermbilder', oppdaterteSkjermbilder);
      }
    }
  };

  // Flytt skjermbilde-element ned
  const flyttSkjermbildeNed = (bruddId: string, elementId: string) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === bruddId);
    if (brudd) {
      const index = brudd.skjermbilder.findIndex(el => el.id === elementId);
      if (index < brudd.skjermbilder.length - 1) {
        const oppdaterteSkjermbilder = [...brudd.skjermbilder];
        [oppdaterteSkjermbilder[index], oppdaterteSkjermbilder[index + 1]] = 
          [oppdaterteSkjermbilder[index + 1], oppdaterteSkjermbilder[index]];
        oppdaterBrudd(bruddId, 'skjermbilder', oppdaterteSkjermbilder);
      }
    }
  };

  // Slett skjermbilde-element
  const slettSkjermbildeElement = (bruddId: string, elementId: string) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === bruddId);
    if (brudd) {
      const oppdaterteSkjermbilder = brudd.skjermbilder.filter(el => el.id !== elementId);
      oppdaterBrudd(bruddId, 'skjermbilder', oppdaterteSkjermbilder);
    }
  };

  // Håndter bildeopplasting
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>, bruddId: string) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const imageData = reader.result as string;
        leggTilSkjermbildeBilde(bruddId, imageData);
      };
      reader.readAsDataURL(file);
    }
  };

  // Håndter paste av bilder
  const handlePaste = (event: React.ClipboardEvent, bruddId: string) => {
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const imageData = reader.result as string;
            leggTilSkjermbildeBilde(bruddId, imageData);
          };
          reader.readAsDataURL(blob);
          event.preventDefault();
          break;
        }
      }
    }
  };

  // Vis bilde i lightbox
  const visBilde = (imageData: string) => {
    setImagePreview(imageData);
    setSelectedImage(imageData);
  };

  // Lukk lightbox
  const lukkBilde = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Beregn sammendrag
  const antallBrudd = rapportData.wcagBrudd.length;
  const antallForbedringer = rapportData.forbedringsforslag.length;
  const antallAapneBrudd = rapportData.wcagBrudd.filter(b => b.status === 'Åpent').length;
  const antallLukkedeBrudd = rapportData.wcagBrudd.filter(b => b.status === 'Lukket').length;

  // Autogenerer sammendrag basert på bruddene
  const genererSammendrag = (): string => {
    if (rapportData.wcagBrudd.length === 0) {
      return 'Ingen brudd registrert ennå.';
    }

    const aapneBrudd = rapportData.wcagBrudd.filter(b => b.status === 'Åpent');
    const lukkedeBrudd = rapportData.wcagBrudd.filter(b => b.status === 'Lukket');
    
    let tekst = `Rapporten viser ${antallBrudd} WCAG-brudd totalt. `;
    
    if (aapneBrudd.length > 0) {
      tekst += `${aapneBrudd.length} brudd er fortsatt åpne og krever tiltak. `;
      
      // Grupper brudd etter WCAG-kriterium
      const bruddPerKriterium: { [key: string]: number } = {};
      aapneBrudd.forEach(brudd => {
        if (brudd.wcagKode) {
          const kode = brudd.wcagKode.split(' ')[0];
          bruddPerKriterium[kode] = (bruddPerKriterium[kode] || 0) + 1;
        }
      });
      
      const hyppigsteKriterier = Object.entries(bruddPerKriterium)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kode]) => kode);
      
      if (hyppigsteKriterier.length > 0) {
        tekst += `De hyppigste bruddene er relatert til kriteriene: ${hyppigsteKriterier.join(', ')}. `;
      }
    }
    
    if (lukkedeBrudd.length > 0) {
      tekst += `${lukkedeBrudd.length} brudd er lukket. `;
    }
    
    if (rapportData.forbedringsforslag.length > 0) {
      tekst += `Det er også ${antallForbedringer} forbedringsforslag registrert. `;
    }
    
    tekst += 'Se detaljerte beskrivelser under hvert brudd.';
    
    return tekst;
  };

  // Oppdater sammendrag med autogenerert tekst
  const oppdaterSammendrag = () => {
    const autogenerert = genererSammendrag();
    setRapportData({
      ...rapportData,
      sammendrag: autogenerert,
    });
  };

  // Generer tilgjengelighetserklæring basert på WCAG-brudd
  const tilgjengelighetserklaring = rapportData.wcagBrudd
    .filter(brudd => brudd.status === 'Åpent' && brudd.wcagKode) // Kun åpne brudd med WCAG-kode
    .map(brudd => {
      const wcagKode = brudd.wcagKode.split(' ')[0]; // Hent kun koden (f.eks. "1.3.1")
      return {
        kriterium: wcagKode,
        beskrivelse: brudd.beskrivelse || 'Ingen beskrivelse',
        kommentar: brudd.tiltak || 'Ingen kommentar',
        status: 'Ikke godkjent',
      };
    });

  // Legg til revisjon
  const leggTilRevisjon = (endringstype: string, kommentar: string) => {
    const nyRevisjon: Revisjon = {
      dato: new Date().toLocaleDateString('nb-NO'),
      endretAv: rapportData.testetAv || 'Ukjent',
      endringstype,
      kommentar,
    };
    setRapportData({
      ...rapportData,
      revisjoner: [...rapportData.revisjoner, nyRevisjon],
    });
  };

  // Automatisk revisjon når brudd endres
  const oppdaterBruddMedRevisjon = (id: string, felt: keyof WCAGBrudd, verdi: any) => {
    const brudd = rapportData.wcagBrudd.find(b => b.id === id);
    if (brudd && felt === 'status' && brudd.status !== verdi) {
      leggTilRevisjon(
        `Endret status for brudd ${brudd.wcagKode || 'ukjent'}`,
        `Status endret fra "${brudd.status}" til "${verdi}"`
      );
    }
    oppdaterBrudd(id, felt, verdi);
  };

  // Hjelpefunksjon for å konvertere base64 til ArrayBuffer
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64.split(',')[1] || base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Eksporter til Word
  const eksporterTilWord = async () => {
    try {
      const children: (DocxParagraph | DocxTable)[] = [];

      // H1: Tittel
      if (rapportData.tittel) {
        children.push(
          new DocxParagraph({
            text: rapportData.tittel,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 240 },
          })
        );
      }

      // Metadata-seksjon
      if (rapportData.testdato) {
        children.push(
          new DocxParagraph({
            text: `Testdato: ${rapportData.testdato}`,
            spacing: { after: 120 },
          })
        );
      }
      if (rapportData.testetAv) {
        children.push(
          new DocxParagraph({
            text: `Testet av: ${rapportData.testetAv}`,
            spacing: { after: 120 },
          })
        );
      }
      if (rapportData.testUrl) {
        children.push(
          new DocxParagraph({
            children: [
              new TextRun('Test-URL: '),
              new ExternalHyperlink({
                children: [new TextRun({ text: rapportData.testUrl, style: 'Hyperlink' })],
                link: rapportData.testUrl,
              }),
            ],
            spacing: { after: 120 },
          })
        );
      }
      if (rapportData.testbruker) {
        children.push(
          new DocxParagraph({
            text: `Testbruker: ${rapportData.testbruker}`,
            spacing: { after: 120 },
          })
        );
      }
      if (rapportData.versjon) {
        children.push(
          new DocxParagraph({
            text: `Versjon: ${rapportData.versjon}`,
            spacing: { after: 120 },
          })
        );
      }
      if (rapportData.kommentar) {
        children.push(
          new DocxParagraph({
            text: `Kommentar: ${rapportData.kommentar}`,
            spacing: { after: 240 },
          })
        );
      }

      // H2: Sammendrag
      children.push(
        new DocxParagraph({
          text: 'Sammendrag',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );

      const antallBrudd = rapportData.wcagBrudd.filter(b => b.status === 'Åpent').length;
      const antallForbedringsforslag = rapportData.forbedringsforslag.length;
      
      children.push(
        new DocxParagraph({
          text: `Antall WCAG-brudd: ${antallBrudd}`,
          spacing: { after: 60 },
        })
      );
      children.push(
        new DocxParagraph({
          text: `Antall forbedringsforslag: ${antallForbedringsforslag}`,
          spacing: { after: 120 },
        })
      );

      if (rapportData.sammendrag) {
        children.push(
          new DocxParagraph({
            text: rapportData.sammendrag,
            spacing: { after: 240 },
          })
        );
      }

      // H2: WCAG-brudd
      if (rapportData.wcagBrudd.length > 0) {
        children.push(
          new DocxParagraph({
            text: 'WCAG-brudd',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );

        rapportData.wcagBrudd.forEach((brudd, index) => {
          // H3: Brudd #X
          children.push(
            new DocxParagraph({
              text: `Brudd #${index + 1}`,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 180, after: 120 },
            })
          );

          // WCAG-kriterium
          if (brudd.wcagKode) {
            // Hent kun koden (f.eks. "1.4.1") og navnet separat for å unngå duplisering
            const wcagKodeParts = brudd.wcagKode.split(' ');
            const kode = wcagKodeParts[0]; // Første del er koden
            const navn = wcagKodeParts.slice(1).join(' '); // Resten er navnet
            
            children.push(
              new DocxParagraph({
                children: [
                  new TextRun({ text: 'WCAG-kriterium: ', bold: true }),
                  new TextRun(kode + (navn ? ' ' + navn : '')),
                ],
                spacing: { after: 60 },
              })
            );
          }

          // Status
          children.push(
            new DocxParagraph({
              children: [
                new TextRun({ text: 'Status: ', bold: true }),
                new TextRun(brudd.status),
              ],
              spacing: { after: 60 },
            })
          );

          // Område / tittel
          if (brudd.omrade) {
            children.push(
              new DocxParagraph({
                children: [
                  new TextRun({ text: 'Område / tittel: ', bold: true }),
                  new TextRun(brudd.omrade),
                ],
                spacing: { after: 60 },
              })
            );
          }

          // Beskrivelse av brudd
          if (brudd.beskrivelse) {
            children.push(
              new DocxParagraph({
                children: [
                  new TextRun({ text: 'Beskrivelse av brudd: ', bold: true }),
                ],
                spacing: { after: 60 },
              })
            );
            children.push(
              new DocxParagraph({
                text: brudd.beskrivelse,
                spacing: { after: 60 },
              })
            );
          }

          // Tiltak / anbefaling
          if (brudd.tiltak) {
            children.push(
              new DocxParagraph({
                children: [
                  new TextRun({ text: 'Tiltak / anbefaling: ', bold: true }),
                  new TextRun(brudd.tiltak),
                ],
                spacing: { after: 60 },
              })
            );
          }

          // Skjermbilder og beskrivelser
          if (brudd.skjermbilder && brudd.skjermbilder.length > 0) {
            brudd.skjermbilder.forEach((element) => {
              if (element.type === 'text') {
                // Legg til tekst
                if (element.content.trim()) {
                  // Konverter lenker i tekst til klikkbare lenker
                  const tekstParts = element.content.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
                  const tekstChildren: any[] = [];
                  tekstParts.forEach((part) => {
                    if (part.match(/^https?:\/\//) || part.match(/^www\./)) {
                      const url = part.match(/^www\./) ? `https://${part}` : part;
                      tekstChildren.push(
                        new ExternalHyperlink({
                          children: [new TextRun({ text: part, style: 'Hyperlink' })],
                          link: url,
                        })
                      );
                    } else if (part.trim()) {
                      tekstChildren.push(new TextRun(part));
                    }
                  });
                  children.push(
                    new DocxParagraph({
                      children: tekstChildren,
                      spacing: { after: 120 },
                    })
                  );
                }
              } else if (element.type === 'image') {
                // Legg til bilde
                try {
                  const imageBuffer = base64ToArrayBuffer(element.content);
                  // Hent bildeformat fra base64 string
                  const imageFormat = element.content.includes('data:image/png') ? 'png' : 
                                     element.content.includes('data:image/jpeg') || element.content.includes('data:image/jpg') ? 'jpg' : 
                                     element.content.includes('data:image/gif') ? 'gif' : 'png';
                  
                  // Bruk originalstørrelse hvis tilgjengelig for å bevare kvalitet
                  // Hvis originalstørrelse ikke er lagret, bruk visningsdimensjoner
                  // Viktig: Bruk originalstørrelse for å unngå kvalitetstap ved oppskalering
                  const originalWidth = element.originalWidth || element.width || 600;
                  const originalHeight = element.originalHeight || element.height || 400;
                  
                  // Bruk originalstørrelse for best kvalitet i Word
                  const width = originalWidth;
                  const height = originalHeight;
                  
                  children.push(
                    new DocxParagraph({
                      children: [
                        new ImageRun({
                          data: imageBuffer,
                          transformation: {
                            width: width,
                            height: height,
                          },
                          type: imageFormat as 'png' | 'jpg' | 'gif',
                        }),
                      ],
                      spacing: { after: 120 },
                      alignment: AlignmentType.LEFT,
                    })
                  );
                } catch (error) {
                  console.error('Kunne ikke legge til bilde:', error);
                  // Legg til en tekst i stedet hvis bilde ikke kan lastes
                  children.push(
                    new DocxParagraph({
                      text: '[Skjermbilde kunne ikke inkluderes]',
                      spacing: { after: 120 },
                    })
                  );
                }
              }
            });
          }
        });
      }

      // H2: Forbedringsforslag
      if (rapportData.forbedringsforslag.length > 0) {
        children.push(
          new DocxParagraph({
            text: 'Forbedringsforslag',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );

        rapportData.forbedringsforslag.forEach((forslag, index) => {
          children.push(
            new DocxParagraph({
              text: `Forbedringsforslag ${index + 1}`,
              spacing: { before: 120, after: 60 },
            })
          );

          // Skjermbilder og beskrivelser
          if (forslag.skjermbilder && forslag.skjermbilder.length > 0) {
            forslag.skjermbilder.forEach((element) => {
              if (element.type === 'text') {
                // Legg til tekst
                if (element.content.trim()) {
                  // Konverter lenker i tekst til klikkbare lenker
                  const tekstParts = element.content.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g);
                  const tekstChildren: any[] = [];
                  tekstParts.forEach((part) => {
                    if (part.match(/^https?:\/\//) || part.match(/^www\./)) {
                      const url = part.match(/^www\./) ? `https://${part}` : part;
                      tekstChildren.push(
                        new ExternalHyperlink({
                          children: [new TextRun({ text: part, style: 'Hyperlink' })],
                          link: url,
                        })
                      );
                    } else if (part.trim()) {
                      tekstChildren.push(new TextRun(part));
                    }
                  });
                  children.push(
                    new DocxParagraph({
                      children: tekstChildren,
                      spacing: { after: 120 },
                    })
                  );
                }
              } else if (element.type === 'image') {
                // Legg til bilde
                try {
                  const imageBuffer = base64ToArrayBuffer(element.content);
                  // Hent bildeformat fra base64 string
                  const imageFormat = element.content.includes('data:image/png') ? 'png' : 
                                     element.content.includes('data:image/jpeg') || element.content.includes('data:image/jpg') ? 'jpg' : 
                                     element.content.includes('data:image/gif') ? 'gif' : 'png';
                  
                  // Bruk originalstørrelse hvis tilgjengelig for å bevare kvalitet
                  // Hvis originalstørrelse ikke er lagret, bruk visningsdimensjoner
                  // Viktig: Bruk originalstørrelse for å unngå kvalitetstap ved oppskalering
                  const originalWidth = element.originalWidth || element.width || 600;
                  const originalHeight = element.originalHeight || element.height || 400;
                  
                  // Bruk originalstørrelse for best kvalitet i Word
                  const width = originalWidth;
                  const height = originalHeight;
                  
                  children.push(
                    new DocxParagraph({
                      children: [
                        new ImageRun({
                          data: imageBuffer,
                          transformation: {
                            width: width,
                            height: height,
                          },
                          type: imageFormat as 'png' | 'jpg' | 'gif',
                        }),
                      ],
                      spacing: { after: 120 },
                      alignment: AlignmentType.LEFT,
                    })
                  );
                } catch (error) {
                  console.error('Kunne ikke legge til bilde:', error);
                  // Legg til en tekst i stedet hvis bilde ikke kan lastes
                  children.push(
                    new DocxParagraph({
                      text: '[Skjermbilde kunne ikke inkluderes]',
                      spacing: { after: 120 },
                    })
                  );
                }
              }
            });
          }
        });
      }

      // H2: Tilgjengelighetserklæring
      const aapneBrudd = rapportData.wcagBrudd.filter(b => b.status === 'Åpent');
      if (aapneBrudd.length > 0) {
        children.push(
          new DocxParagraph({
            text: 'Tilgjengelighetserklæring',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );

        // Tabell for tilgjengelighetserklæring
        const tableRows = [
          new TableRow({
            children: [
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'WCAG-kriterium', bold: true })] })],
              }),
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'Beskrivelse', bold: true })] })],
              }),
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'Kommentar', bold: true })] })],
              }),
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'Status', bold: true })] })],
              }),
            ],
          }),
        ];

        aapneBrudd.forEach(brudd => {
          // Hent kun WCAG-koden (f.eks. "1.3.1") fra hele strengen
          const wcagKode = brudd.wcagKode ? brudd.wcagKode.split(' ')[0] : '';
          
          tableRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [new DocxParagraph(wcagKode)],
                }),
                new TableCell({
                  children: [new DocxParagraph(brudd.beskrivelse || 'Ingen beskrivelse')],
                }),
                new TableCell({
                  children: [new DocxParagraph(brudd.tiltak || 'Ingen kommentar')],
                }),
                new TableCell({
                  children: [new DocxParagraph('Ikke godkjent')],
                }),
              ],
            })
          );
        });

        children.push(
          new DocxTable({
            rows: tableRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnWidths: [1440, 2520, 2160, 1080], // Kolonnebredder i twips (1/20 av en punkt)
          })
        );
      }

      // H2: Revisjonshistorikk
      if (rapportData.revisjoner.length > 0) {
        children.push(
          new DocxParagraph({
            text: 'Revisjonshistorikk',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 },
          })
        );

        const revisjonRows = [
          new TableRow({
            children: [
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'Dato', bold: true })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'Endret av', bold: true })] })],
                width: { size: 20, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'Endringstype', bold: true })] })],
                width: { size: 25, type: WidthType.PERCENTAGE },
              }),
              new TableCell({
                children: [new DocxParagraph({ children: [new TextRun({ text: 'Kommentar', bold: true })] })],
                width: { size: 35, type: WidthType.PERCENTAGE },
              }),
            ],
          }),
        ];

        rapportData.revisjoner.forEach(revisjon => {
          revisjonRows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [new DocxParagraph(revisjon.dato)],
                  width: { size: 20, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new DocxParagraph(revisjon.endretAv)],
                  width: { size: 20, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new DocxParagraph(revisjon.endringstype)],
                  width: { size: 25, type: WidthType.PERCENTAGE },
                }),
                new TableCell({
                  children: [new DocxParagraph(revisjon.kommentar || '')],
                  width: { size: 35, type: WidthType.PERCENTAGE },
                }),
              ],
            })
          );
        });

        children.push(
          new DocxTable({
            rows: revisjonRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }

      // Opprett dokument
      const doc = new Document({
        sections: [{
          children: children,
        }],
      });

      // Generer og last ned
      const blob = await Packer.toBlob(doc);
      const filnavn = `uu-rapport-${rapportData.tittel || 'rapport'}-${new Date().toISOString().split('T')[0]}.docx`;
      
      // Last ned lokalt
      saveAs(blob, filnavn);
      
      // Last opp til Firebase hvis bruker er innlogget
      try {
        const authInstance = getAuthInstance();
        const dbInstance = getDbInstance();
        const storageInstance = getStorageInstance();
        const currentUser = authInstance.currentUser;
        
        if (currentUser) {
          try {
            // Sjekk om det allerede finnes en rapport med samme metadata
            const rapportTittel = rapportData.tittel || 'Uten tittel';
            const rapportQuery = query(
              collection(dbInstance, 'rapporter'),
              where('tittel', '==', rapportTittel),
              where('testdato', '==', rapportData.testdato),
              where('testUrl', '==', rapportData.testUrl),
              where('testetAv', '==', rapportData.testetAv),
              where('opprettetAv', '==', currentUser.email)
            );
            
            const eksisterendeRapporter = await getDocs(rapportQuery);
            
            // Last opp fil til Firebase Storage
            const storageRef = ref(storageInstance, `rapporter/${currentUser.uid}/${Date.now()}-${filnavn}`);
            await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(storageRef);
            
            if (!eksisterendeRapporter.empty) {
              // Oppdater eksisterende rapport
              const eksisterendeRapport = eksisterendeRapporter.docs[0];
              await updateDoc(firestoreDoc(dbInstance, 'rapporter', eksisterendeRapport.id), {
              versjon: rapportData.versjon,
              kommentar: rapportData.kommentar,
              antallBrudd: rapportData.wcagBrudd.length,
              antallAapneBrudd: rapportData.wcagBrudd.filter(b => b.status === 'Åpent').length,
              antallForbedringsforslag: rapportData.forbedringsforslag.length,
              filUrl: downloadURL,
              filnavn: filnavn,
              oppdatert: serverTimestamp(),
            });
            
            // Slett gammel fil fra Storage hvis den finnes
            const gammelFilUrl = eksisterendeRapport.data().filUrl;
            if (gammelFilUrl && gammelFilUrl !== downloadURL) {
              try {
                const gammelFilRef = ref(storageInstance, gammelFilUrl);
                await deleteObject(gammelFilRef);
              } catch (deleteError) {
                console.warn('Kunne ikke slette gammel fil:', deleteError);
                // Fortsett selv om sletting av gammel fil feiler
              }
            }
            
            alert('Rapport eksportert og oppdatert i arkivet!');
          } else {
            // Lag ny rapport
            await addDoc(collection(dbInstance, 'rapporter'), {
              tittel: rapportTittel,
              testdato: rapportData.testdato,
              testetAv: rapportData.testetAv,
              testUrl: rapportData.testUrl,
              testbruker: rapportData.testbruker,
              versjon: rapportData.versjon,
              kommentar: rapportData.kommentar,
              antallBrudd: rapportData.wcagBrudd.length,
              antallAapneBrudd: rapportData.wcagBrudd.filter(b => b.status === 'Åpent').length,
              antallForbedringsforslag: rapportData.forbedringsforslag.length,
              filUrl: downloadURL,
              filnavn: filnavn,
              opprettetAv: currentUser.email,
              opprettet: serverTimestamp(),
            });
            
            alert('Rapport eksportert og lagret i arkivet!');
          }
          } catch (firebaseError) {
            console.error('Feil ved opplasting til Firebase:', firebaseError);
            // Fortsett selv om Firebase-opplasting feiler
            alert('Rapport eksportert lokalt, men kunne ikke lagre i arkivet. Se konsollen for detaljer.');
          }
        } else {
          // Bruker er ikke logget inn - vis melding om at filen er lastet ned lokalt
          alert('Rapport eksportert lokalt. Logg inn for å lagre i arkivet.');
        }
      } catch (error) {
        console.error('Feil ved Firebase-oppsett:', error);
        // Fortsett selv om Firebase-oppsett feiler
      }
    } catch (error) {
      console.error('Feil ved Word-eksport:', error);
      alert('Kunne ikke eksportere til Word. Se konsollen for detaljer.');
    }
  };

  // Eksporter til PDF (forenklet - kan utvides senere)
  const eksporterTilPDF = () => {
    // TODO: Implementer PDF-eksport
    alert('PDF-eksport kommer snart!');
  };

  return (
    <Layout
      title="Rapportgenerator for UU-test"
      description="Generer og administrer UU-testrapporter">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div className="site" style={{ padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>
              Rapportgenerator for UU-test
            </h1>
            <p style={{ fontSize: '16px', color: '#64748b' }}>
              Fyll ut og generer profesjonelle UU-testrapporter med automatisk struktur og eksport til Word/PDF.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href={`${baseUrl}arkiv`}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#475569',
                textDecoration: 'none',
                fontFamily: 'inherit',
                display: 'inline-block'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Arkiv
            </a>
            <a
              href={`${baseUrl}login`}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#475569',
                textDecoration: 'none',
                fontFamily: 'inherit',
                display: 'inline-block'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Logg inn
            </a>
          </div>
        </div>

        {/* Globale funksjoner */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '16px', 
          backgroundColor: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={startNyRapport}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: '6px',
                color: '#166534',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#bbf7d0';
                e.currentTarget.style.borderColor = '#4ade80';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dcfce7';
                e.currentTarget.style.borderColor = '#86efac';
              }}
            >
              Ny rapport
            </button>
            <button
              onClick={lagreRapport}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#475569',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Lagre rapport
            </button>
            <button
              onClick={() => lastInnRapport()}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '6px',
                color: '#64748b',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#475569';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#64748b';
              }}
            >
              Last inn rapport
            </button>
            <label style={{ display: 'inline-block', cursor: 'pointer' }}>
              <input
                type="file"
                accept=".json"
                onChange={importerRapport}
                style={{ display: 'none' }}
                id="import-file-input"
              />
              <span style={{ 
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#475569',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
              onClick={() => document.getElementById('import-file-input')?.click()}
              >
                Importer fra fil
              </span>
            </label>
            <button
              onClick={() => setVisTilgjengelighetserklaring(true)}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                fontWeight: '600',
                backgroundColor: '#005AA0',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginLeft: 'auto',
                boxShadow: '0 2px 4px rgba(0, 90, 160, 0.2)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0066b3';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 90, 160, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#005AA0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 90, 160, 0.2)';
              }}
            >
              Tilgjengelighetserklæring
            </button>
          </div>
          {/* Autosave-status */}
          {autosaveStatus && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '12px',
              color: autosaveStatus === 'saved' ? '#16a34a' : '#64748b'
            }}>
              {autosaveStatus === 'saving' && (
                <>
                  <span style={{ 
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    border: '2px solid #64748b',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Lagrer...
                </>
              )}
              {autosaveStatus === 'saved' && (
                <>
                  <span style={{ color: '#16a34a' }}>✓</span>
                  Lagret
                </>
              )}
            </div>
          )}
        </div>

        {/* Liste over lagrede rapporter */}
        {visLagredeRapporter && (
          <div style={{ 
            marginBottom: '24px', 
            padding: '24px', 
            backgroundColor: '#ffffff', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                margin: 0,
                color: '#0f172a' 
              }}>
                Lagrede rapporter ({lagredeRapporter.length})
              </h2>
              <button
                onClick={() => setVisLagredeRapporter(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#475569',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                Lukk
              </button>
            </div>
            {lagredeRapporter.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '14px' }}>Ingen lagrede rapporter.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lagredeRapporter.map((rapport) => (
                  <div
                    key={rapport.id}
                    style={{
                      padding: '16px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      backgroundColor: rapport.id === navaerendeRapportId ? '#f0f9ff' : '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '16px'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      {redigererNavn === rapport.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <input
                            type="text"
                            value={nyttNavn}
                            onChange={(e) => setNyttNavn(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                oppdaterRapportNavn(rapport.id, nyttNavn);
                              } else if (e.key === 'Escape') {
                                setRedigererNavn(null);
                                setNyttNavn('');
                              }
                            }}
                            autoFocus
                            style={{
                              flex: 1,
                              padding: '6px 12px',
                              fontSize: '16px',
                              fontWeight: '600',
                              border: '2px solid #005AA0',
                              borderRadius: '6px',
                              fontFamily: 'inherit'
                            }}
                          />
                          <button
                            onClick={() => oppdaterRapportNavn(rapport.id, nyttNavn)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '14px',
                              fontWeight: '500',
                              backgroundColor: '#005AA0',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#ffffff',
                              cursor: 'pointer',
                              fontFamily: 'inherit'
                            }}
                          >
                            Lagre
                          </button>
                          <button
                            onClick={() => {
                              setRedigererNavn(null);
                              setNyttNavn('');
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: '14px',
                              fontWeight: '500',
                              backgroundColor: '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              color: '#475569',
                              cursor: 'pointer',
                              fontFamily: 'inherit'
                            }}
                          >
                            Avbryt
                          </button>
                        </div>
                      ) : (
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: '600', 
                          color: '#0f172a',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>{rapport.lagretNavn || rapport.tittel}</span>
                          <button
                            onClick={() => {
                              setRedigererNavn(rapport.id);
                              setNyttNavn(rapport.lagretNavn || rapport.tittel);
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#64748b',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              textDecoration: 'underline'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#475569';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#64748b';
                            }}
                          >
                            Endre navn
                          </button>
                        </div>
                      )}
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#64748b' 
                      }}>
                        {new Date(rapport.dato).toLocaleString('no-NO', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {rapport.id === navaerendeRapportId && (
                          <span style={{ 
                            marginLeft: '8px',
                            padding: '2px 8px',
                            backgroundColor: '#16a34a',
                            color: '#ffffff',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}>
                            Aktiv
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => lastInnRapport(rapport.id)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '14px',
                          fontWeight: '500',
                          backgroundColor: '#005AA0',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#004080';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#005AA0';
                        }}
                      >
                        Last inn
                      </button>
                      <button
                        onClick={() => slettLagretRapport(rapport.id)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '14px',
                          fontWeight: '500',
                          backgroundColor: '#ffffff',
                          border: '1px solid #dc2626',
                          borderRadius: '6px',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontFamily: 'inherit'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#fef2f2';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                      >
                        Slett
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tilgjengelighetserklæring-visning */}
        {visTilgjengelighetserklaring && (
          <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Tilgjengelighetserklæring
              </h1>
              <button
                onClick={() => setVisTilgjengelighetserklaring(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: '500',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#475569',
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                Tilbake til rapport
              </button>
            </div>

            {/* Funksjon for å kopiere tekst */}
            {(() => {
              const kopierTekst = async (tekst: string) => {
                try {
                  await navigator.clipboard.writeText(tekst);
                  alert('Tekst kopiert til utklippstavlen!');
                } catch (error) {
                  // Fallback for eldre nettlesere
                  const textArea = document.createElement('textarea');
                  textArea.value = tekst;
                  textArea.style.position = 'fixed';
                  textArea.style.opacity = '0';
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  alert('Tekst kopiert til utklippstavlen!');
                }
              };

              // Hent unike WCAG-koder fra bruddene
              const bruddKoder = Array.from(new Set(rapportData.wcagBrudd
                .filter(brudd => brudd.wcagKode && brudd.wcagKode.trim().length > 0)
                .map(brudd => {
                  // Hent bare koden (f.eks. "1.4.1" fra "1.4.1 Bruk av farge")
                  const kode = brudd.wcagKode.trim().split(' ')[0];
                  // Sjekk at koden matcher formatet (f.eks. "1.4.1" eller "1.3.5")
                  // Støtter både "1.4.1" og "1.3.5" format
                  const match = kode.match(/^(\d+\.\d+\.\d+)/);
                  return match ? match[1] : null;
                })
                .filter((kode): kode is string => kode !== null && kode.length > 0)
              ));
              
              // Debug: Log for å se hva som hentes
              console.log('=== DEBUG TILGJENGELIGHETSERKLÆRING ===');
              console.log('Antall brudd i rapportData:', rapportData.wcagBrudd.length);
              console.log('BruddKoder funnet:', bruddKoder);
              console.log('RapportData.wcagBrudd:', rapportData.wcagBrudd.map(b => ({ 
                id: b.id, 
                wcagKode: b.wcagKode,
                omrade: b.omrade 
              })));

              // Hent standardtekster for bruddene, eller alle hvis ingen brudd
              // Viktig: Hvis det er brudd i rapporten, vis KUN standardtekster for de bruddene
              const relevanteTekster = bruddKoder.length > 0 && rapportData.wcagBrudd.length > 0
                ? bruddKoder
                    .filter(kode => {
                      const harTekst = standardtekster[kode];
                      if (!harTekst) {
                        console.log(`⚠️ Ingen standardtekst funnet for kode: ${kode}`);
                      }
                      return harTekst;
                    })
                    .map(kode => ({
                      kode,
                      navn: wcagKriterier.find(k => k.kode === kode)?.navn || kode,
                      tekster: standardtekster[kode]
                    }))
                : Object.keys(standardtekster).map(kode => ({
                    kode,
                    navn: wcagKriterier.find(k => k.kode === kode)?.navn || kode,
                    tekster: standardtekster[kode]
                  }));
              
              console.log('Relevante tekster:', relevanteTekster.length);
              console.log('========================================');

              return (
                <>
                  {/* UU-brudd-seksjon */}
                  {rapportData.wcagBrudd.length > 0 && (
                    <div style={{ 
                      marginBottom: '32px', 
                      padding: '24px', 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e2e8f0', 
                      borderRadius: '8px'
                    }}>
                      <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: '#0f172a' }}>
                        UU-brudd i rapporten
                      </h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {rapportData.wcagBrudd.map((brudd) => {
                          // Hent WCAG-kode og navn fra wcagKode-feltet
                          // wcagKode kan være formatert som "1.4.5 Bilder av tekst (Nivå AA)"
                          const wcagKode = brudd.wcagKode ? brudd.wcagKode.trim().split(' ')[0] : '';
                          const wcagNavn = brudd.wcagKode && brudd.wcagKode.length > wcagKode.length 
                            ? brudd.wcagKode.substring(wcagKode.length).trim() 
                            : '';
                          // Finn fullt navn fra wcagKriterier for å unngå duplikasjon
                          const fulltNavn = wcagKriterier.find(k => k.kode === wcagKode)?.navn || wcagNavn;
                          return (
                            <div key={brudd.id} style={{
                              padding: '16px',
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px'
                            }}>
                              <div style={{ fontWeight: '600', color: '#0f172a', marginBottom: '4px' }}>
                                {fulltNavn}
                              </div>
                              {brudd.omrade && (
                                <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '8px' }}>
                                  Område: {brudd.omrade}
                                </div>
                              )}
                              {brudd.beskrivelse && (
                                <div style={{ fontSize: '14px', color: '#475569', whiteSpace: 'pre-wrap' }}>
                                  {brudd.beskrivelse}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Standardtekster-seksjon */}
                  <div style={{ 
                    marginBottom: '24px', 
                    padding: '24px', 
                    backgroundColor: '#ffffff', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: '8px'
                  }}>
                    <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '16px', color: '#0f172a' }}>
                      {rapportData.wcagBrudd.length > 0 && bruddKoder.length > 0 
                        ? 'Standardtekster for bruddene' 
                        : 'Alle standardtekster'}
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      {relevanteTekster.map(({ kode, navn, tekster }) => (
                        <div key={kode} style={{
                          padding: '20px',
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px'
                        }}>
                          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#0f172a' }}>
                            {navn}
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {tekster.map((tekst, index) => (
                              <div key={index} style={{
                                padding: '16px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                position: 'relative'
                              }}>
                                <div style={{ 
                                  fontSize: '14px', 
                                  color: '#475569', 
                                  whiteSpace: 'pre-wrap',
                                  marginBottom: '12px',
                                  lineHeight: '1.6'
                                }}>
                                  {tekst}
                                </div>
                                <button
                                  onClick={() => kopierTekst(tekst)}
                                  style={{
                                    padding: '6px 12px',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                    backgroundColor: '#005AA0',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#0066b3';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#005AA0';
                                  }}
                                >
                                  Kopier tekst
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* Metadata-seksjon */}
        {!visTilgjengelighetserklaring && (
        <>
        {/* Metadata-seksjon */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '24px', 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              margin: 0, 
              color: '#0f172a' 
            }}>
              Rapportmetadata
            </h2>
            <button
              onClick={() => setMetadataApen(!metadataApen)}
              style={{
                padding: '4px 8px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'transparent',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                color: '#475569',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {metadataApen ? '▼' : '▶'} {metadataApen ? 'Lukk' : 'Åpne'}
            </button>
          </div>
          {metadataApen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
            <div style={{ width: '100%' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#0f172a'
              }}>
                Tittel
              </label>
              <input
                type="text"
                value={rapportData.tittel}
                onChange={(e) => setRapportData({ ...rapportData, tittel: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '18px',
                  border: '2px solid #94a3b8',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ width: '100%' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#0f172a'
              }}>
                Testdato
              </label>
              <input
                type="date"
                value={rapportData.testdato}
                onChange={(e) => setRapportData({ ...rapportData, testdato: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #94a3b8',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ width: '100%' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#0f172a'
              }}>
                Testet av
              </label>
              <input
                type="text"
                value={rapportData.testetAv}
                onChange={(e) => setRapportData({ ...rapportData, testetAv: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #94a3b8',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ width: '100%' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#0f172a'
              }}>
                Test-URL
              </label>
              <input
                type="url"
                value={rapportData.testUrl}
                onChange={(e) => setRapportData({ ...rapportData, testUrl: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #94a3b8',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ width: '100%' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#0f172a'
              }}>
                Testbruker
              </label>
              <input
                type="text"
                value={rapportData.testbruker}
                onChange={(e) => setRapportData({ ...rapportData, testbruker: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #94a3b8',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ width: '100%' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#0f172a'
              }}>
                Versjon
              </label>
              <input
                type="text"
                value={rapportData.versjon}
                onChange={(e) => setRapportData({ ...rapportData, versjon: e.target.value })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #94a3b8',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>
            <div style={{ width: '100%' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600', 
                fontSize: '14px',
                color: '#0f172a'
              }}>
                Kommentar
              </label>
              <textarea
                value={rapportData.kommentar}
                onChange={(e) => setRapportData({ ...rapportData, kommentar: e.target.value })}
                rows={5}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #94a3b8',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
          )}
        </div>

        {/* Sammendrag (autogenerert) */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '24px', 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              margin: 0, 
              color: '#0f172a' 
            }}>
              Sammendrag
            </h2>
            <button
              onClick={() => setSammendragApen(!sammendragApen)}
              style={{
                padding: '4px 8px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'transparent',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                color: '#475569',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {sammendragApen ? '▼' : '▶'} {sammendragApen ? 'Lukk' : 'Åpne'}
            </button>
          </div>
          {sammendragApen && (
          <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div style={{ padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{antallBrudd}</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>WCAG-brudd</div>
            </div>
            <div style={{ padding: '16px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>{antallForbedringer}</div>
              <div style={{ fontSize: '14px', color: '#64748b' }}>Forbedringsforslag</div>
            </div>
          </div>
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={oppdaterSammendrag}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#f1f5f9',
                border: '2px solid #cbd5e1',
                borderRadius: '6px',
                color: '#475569',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e2e8f0';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Autogenerer sammendrag
            </button>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Klikk for å generere tekst basert på bruddene
            </span>
          </div>
          <div style={{ width: '100%' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontWeight: '600', 
              fontSize: '14px',
              color: '#0f172a'
            }}>
              Kort oppsummering (redigerbar)
            </label>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
              Autogenerert basert på bruddseksjonen. Kan redigeres.
            </p>
            <textarea
              value={rapportData.sammendrag}
              onChange={(e) => setRapportData({ ...rapportData, sammendrag: e.target.value })}
              rows={4}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '16px',
                border: '2px solid #94a3b8',
                borderRadius: '6px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>
          </>
          )}
        </div>

        {/* WCAG-brudd-seksjon */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '24px', 
          backgroundColor: '#f8fafc', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            marginBottom: '20px', 
            color: '#0f172a' 
          }}>
            WCAG-brudd
          </h2>
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={leggTilBrudd}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#e0f2fe',
                border: '1px solid #7dd3fc',
                borderRadius: '6px',
                color: '#005AA0',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#bae6fd';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#e0f2fe';
                e.currentTarget.style.borderColor = '#7dd3fc';
              }}
            >
              Legg til nytt brudd
            </button>
          </div>
            
            {rapportData.wcagBrudd.map((brudd, index) => {
              const erEkspandert = ekspanderteBrudd.has(brudd.id);
              const wcagNavn = brudd.wcagKode ? brudd.wcagKode.split(' ').slice(1).join(' ') : '';
              
              return (
              <div key={brudd.id} id={`brudd-${brudd.id}`} style={{ 
                marginBottom: '24px', 
                padding: '20px', 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px'
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: erEkspandert ? '16px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer' }} onClick={() => toggleBruddEkspandert(brudd.id)}>
                  <span style={{ fontSize: '18px', color: '#64748b', userSelect: 'none' }}>
                    {erEkspandert ? '▼' : '▶'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <h3 id={`brudd-h3-${brudd.id}`} style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', margin: 0, marginBottom: '4px' }}>
                      Brudd #{index + 1}
                    </h3>
                    {!erEkspandert && (
                      <div style={{ fontSize: '14px', color: '#64748b' }}>
                        {wcagNavn || brudd.omrade || 'Ingen informasjon'}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    backgroundColor: brudd.status === 'Åpent' ? '#fef2f2' : brudd.status === 'Lukket' ? '#f0fdf4' : '#fef3c7',
                    color: brudd.status === 'Åpent' ? '#dc2626' : brudd.status === 'Lukket' ? '#16a34a' : '#d97706',
                    border: `1px solid ${brudd.status === 'Åpent' ? '#fecaca' : brudd.status === 'Lukket' ? '#bbf7d0' : '#fde68a'}`
                  }}>
                    {brudd.status}
                  </span>
                  <button
                    onClick={() => kopierBrudd(brudd.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    Kopier
                  </button>
                  <button
                    onClick={() => slettBrudd(brudd.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    Slett
                  </button>
                </div>
              </div>

              {erEkspandert && (
              <>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '16px' }}>
                <div style={{ width: '100%' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    fontSize: '14px',
                    color: '#0f172a'
                  }}>
                    WCAG-kriterium
                  </label>
                  <select
                    value={brudd.wcagKode.split(' ')[0] || ''}
                    onChange={(e) => {
                      const valgtKriterium = wcagKriterier.find(k => k.kode === e.target.value);
                      oppdaterBrudd(brudd.id, 'wcagKode', valgtKriterium ? `${valgtKriterium.kode} ${valgtKriterium.navn}` : e.target.value);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '16px',
                      border: '2px solid #94a3b8',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="">Velg WCAG-kriterium</option>
                    {wcagKriterier.map(kriterium => (
                      <option key={kriterium.kode} value={kriterium.kode}>
                        {kriterium.navn}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ width: '100%' }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontWeight: '600', 
                    fontSize: '14px',
                    color: '#0f172a'
                  }}>
                    Status
                  </label>
                  <select
                    value={brudd.status}
                    onChange={(e) => oppdaterBruddMedRevisjon(brudd.id, 'status', e.target.value as WCAGStatus)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      fontSize: '16px',
                      border: '2px solid #94a3b8',
                      borderRadius: '6px',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="Åpent">Åpent</option>
                    <option value="Lukket">Lukket</option>
                    <option value="Revidert">Revidert</option>
                  </select>
                </div>
              </div>

              <div style={{ width: '100%', marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#0f172a'
                }}>
                  Område / tittel
                </label>
                <input
                  type="text"
                  value={brudd.omrade}
                  onChange={(e) => oppdaterBrudd(brudd.id, 'omrade', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '16px',
                    border: '2px solid #94a3b8',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ width: '100%', marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#0f172a'
                }}>
                  Beskrivelse av brudd
                </label>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  Konkret, tydelig og forståelig tekst
                </p>
                <textarea
                  value={brudd.beskrivelse}
                  onChange={(e) => oppdaterBrudd(brudd.id, 'beskrivelse', e.target.value)}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '16px',
                    border: '2px solid #94a3b8',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
                {/* Vis beskrivelse med klikkbare lenker - kun hvis det er lenker i teksten */}
                {brudd.beskrivelse && /(https?:\/\/[^\s]+|www\.[^\s]+)/.test(brudd.beskrivelse) && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {brudd.beskrivelse.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part, i) => {
                      if (part.match(/^https?:\/\//) || part.match(/^www\./)) {
                        const url = part.match(/^www\./) ? `https://${part}` : part;
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#005AA0', textDecoration: 'underline' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {part}
                          </a>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                )}
              </div>

              <div style={{ width: '100%', marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#0f172a'
                }}>
                  Tiltak / anbefaling
                </label>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  Lenke til designsystem, mønster eller løsning
                </p>
                <input
                  type="text"
                  value={brudd.tiltak}
                  onChange={(e) => oppdaterBrudd(brudd.id, 'tiltak', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '16px',
                    border: '2px solid #94a3b8',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                />
                {/* Vis tiltak med klikkbare lenker - kun hvis det er lenker i teksten */}
                {brudd.tiltak && /(https?:\/\/[^\s]+|www\.[^\s]+)/.test(brudd.tiltak) && (
                  <div style={{
                    marginTop: '8px',
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    wordBreak: 'break-word'
                  }}>
                    {brudd.tiltak.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part, i) => {
                      if (part.match(/^https?:\/\//) || part.match(/^www\./)) {
                        const url = part.match(/^www\./) ? `https://${part}` : part;
                        return (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#005AA0', textDecoration: 'underline' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {part}
                          </a>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                  Skjermbilder og beskrivelser
                </label>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  Legg til tekstbeskrivelser og skjermbilder i ønsket rekkefølge
                </p>
                
                {/* Knapper for å legge til */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <button
                    onClick={() => leggTilSkjermbildeTekst(brudd.id)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    + Legg til tekst
                  </button>
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const target = e.target as HTMLInputElement;
                        if (target.files?.[0]) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const imageData = reader.result as string;
                            leggTilSkjermbildeBilde(brudd.id, imageData);
                          };
                          reader.readAsDataURL(target.files[0]);
                        }
                      };
                      input.click();
                    }}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    + Legg til bilde
                  </button>
                </div>

                {/* Liste av skjermbilder */}
                {brudd.skjermbilder.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {brudd.skjermbilder.map((element, index) => (
                      <div
                        key={element.id}
                        style={{
                          padding: '12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          backgroundColor: '#ffffff',
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'flex-start'
                        }}
                        onPaste={(e) => {
                          if (element.type === 'image') {
                            handlePaste(e, brudd.id);
                          }
                        }}
                        tabIndex={0}
                      >
                        {/* Innhold */}
                        <div style={{ flex: 1 }}>
                          {element.type === 'text' ? (
                            <div>
                              <textarea
                                value={element.content}
                                onChange={(e) => oppdaterSkjermbildeElement(brudd.id, element.id, e.target.value, undefined, undefined)}
                                placeholder="Skriv tekstbeskrivelse..."
                                rows={2}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px',
                                  fontSize: '14px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontFamily: 'inherit',
                                  resize: 'vertical'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{ position: 'relative', display: 'inline-block', width: 'fit-content', maxWidth: '100%', overflow: 'visible' }}>
                              <img
                                src={element.content}
                                alt="Skjermbilde"
                                style={{ 
                                  width: element.width ? `${element.width}px` : 'auto',
                                  height: element.height ? `${element.height}px` : 'auto',
                                  maxWidth: '100%',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0',
                                  display: 'block',
                                  objectFit: 'contain',
                                  margin: 0,
                                  padding: 0
                                }}
                                onClick={() => visBilde(element.content)}
                                onLoad={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  const opprinneligBredde = img.naturalWidth;
                                  const opprinneligHoyde = img.naturalHeight;
                                  
                                  // Hvis bildet ikke har lagrede dimensjoner, sett proporsjonale dimensjoner
                                  if (!element.width || !element.height) {
                                    const standardBredde = 600;
                                    const standardHoyde = Math.round((standardBredde / opprinneligBredde) * opprinneligHoyde);
                                    // Lagre både visningsdimensjoner og originalstørrelse
                                    oppdaterSkjermbildeElement(brudd.id, element.id, element.content, standardBredde, standardHoyde, opprinneligBredde, opprinneligHoyde);
                                  } else if (!element.originalWidth || !element.originalHeight) {
                                    // Oppdater originalstørrelse hvis den mangler
                                    oppdaterSkjermbildeElement(brudd.id, element.id, element.content, element.width, element.height, opprinneligBredde, opprinneligHoyde);
                                  }
                                }}
                              />
                              {/* Resize-handle i nedre høyre hjørne */}
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: '16px',
                                  height: '16px',
                                  backgroundColor: '#005AA0',
                                  border: '2px solid #ffffff',
                                  borderRadius: '2px',
                                  cursor: 'nwse-resize',
                                  zIndex: 10
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  
                                  const img = e.currentTarget.parentElement?.querySelector('img') as HTMLImageElement;
                                  if (!img) return;
                                  
                                  const startX = e.clientX;
                                  const startY = e.clientY;
                                  const startWidth = element.width || img.offsetWidth;
                                  const startHeight = element.height || img.offsetHeight;
                                  const aspectRatio = startWidth / startHeight;
                                  
                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaX = moveEvent.clientX - startX;
                                    const deltaY = moveEvent.clientY - startY;
                                    
                                    // Beregn ny størrelse basert på diagonal bevegelse for å beholde proporsjoner
                                    // Bruk den største endringen (X eller Y) for å beholde proporsjoner
                                    const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
                                    const sign = deltaX > 0 ? 1 : -1;
                                    const newWidth = Math.max(100, Math.min(2000, startWidth + (sign * delta)));
                                    const newHeight = Math.round(newWidth / aspectRatio);
                                    
                                    img.style.width = `${newWidth}px`;
                                    img.style.height = `${newHeight}px`;
                                  };
                                  
                                    const handleMouseUp = () => {
                                      // Bruk faktiske bildedimensjoner, ikke CSS-dimensjoner som kan inkludere padding/border
                                      const finalWidth = element.width || img.naturalWidth;
                                      const finalHeight = element.height || img.naturalHeight;
                                      // Hent faktiske CSS-dimensjoner og konverter til faktiske bildedimensjoner
                                      const cssWidth = parseInt(img.style.width) || img.naturalWidth;
                                      const cssHeight = parseInt(img.style.height) || img.naturalHeight;
                                      // Beregn faktiske bildedimensjoner basert på aspect ratio
                                      const aspectRatio = img.naturalWidth / img.naturalHeight;
                                      const calculatedWidth = cssWidth;
                                      const calculatedHeight = Math.round(cssWidth / aspectRatio);
                                      oppdaterSkjermbildeElement(brudd.id, element.id, element.content, calculatedWidth, calculatedHeight);
                                    document.removeEventListener('mousemove', handleMouseMove);
                                    document.removeEventListener('mouseup', handleMouseUp);
                                  };
                                  
                                  document.addEventListener('mousemove', handleMouseMove);
                                  document.addEventListener('mouseup', handleMouseUp);
                                }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Kontrollknapper */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <button
                            onClick={() => flyttSkjermbildeOpp(brudd.id, element.id)}
                            disabled={index === 0}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: index === 0 ? '#f1f5f9' : '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              color: index === 0 ? '#94a3b8' : '#475569',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                              minWidth: '60px'
                            }}
                            onMouseEnter={(e) => {
                              if (index > 0) {
                                e.currentTarget.style.backgroundColor = '#f1f5f9';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = index === 0 ? '#f1f5f9' : '#ffffff';
                            }}
                          >
                            ↑ Opp
                          </button>
                          <button
                            onClick={() => flyttSkjermbildeNed(brudd.id, element.id)}
                            disabled={index === brudd.skjermbilder.length - 1}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: index === brudd.skjermbilder.length - 1 ? '#f1f5f9' : '#ffffff',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              color: index === brudd.skjermbilder.length - 1 ? '#94a3b8' : '#475569',
                              cursor: index === brudd.skjermbilder.length - 1 ? 'not-allowed' : 'pointer',
                              fontFamily: 'inherit',
                              minWidth: '60px'
                            }}
                            onMouseEnter={(e) => {
                              if (index < brudd.skjermbilder.length - 1) {
                                e.currentTarget.style.backgroundColor = '#f1f5f9';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = index === brudd.skjermbilder.length - 1 ? '#f1f5f9' : '#ffffff';
                            }}
                          >
                            ↓ Ned
                          </button>
                          <button
                            onClick={() => slettSkjermbildeElement(brudd.id, element.id)}
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              backgroundColor: '#ffffff',
                              border: '1px solid #dc2626',
                              borderRadius: '4px',
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              minWidth: '60px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#fee2e2';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                          >
                            Slett
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Paste-område for bilder */}
                <div
                  style={{
                    marginTop: '12px',
                    padding: '16px',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    textAlign: 'center'
                  }}
                  onPaste={(e) => handlePaste(e, brudd.id)}
                  tabIndex={0}
                >
                  <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                    Lim inn bilde fra utklippstavlen (Ctrl+V / Cmd+V)
                  </p>
                </div>
              </div>

              <div style={{ width: '100%' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontWeight: '600', 
                  fontSize: '14px',
                  color: '#0f172a'
                }}>
                  Intern kommentar (ikke med i eksport)
                </label>
                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  For revisjonshistorikk
                </p>
                <textarea
                  value={brudd.internKommentar}
                  onChange={(e) => oppdaterBrudd(brudd.id, 'internKommentar', e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '16px',
                    border: '2px solid #94a3b8',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
              </>
              )}
              </div>
            );
            })}
          </div>

          {/* "Legg til nytt brudd"-knapp nederst i høyre hjørne etter siste brudd */}
          {rapportData.wcagBrudd.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', marginBottom: '24px' }}>
              <button
                onClick={leggTilBrudd}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  backgroundColor: '#e0f2fe',
                  border: '2px solid #7dd3fc',
                  borderRadius: '8px',
                  color: '#005AA0',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#bae6fd';
                  e.currentTarget.style.borderColor = '#38bdf8';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#e0f2fe';
                  e.currentTarget.style.borderColor = '#7dd3fc';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                }}
              >
                + Legg til nytt brudd
              </button>
            </div>
          )}

        {/* Forbedringsforslag-seksjon */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '24px', 
          backgroundColor: '#f0fdf4', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            marginBottom: '20px', 
            color: '#0f172a' 
          }}>
            Forslag til forbedringer
          </h2>
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={leggTilForbedringsforslag}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#e0f2fe',
                border: '1px solid #7dd3fc',
                borderRadius: '6px',
                color: '#005AA0',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#bae6fd';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#e0f2fe';
                e.currentTarget.style.borderColor = '#7dd3fc';
              }}
            >
              Legg til forbedringsforslag
            </button>
          </div>

            {rapportData.forbedringsforslag.map((forslag, index) => (
              <div key={forslag.id} style={{ 
                marginBottom: '16px', 
                padding: '20px', 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0', 
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#0f172a', margin: 0 }}>
                    {index + 1}. Forbedringsforslag
                  </h3>
                  <button
                    onClick={() => slettForbedringsforslag(forslag.id)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    Slett
                  </button>
                </div>

                {/* Skjermbilder og beskrivelser for forbedringsforslag */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
                    Skjermbilder og beskrivelser
                  </label>
                  <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                    Legg til tekstbeskrivelser og skjermbilder i ønsket rekkefølge
                  </p>
                  
                  {/* Knapper for å legge til */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button
                      onClick={() => leggTilForbedringsforslagSkjermbildeTekst(forslag.id)}
                      style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#475569',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      + Legg til tekst
                    </button>
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const target = e.target as HTMLInputElement;
                          if (target.files?.[0]) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const imageData = reader.result as string;
                              leggTilForbedringsforslagSkjermbildeBilde(forslag.id, imageData);
                            };
                            reader.readAsDataURL(target.files[0]);
                          }
                        };
                        input.click();
                      }}
                      style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: '500',
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        color: '#475569',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      + Legg til bilde
                    </button>
                  </div>

                  {/* Liste av skjermbilder */}
                  {forslag.skjermbilder.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {forslag.skjermbilder.map((element, elementIndex) => (
                        <div
                          key={element.id}
                          style={{
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start'
                          }}
                          onPaste={(e) => {
                            if (element.type === 'image') {
                              handleForbedringsforslagPaste(e, forslag.id);
                            }
                          }}
                          tabIndex={0}
                        >
                          {/* Innhold */}
                          <div style={{ flex: 1, minWidth: 0, overflow: 'visible' }}>
                            {element.type === 'text' ? (
                              <div>
                                <textarea
                                  value={element.content}
                                  onChange={(e) => oppdaterForbedringsforslagSkjermbildeElement(forslag.id, element.id, e.target.value, undefined, undefined)}
                                  placeholder="Skriv tekstbeskrivelse..."
                                  rows={2}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    fontSize: '14px',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '4px',
                                    fontFamily: 'inherit',
                                    resize: 'vertical'
                                  }}
                                />
                                {/* Vis tekst med klikkbare lenker */}
                                {element.content && (
                                  <div style={{
                                    marginTop: '8px',
                                    padding: '8px 12px',
                                    backgroundColor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '4px',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word'
                                  }}>
                                    {element.content.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part, i) => {
                                      if (part.match(/^https?:\/\//) || part.match(/^www\./)) {
                                        const url = part.match(/^www\./) ? `https://${part}` : part;
                                        return (
                                          <a
                                            key={i}
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#005AA0', textDecoration: 'underline' }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {part}
                                          </a>
                                        );
                                      }
                                      return <span key={i}>{part}</span>;
                                    })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div style={{ position: 'relative', display: 'inline-block', width: 'fit-content', maxWidth: '100%', overflow: 'visible' }}>
                                <img
                                  src={element.content}
                                  alt="Skjermbilde"
                                  style={{ 
                                    width: element.width ? `${element.width}px` : 'auto',
                                    height: element.height ? `${element.height}px` : 'auto',
                                    maxWidth: '100%',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    border: '1px solid #e2e8f0',
                                    display: 'block',
                                    objectFit: 'contain',
                                    margin: 0,
                                    padding: 0
                                  }}
                                  onClick={() => visBilde(element.content)}
                                  onLoad={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    const opprinneligBredde = img.naturalWidth;
                                    const opprinneligHoyde = img.naturalHeight;
                                    
                                    if (!element.width || !element.height) {
                                      const standardBredde = 600;
                                      const standardHoyde = Math.round((standardBredde / opprinneligBredde) * opprinneligHoyde);
                                      oppdaterForbedringsforslagSkjermbildeElement(forslag.id, element.id, element.content, standardBredde, standardHoyde, opprinneligBredde, opprinneligHoyde);
                                    } else if (!element.originalWidth || !element.originalHeight) {
                                      // Oppdater originalstørrelse hvis den mangler
                                      oppdaterForbedringsforslagSkjermbildeElement(forslag.id, element.id, element.content, element.width, element.height, opprinneligBredde, opprinneligHoyde);
                                    }
                                  }}
                                />
                                {/* Resize-handle i nedre høyre hjørne */}
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    right: 0,
                                    width: '16px',
                                    height: '16px',
                                    backgroundColor: '#005AA0',
                                    border: '2px solid #ffffff',
                                    borderRadius: '2px',
                                    cursor: 'nwse-resize',
                                    zIndex: 10
                                  }}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    
                                    const img = e.currentTarget.parentElement?.querySelector('img') as HTMLImageElement;
                                    if (!img) return;
                                    
                                    const startX = e.clientX;
                                    const startY = e.clientY;
                                    // Bruk naturalWidth/naturalHeight for faktiske bildedimensjoner, ikke offsetWidth som inkluderer padding/border
                                    const startWidth = element.width || img.naturalWidth;
                                    const startHeight = element.height || img.naturalHeight;
                                    const aspectRatio = startWidth / startHeight;
                                    
                                    const handleMouseMove = (moveEvent: MouseEvent) => {
                                      const deltaX = moveEvent.clientX - startX;
                                      const deltaY = moveEvent.clientY - startY;
                                      
                                      const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
                                      const sign = deltaX > 0 ? 1 : -1;
                                      const newWidth = Math.max(100, Math.min(2000, startWidth + (sign * delta)));
                                      const newHeight = Math.round(newWidth / aspectRatio);
                                      
                                      img.style.width = `${newWidth}px`;
                                      img.style.height = `${newHeight}px`;
                                    };
                                    
                                    const handleMouseUp = () => {
                                      const finalWidth = parseInt(img.style.width) || startWidth;
                                      const finalHeight = parseInt(img.style.height) || startHeight;
                                      oppdaterForbedringsforslagSkjermbildeElement(forslag.id, element.id, element.content, finalWidth, finalHeight);
                                      document.removeEventListener('mousemove', handleMouseMove);
                                      document.removeEventListener('mouseup', handleMouseUp);
                                    };
                                    
                                    document.addEventListener('mousemove', handleMouseMove);
                                    document.addEventListener('mouseup', handleMouseUp);
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          {/* Kontrollknapper */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <button
                              onClick={() => flyttForbedringsforslagSkjermbildeOpp(forslag.id, element.id)}
                              disabled={elementIndex === 0}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: elementIndex === 0 ? '#f1f5f9' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                color: elementIndex === 0 ? '#94a3b8' : '#475569',
                                cursor: elementIndex === 0 ? 'not-allowed' : 'pointer',
                                fontFamily: 'inherit',
                                minWidth: '60px'
                              }}
                            >
                              ↑ Opp
                            </button>
                            <button
                              onClick={() => flyttForbedringsforslagSkjermbildeNed(forslag.id, element.id)}
                              disabled={elementIndex === forslag.skjermbilder.length - 1}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: elementIndex === forslag.skjermbilder.length - 1 ? '#f1f5f9' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                color: elementIndex === forslag.skjermbilder.length - 1 ? '#94a3b8' : '#475569',
                                cursor: elementIndex === forslag.skjermbilder.length - 1 ? 'not-allowed' : 'pointer',
                                fontFamily: 'inherit',
                                minWidth: '60px'
                              }}
                            >
                              ↓ Ned
                            </button>
                            <button
                              onClick={() => slettForbedringsforslagSkjermbildeElement(forslag.id, element.id)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: '500',
                                backgroundColor: '#ffffff',
                                border: '1px solid #dc2626',
                                borderRadius: '4px',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                minWidth: '60px'
                              }}
                            >
                              Slett
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Paste-område for bilder */}
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '16px',
                      border: '2px dashed #cbd5e1',
                      borderRadius: '8px',
                      backgroundColor: '#f8fafc',
                      textAlign: 'center'
                    }}
                    onPaste={(e) => handleForbedringsforslagPaste(e, forslag.id)}
                    tabIndex={0}
                  >
                    <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>
                      Lim inn bilde fra utklippstavlen (Ctrl+V / Cmd+V)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        {/* Tilgjengelighetserklæring */}
        {tilgjengelighetserklaring.length > 0 && (
          <div style={{ marginBottom: '24px', padding: '24px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#0f172a' }}>
              Tilgjengelighetserklæring (autogenerert)
            </h2>
            <div>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                Automatisk generert tabell basert på åpne WCAG-brudd. Kun "ikke godkjent"-kriterier vises.
              </p>
              <Table caption="Tilgjengelighetserklæring">
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>WCAG-kriterium</Table.HeaderCell>
                    <Table.HeaderCell>Beskrivelse</Table.HeaderCell>
                    <Table.HeaderCell>Kommentar</Table.HeaderCell>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {tilgjengelighetserklaring.map((item, index) => (
                    <Table.Row key={index}>
                      <Table.DataCell>{item.kriterium}</Table.DataCell>
                      <Table.DataCell>{item.beskrivelse}</Table.DataCell>
                      <Table.DataCell>{item.kommentar}</Table.DataCell>
                      <Table.DataCell>{item.status}</Table.DataCell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          </div>
        )}

        {/* Revisjonshistorikk */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '24px', 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <h2 style={{ 
            fontSize: '20px', 
            fontWeight: '600', 
            marginBottom: '20px', 
            color: '#0f172a' 
          }}>
            Revisjonshistorikk
          </h2>
          {rapportData.revisjoner.length > 0 ? (
            <Table caption="Revisjonshistorikk">
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Dato</Table.HeaderCell>
                  <Table.HeaderCell>Endret av</Table.HeaderCell>
                  <Table.HeaderCell>Endringstype</Table.HeaderCell>
                  <Table.HeaderCell>Kommentar</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rapportData.revisjoner.map((revisjon, index) => (
                  <Table.Row key={index}>
                    <Table.DataCell>{revisjon.dato}</Table.DataCell>
                    <Table.DataCell>{revisjon.endretAv}</Table.DataCell>
                    <Table.DataCell>{revisjon.endringstype}</Table.DataCell>
                    <Table.DataCell>{revisjon.kommentar}</Table.DataCell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <p style={{ fontSize: '14px', color: '#64748b', fontStyle: 'italic' }}>
              Ingen revisjoner registrert ennå. Revisjoner legges automatisk til når brudd endres.
            </p>
          )}
        </div>

        {/* Eksport-knapper */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '32px', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button
            onClick={eksporterTilWord}
            style={{
              padding: '16px 32px',
              fontSize: '18px',
              fontWeight: '700',
              backgroundColor: '#005AA0',
              border: 'none',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: '0 4px 6px -1px rgba(0, 90, 160, 0.3), 0 2px 4px -1px rgba(0, 90, 160, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#004080';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 6px 8px -1px rgba(0, 90, 160, 0.4), 0 4px 6px -1px rgba(0, 90, 160, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#005AA0';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 90, 160, 0.3), 0 2px 4px -1px rgba(0, 90, 160, 0.2)';
            }}
          >
            Eksporter til Word
          </button>
          <button
            onClick={eksporterTilPDF}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#475569',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            Eksporter til PDF
          </button>
          <button
            onClick={eksporterTilJSON}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              color: '#475569',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            Eksporter til JSON
          </button>
        </div>

        {/* Lightbox for bilder */}
        {selectedImage && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              cursor: 'pointer',
            }}
            onClick={lukkBilde}
          >
            <img
              src={selectedImage}
              alt="Forstørret skjermbilde"
              style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
            />
            <button
              onClick={lukkBilde}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                backgroundColor: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '24px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        )}
        </>
        )}
      </div>
    </Layout>
  );
}

