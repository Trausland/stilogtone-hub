import React, { useState, useEffect } from 'react';
import Layout from '@theme/Layout';
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { ref, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '@site/src/utils/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import useBaseUrl from '@docusaurus/useBaseUrl';
import '@skatteetaten/ds-core-designtokens/index.css';

interface RapportMetadata {
  id: string;
  tittel: string;
  testdato: string;
  testetAv: string;
  testUrl: string;
  versjon: string;
  opprettet: any;
  filUrl?: string;
}

export default function Arkiv(): React.JSX.Element {
  const [rapporter, setRapporter] = useState<RapportMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTestetAv, setFilterTestetAv] = useState('');
  const baseUrl = useBaseUrl('/');

  useEffect(() => {
    // Kun kjøre på klientsiden (ikke under bygget)
    if (typeof window === 'undefined' || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        lastInnRapporter();
      } else {
        setUser(null);
        setRapporter([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const lastInnRapporter = async () => {
    // Kun kjøre på klientsiden og hvis db er tilgjengelig
    if (typeof window === 'undefined' || !db) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const q = query(collection(db, 'rapporter'), orderBy('opprettet', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const rapporterData: RapportMetadata[] = [];
      querySnapshot.forEach((doc) => {
        rapporterData.push({
          id: doc.id,
          ...doc.data(),
        } as RapportMetadata);
      });
      
      setRapporter(rapporterData);
    } catch (error) {
      console.error('Feil ved lasting av rapporter:', error);
      alert('Kunne ikke laste rapporter. Se konsollen for detaljer.');
    } finally {
      setLoading(false);
    }
  };

  const slettRapport = async (rapportId: string, filUrl?: string) => {
    if (!confirm('Er du sikker på at du vil slette denne rapporten?')) {
      return;
    }

    try {
      // Slett fra Firestore
      await deleteDoc(doc(db, 'rapporter', rapportId));
      
      // Slett fil fra Storage hvis den finnes
      if (filUrl) {
        const fileRef = ref(storage, filUrl);
        await deleteObject(fileRef);
      }
      
      // Oppdater liste
      setRapporter(rapporter.filter(r => r.id !== rapportId));
      alert('Rapport slettet!');
    } catch (error) {
      console.error('Feil ved sletting:', error);
      alert('Kunne ikke slette rapport. Se konsollen for detaljer.');
    }
  };

  const lastNedFil = async (filUrl: string, filnavn: string) => {
    try {
      const url = await getDownloadURL(ref(storage, filUrl));
      const a = document.createElement('a');
      a.href = url;
      a.download = filnavn;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Feil ved nedlasting:', error);
      alert('Kunne ikke laste ned fil. Se konsollen for detaljer.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Feil ved utlogging:', error);
    }
  };

  // Filtrer rapporter
  const filtrerteRapporter = rapporter.filter(rapport => {
    const matcherSok = searchTerm === '' || 
      rapport.tittel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rapport.testUrl.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matcherTestetAv = filterTestetAv === '' || rapport.testetAv === filterTestetAv;
    
    return matcherSok && matcherTestetAv;
  });

  // Hent unike testetAv-verdier
  const unikeTestetAv = Array.from(new Set(rapporter.map(r => r.testetAv))).filter(Boolean);

  if (!user) {
    return (
      <Layout title="Arkiv - Rapportgenerator for UU-test" description="Arkiv for UU-testrapporter">
        <div className="site" style={{ padding: '2rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '16px', color: '#0f172a' }}>
            Arkiv
          </h1>
          <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '32px' }}>
            Du må være innlogget for å se arkivet.
          </p>
          <a 
            href={`${baseUrl}rapport-generator`}
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#005AA0',
              color: '#ffffff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px'
            }}
          >
            Gå til rapportgenerator
          </a>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Arkiv - Rapportgenerator for UU-test" description="Arkiv for UU-testrapporter">
      <div className="site" style={{ padding: '2rem 1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>
              Arkiv
            </h1>
            <p style={{ fontSize: '16px', color: '#64748b' }}>
              Oversikt over alle lagrede UU-testrapporter
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <a
              href={`${baseUrl}rapport-generator`}
              style={{
                padding: '8px 16px',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: '#005AA0',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                textDecoration: 'none',
                fontFamily: 'inherit'
              }}
            >
              Til rapportgenerator
            </a>
            <span style={{ fontSize: '14px', color: '#64748b' }}>
              Innlogget som: {user.email}
            </span>
            <button
              onClick={handleLogout}
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
            >
              Logg ut
            </button>
          </div>
        </div>

        {/* Søk og filter */}
        <div style={{ 
          marginBottom: '24px', 
          padding: '24px', 
          backgroundColor: '#ffffff', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Søk
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Søk etter tittel eller URL..."
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
          <div style={{ minWidth: '200px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Testet av
            </label>
            <select
              value={filterTestetAv}
              onChange={(e) => setFilterTestetAv(e.target.value)}
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
              <option value="">Alle</option>
              {unikeTestetAv.map(navn => (
                <option key={navn} value={navn}>{navn}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Rapporter-liste */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
            Laster rapporter...
          </div>
        ) : filtrerteRapporter.length === 0 ? (
          <div style={{ 
            padding: '48px', 
            textAlign: 'center', 
            backgroundColor: '#ffffff', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px',
            color: '#64748b'
          }}>
            {rapporter.length === 0 ? 'Ingen rapporter i arkivet ennå.' : 'Ingen rapporter matcher søket.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filtrerteRapporter.map((rapport) => (
              <div
                key={rapport.id}
                style={{
                  padding: '24px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#0f172a' }}>
                    {rapport.tittel || 'Uten tittel'}
                  </h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '14px', color: '#64748b' }}>
                    <div>
                      <strong>Testdato:</strong> {rapport.testdato}
                    </div>
                    <div>
                      <strong>Testet av:</strong> {rapport.testetAv}
                    </div>
                    <div>
                      <strong>Versjon:</strong> {rapport.versjon}
                    </div>
                    {rapport.testUrl && (
                      <div>
                        <strong>URL:</strong> <a href={rapport.testUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#005AA0' }}>{rapport.testUrl}</a>
                      </div>
                    )}
                    {rapport.opprettet && (
                      <div>
                        <strong>Opprettet:</strong> {rapport.opprettet.toDate ? rapport.opprettet.toDate().toLocaleDateString('no-NO') : new Date(rapport.opprettet).toLocaleDateString('no-NO')}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {rapport.filUrl && (
                    <button
                      onClick={() => lastNedFil(rapport.filUrl!, `${rapport.tittel || 'rapport'}.docx`)}
                      style={{
                        padding: '8px 16px',
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
                      Last ned
                    </button>
                  )}
                  <button
                    onClick={() => slettRapport(rapport.id, rapport.filUrl)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '500',
                      backgroundColor: '#ffffff',
                      border: '1px solid #dc2626',
                      borderRadius: '6px',
                      color: '#dc2626',
                      cursor: 'pointer',
                  fontFamily: 'inherit'
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
    </Layout>
  );
}

