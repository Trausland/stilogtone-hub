import React, { useState } from 'react';
import Layout from '@theme/Layout';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getAuthInstance } from '@site/src/utils/firebase';
import useBaseUrl from '@docusaurus/useBaseUrl';
import '@skatteetaten/ds-core-designtokens/index.css';

export default function Login(): React.JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const baseUrl = useBaseUrl('/');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const authInstance = getAuthInstance();
      if (isSignUp) {
        await createUserWithEmailAndPassword(authInstance, email, password);
      } else {
        await signInWithEmailAndPassword(authInstance, email, password);
      }
      // Redirect vil håndteres av onAuthStateChanged i arkiv-siden
      window.location.href = `${baseUrl}arkiv`;
    } catch (error: any) {
      console.error('Feil ved innlogging:', error);
      setError(error.message || 'Kunne ikke logge inn. Sjekk e-post og passord.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Innlogging - Rapportgenerator for UU-test" description="Logg inn for å få tilgang til arkivet">
      <div className="site" style={{ padding: '2rem 1rem', maxWidth: '500px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>
          {isSignUp ? 'Opprett bruker' : 'Logg inn'}
        </h1>
        <p style={{ fontSize: '16px', color: '#64748b', marginBottom: '32px' }}>
          {isSignUp ? 'Opprett en ny bruker for å få tilgang til arkivet.' : 'Logg inn for å få tilgang til arkivet med UU-testrapporter.'}
        </p>

        <form onSubmit={handleSubmit} style={{
          padding: '24px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px'
        }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              marginBottom: '16px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              E-post
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '14px' }}>
              Passord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
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

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              backgroundColor: loading ? '#94a3b8' : '#005AA0',
              border: 'none',
              borderRadius: '6px',
              color: '#ffffff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              marginBottom: '16px'
            }}
          >
            {loading ? 'Laster...' : (isSignUp ? 'Opprett bruker' : 'Logg inn')}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError('');
            }}
            style={{
              width: '100%',
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#005AA0',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'underline'
            }}
          >
            {isSignUp ? 'Har du allerede en bruker? Logg inn' : 'Har du ikke bruker? Opprett en'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a 
            href={`${baseUrl}rapport-generator`}
            style={{
              color: '#005AA0',
              textDecoration: 'none',
              fontSize: '14px'
            }}
          >
            ← Tilbake til rapportgenerator
          </a>
        </div>
      </div>
    </Layout>
  );
}


