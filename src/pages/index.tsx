import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import useBaseUrl from '@docusaurus/useBaseUrl';

// Search result interface
interface SearchResult {
  title: string;
  url: string;
  category: string;
  parent?: string;
  parentUrl?: string;
  heading?: string;
  headingId?: string;
  level?: number;
}

function SearchResults({ query }: { query: string }) {
  const [searchIndex, setSearchIndex] = useState<SearchResult[]>([]);
  const [indexLoaded, setIndexLoaded] = useState(false);
  
  // Load search index on mount
  const searchIndexUrl = useBaseUrl('/search-index.json');
  
  useEffect(() => {
    if (!indexLoaded) {
      fetch(searchIndexUrl)
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error(`Failed to load search index: ${response.status}`);
        })
        .then(data => {
          console.log('Search index loaded:', data.length, 'entries');
          setSearchIndex(data);
          setIndexLoaded(true);
        })
        .catch(error => {
          console.warn('Could not load search index:', error);
          setSearchIndex([]);
          setIndexLoaded(true);
        });
    }
  }, [indexLoaded, searchIndexUrl]);
  
  const results = useMemo(() => {
    if (!query || query.trim().length < 2 || !indexLoaded || searchIndex.length === 0) {
      return null;
    }
    
    const lowerQuery = query.toLowerCase().trim();
    
    // Finn alle sider (level 0) som matcher søkeordet
    const matchingPages = searchIndex.filter(r => {
      if (r.level !== 0) return false; // Kun hovedsider
      const titleMatch = r.title.toLowerCase().includes(lowerQuery);
      const parentMatch = r.parent?.toLowerCase().includes(lowerQuery);
      return titleMatch || parentMatch;
    });
    
    // Finn alle underoverskrifter som matcher søkeordet direkte
    const matchingHeadings = searchIndex.filter(r => {
      if (r.level === 0) return false; // Kun underoverskrifter
      const headingMatch = r.heading?.toLowerCase().includes(lowerQuery);
      const titleMatch = r.title.toLowerCase().includes(lowerQuery);
      return headingMatch || titleMatch;
    });
    
    // Identifiser hvilke hovedsider som har matchende undertemaer
    const mainPagesWithMatchingSubs = new Set<string>();
    matchingHeadings.forEach(heading => {
      if (matchingPages.some(p => p.url === heading.parentUrl)) {
        mainPagesWithMatchingSubs.add(heading.parentUrl);
      }
    });
    
    // Organiser: hovedsider uten undertemaer først, deretter hovedsider med undertemaer (gruppert)
    const mainPagesWithoutSubs = matchingPages.filter(p => !mainPagesWithMatchingSubs.has(p.url));
    const mainPagesWithSubs = matchingPages.filter(p => mainPagesWithMatchingSubs.has(p.url));
    
    // Bygg ny liste: hovedsider uten undertemaer, deretter hovedsider med undertemaer gruppert
    const reorganized: SearchResult[] = [...mainPagesWithoutSubs];
    
    // Legg til hovedsider med undertemaer, gruppert sammen
    mainPagesWithSubs.forEach(mainPage => {
      reorganized.push(mainPage);
      // Legg til alle undertemaer for denne hovedsiden rett etter
      matchingHeadings.forEach(heading => {
        if (heading.parentUrl === mainPage.url) {
          reorganized.push(heading);
        }
      });
    });
    
    // Legg til undertemaer som tilhører hovedsider som ikke matchet direkte
    matchingHeadings.forEach(heading => {
      const parentMatchedDirectly = matchingPages.some(p => p.url === heading.parentUrl);
      if (!parentMatchedDirectly) {
        // Hovedsiden matchet ikke direkte, men har matchende undertemaer
        const parentPage = searchIndex.find(p => p.url === heading.parentUrl && p.level === 0);
        if (parentPage && !reorganized.some(p => p.url === parentPage.url)) {
          reorganized.push(parentPage);
        }
        reorganized.push(heading);
      }
    });
    
    if (reorganized.length === 0) {
      return { noResults: true };
    }
    
    // Fjern duplikater basert på URL (men behold første forekomst)
    const uniqueResults = reorganized.filter((result, index, self) =>
      index === self.findIndex(r => r.url === result.url)
    );
    
    // Grupper etter category og organisér slik at hovedsider kommer først med sine undertemaer
    const grouped: { [key: string]: SearchResult[] } = {};
    
    // Først: legg til alle hovedsider
    const mainPages = uniqueResults.filter(r => (r.level || 0) === 0);
    const subPages = uniqueResults.filter(r => (r.level || 0) > 0);
    
    mainPages.forEach(result => {
      if (!grouped[result.category]) {
        grouped[result.category] = [];
      }
      grouped[result.category].push(result);
    });
    
    // Deretter: legg til undertemaer rett etter deres hovedside
    subPages.forEach(subPage => {
      const category = subPage.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      
      // Finn hovedsiden for dette undertemaet
      const parentIndex = grouped[category].findIndex(
        r => r.url === subPage.parentUrl && (r.level || 0) === 0
      );
      
      if (parentIndex >= 0) {
        // Hovedsiden finnes - legg til undertemaet rett etter den
        // Finn hvor neste hovedside er, eller legg til på slutten
        let insertIndex = parentIndex + 1;
        while (
          insertIndex < grouped[category].length &&
          (grouped[category][insertIndex].level || 0) > 0 &&
          grouped[category][insertIndex].parentUrl === subPage.parentUrl
        ) {
          insertIndex++;
        }
        grouped[category].splice(insertIndex, 0, subPage);
      } else {
        // Hovedsiden finnes ikke i denne kategorien, legg til på slutten
        grouped[category].push(subPage);
      }
    });
    
    // Sorter hver gruppe: hovedsider først, deretter deres undertemaer gruppert direkte etter
    Object.keys(grouped).forEach(key => {
      const categoryResults = grouped[key];
      
      // Separer hovedsider og undertemaer
      const mainPages: SearchResult[] = [];
      const subPages: SearchResult[] = [];
      
      categoryResults.forEach(result => {
        if ((result.level || 0) === 0) {
          mainPages.push(result);
        } else {
          subPages.push(result);
        }
      });
      
      // Sorter hovedsider alfabetisk
      mainPages.sort((a, b) => a.title.localeCompare(b.title));
      
      // Sorter undertemaer alfabetisk innenfor samme parent
      subPages.sort((a, b) => {
        if (a.parentUrl === b.parentUrl) {
          return a.title.localeCompare(b.title);
        }
        return 0; // Behold rekkefølgen basert på parent
      });
      
      // Bygg ny liste: hovedside -> dens undertemaer -> neste hovedside -> dens undertemaer, osv.
      const reorganized: SearchResult[] = [];
      const processedSubPages = new Set<string>(); // Track hvilke undertemaer som er lagt til
      
      // Først legg til alle hovedsider og deres undertemaer
      mainPages.forEach(mainPage => {
        reorganized.push(mainPage);
        
        // Legg til alle undertemaer for denne hovedsiden rett etter
        subPages.forEach(subPage => {
          if (subPage.parentUrl === mainPage.url && !processedSubPages.has(subPage.url + subPage.title)) {
            reorganized.push(subPage);
            processedSubPages.add(subPage.url + subPage.title);
          }
        });
      });
      
          // Legg til eventuelle undertemaer som ikke har en matchande hovedside i denne kategorien
          // (disse er allerede håndtert i den tidligere logikken, så vi kan hoppe over dem her)
          subPages.forEach(subPage => {
            if (!processedSubPages.has(subPage.url + subPage.title)) {
              // Hovedsiden er allerede i listen fra tidligere logikk, men vi legger til undertemaet
              reorganized.push(subPage);
              processedSubPages.add(subPage.url + subPage.title);
            }
          });
      
      grouped[key] = reorganized;
    });
    
    return grouped;
  }, [query, searchIndex, indexLoaded]);

  const searchResultsStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    width: '100%',
    maxWidth: '600px',
    marginTop: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    maxHeight: '500px',
    overflowY: 'auto',
    padding: '8px',
  };

  const sectionStyle: React.CSSProperties = {
    padding: '4px 0',
  };

  const headerStyle: React.CSSProperties = {
    padding: '10px 16px 8px 16px',
    fontSize: '11px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#475569',
    letterSpacing: '0.1em',
    backgroundColor: '#f8fafc',
    borderRadius: '6px',
    marginBottom: '8px',
  };

  // Lysegrønn styling for Storybook-kategorier og resultater
  const storybookHeaderStyle: React.CSSProperties = {
    ...headerStyle,
    backgroundColor: '#f0fdf4',
  };

  const linkStyle: React.CSSProperties = {
    display: 'block',
    padding: '12px 16px',
    textDecoration: 'none',
    borderRadius: '6px',
    transition: 'all 0.15s ease',
    marginBottom: '4px',
  };

  const mainPageLinkStyle: React.CSSProperties = {
    ...linkStyle,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    padding: '14px 16px',
    marginBottom: '6px',
  };

  const subPageLinkStyle: React.CSSProperties = {
    ...linkStyle,
    paddingLeft: '32px',
    paddingTop: '8px',
    paddingBottom: '8px',
    backgroundColor: 'transparent',
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: '600',
    color: '#0f172a',
    fontSize: '15px',
    marginBottom: '4px',
    lineHeight: '1.4',
  };

  const subTitleStyle: React.CSSProperties = {
    fontWeight: '500',
    color: '#475569',
    fontSize: '13px',
    marginBottom: '2px',
    lineHeight: '1.4',
  };

  const categoryStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#64748b',
    marginTop: '2px',
  };

  const mainPageCategoryStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#475569',
    fontWeight: '500',
    marginTop: '2px',
  };

  if (!results) return null;

  // Handle "no results" case
  if (results && 'noResults' in results) {
    return (
      <div style={searchResultsStyle}>
        <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
          Ingen treff
        </div>
      </div>
    );
  }
  
  if (!results) return null;
  
  const categories = Object.keys(results);
  
  return (
    <div style={searchResultsStyle}>
      {categories.map((category, catIdx) => (
        <div 
          key={category} 
          style={{ 
            ...sectionStyle, 
            ...(catIdx > 0 ? { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' } : {})
          }}
        >
          {(() => {
            // Sjekk om kategorien er Storybook
            const isStorybookCategory = category === 'STORYBOOK' || category.toLowerCase().includes('storybook');
            return (
              <div style={isStorybookCategory ? storybookHeaderStyle : headerStyle}>{category}</div>
            );
          })()}
          {results[category].map((result, idx) => {
            const isMainPage = (result.level || 0) === 0;
            const isSubPage = !isMainPage;
            // Sjekk om resultatet kommer fra Storybook
            const isStorybook = result.url && (result.url.includes('skatteetaten.github.io/designsystemet') || result.url.includes('storybook'));
            const isStorybookCategory = category === 'STORYBOOK' || category.toLowerCase().includes('storybook');
            
            // Sjekk om dette er første eller siste element i en gruppe
            const prevResult = idx > 0 ? results[category][idx - 1] : null;
            const nextResult = idx < results[category].length - 1 ? results[category][idx + 1] : null;
            const isFirstInGroup = isMainPage || (isSubPage && prevResult && (prevResult.level || 0) === 0);
            const isLastInGroup = isSubPage && (!nextResult || (nextResult.level || 0) === 0);
            
            // Bestem om dette er en del av en gruppe med underoverskrifter
            const hasSubPages = isMainPage && nextResult && (nextResult.level || 0) > 0 && nextResult.parentUrl === result.url;
            
            // Lysegrønn bakgrunnsfarge og border for Storybook-resultater
            const storybookBgColor = (isStorybook || isStorybookCategory) ? '#f0fdf4' : (isMainPage ? '#f8fafc' : 'transparent');
            const storybookHoverBgColor = (isStorybook || isStorybookCategory) ? '#dcfce7' : (isMainPage ? '#f1f5f9' : '#f8fafc');
            const storybookBorderColor = (isStorybook || isStorybookCategory) ? '#bbf7d0' : '#e2e8f0';
            const storybookHoverBorderColor = (isStorybook || isStorybookCategory) ? '#86efac' : '#cbd5e1';
            
            return (
              <div
                key={idx}
                style={{
                  ...(hasSubPages ? {
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    padding: '4px',
                    marginBottom: '12px',
                  } : {}),
                  ...(isSubPage && !hasSubPages ? {
                    marginBottom: '4px',
                  } : {}),
                }}
              >
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...(isMainPage ? mainPageLinkStyle : subPageLinkStyle),
                    backgroundColor: storybookBgColor,
                    ...(isMainPage && isStorybook ? { borderColor: storybookBorderColor } : {}),
                    ...(isSubPage ? {
                      paddingLeft: '48px', // Økt innrykk for underoverskrifter
                      borderLeft: '3px solid #cbd5e1', // Tydeligere vertikal linje
                      marginLeft: '12px', // Mer margin for å skape visuell gruppering
                      backgroundColor: '#fafbfc', // Subtil bakgrunnsfarge for underoverskrifter
                      borderRadius: '6px',
                    } : {}),
                    ...(isLastInGroup ? {
                      marginBottom: '6px', // Spacing etter siste underoverskrift
                    } : {}),
                    ...(isFirstInGroup && isSubPage ? {
                      marginTop: '6px', // Spacing før første underoverskrift
                    } : {}),
                    ...(hasSubPages && isMainPage ? {
                      marginBottom: '0px', // Ingen margin når det er en gruppe
                    } : {}),
                  }}
                  onMouseEnter={(e) => { 
                    if (isMainPage) {
                      e.currentTarget.style.backgroundColor = storybookHoverBgColor;
                      e.currentTarget.style.borderColor = storybookHoverBorderColor;
                    } else {
                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                      e.currentTarget.style.borderLeftColor = '#64748b'; // Mørkere linje ved hover
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if (isMainPage) {
                      e.currentTarget.style.backgroundColor = storybookBgColor;
                      e.currentTarget.style.borderColor = storybookBorderColor;
                    } else {
                      e.currentTarget.style.backgroundColor = '#fafbfc';
                      e.currentTarget.style.borderLeftColor = '#cbd5e1'; // Tilbake til normal farge
                    }
                  }}
                >
                <div style={isMainPage ? titleStyle : subTitleStyle}>
                  {isSubPage && (
                    <span style={{ 
                      display: 'inline-block', 
                      width: '16px', 
                      marginRight: '6px',
                      color: '#94a3b8',
                      fontSize: '14px',
                      verticalAlign: 'middle',
                    }}>▸</span>
                  )}
                  {result.title}
                </div>
                {(result.parent || result.heading) && (
                  <div style={{
                    ...(isMainPage ? mainPageCategoryStyle : categoryStyle),
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop: '4px',
                  }}>
                    {result.parent && (
                      <span style={{ color: '#64748b' }}>{result.parent}</span>
                    )}
                    {!result.parent && result.heading && (
                      <span style={{ color: '#475569', fontStyle: 'normal', textTransform: 'none', fontWeight: '500' }}>
                        {result.heading}
                      </span>
                    )}
                  </div>
                )}
                </a>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export default function Home(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const komponenterIcon = useBaseUrl('/img/komponenter.png');
  const stilogtoneIcon = useBaseUrl('/img/stilogtone.png');
  const utviklerIcon = useBaseUrl('/img/utvikler.png');
  const tilgjengelighetIcon = useBaseUrl('/img/tilgjengelighet.png');

  // Lukk søkelista ved klikk utenfor
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    // Lukk søkelista ved Escape-tast (uten å slette teksten)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsSearchOpen(false);
      }
    };

    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSearchOpen]);

  return (
    <Layout
      title="Søk stil og tone"
      description="Finn alt om komponenter, mønstre, stil og utvikling i Skatteetatens designsystem.">
      <main style={{
        minHeight: 'calc(100vh - 200px)',
        padding: '80px 24px 120px',
        backgroundColor: '#fafbfc',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          {/* Hero Section */}
          <div style={{
            textAlign: 'center',
            marginBottom: '64px',
          }}>
            <h1 style={{
              fontSize: '48px',
              fontWeight: '700',
              color: '#0f172a',
              marginBottom: '16px',
              letterSpacing: '-0.02em',
              lineHeight: '1.2',
            }}>
              Søk stil og tone
            </h1>
            <p style={{
              fontSize: '20px',
              color: '#64748b',
              marginBottom: '48px',
              fontWeight: '400',
              maxWidth: '600px',
              margin: '0 auto 48px',
            }}>
              Ett sted for alt du trenger – komponenter, mønstre, stil og tekniske retningslinjer.
            </p>
            
            {/* Search */}
            <div 
              ref={searchRef}
              style={{
                position: 'relative',
                display: 'inline-block',
                width: '100%',
                maxWidth: '600px',
                marginBottom: '64px',
              }}
            >
              <input
                type="search"
                placeholder="Skriv her"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value) {
                    setIsSearchOpen(true);
                  }
                }}
                onClick={() => {
                  if (searchQuery) {
                    setIsSearchOpen(true);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '16px 20px 16px 48px',
                  borderRadius: '12px',
                  border: '3px solid #475569',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  backgroundColor: '#ffffff',
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2394a3b8\' stroke-width=\'2\'%3E%3Ccircle cx=\'11\' cy=\'11\' r=\'8\'/%3E%3Cpath d=\'m21 21-4.35-4.35\'/%3E%3C/svg%3E")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: '16px center',
                  backgroundSize: '20px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
                  if (searchQuery) {
                    setIsSearchOpen(true);
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#475569';
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsSearchOpen(false);
                  }
                }}
              />
              {isSearchOpen && searchQuery && (
                <SearchResults query={searchQuery} />
              )}
            </div>
          </div>

          {/* Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            marginBottom: '64px',
          }}>
            <Link
              to="https://skatteetaten.github.io/designsystemet/"
              style={{
                display: 'block',
                padding: '32px',
                backgroundColor: '#fef3f2',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <img 
                src={komponenterIcon} 
                alt="Komponenter"
                style={{
                  width: '48px',
                  height: '48px',
                  marginBottom: '16px',
                  objectFit: 'contain',
                }}
              />
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#0f172a',
              }}>
                Komponenter
              </h2>
              <p style={{
                color: '#64748b',
                fontSize: '15px',
                lineHeight: '1.6',
                margin: 0,
              }}>
                Utforsk komponenter og deres bruk i Storybook.
              </p>
            </Link>

            <Link
              to="https://www.skatteetaten.no/stilogtone/"
              style={{
                display: 'block',
                padding: '32px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <img 
                src={stilogtoneIcon} 
                alt="Stil og tone"
                style={{
                  width: '48px',
                  height: '48px',
                  marginBottom: '16px',
                  objectFit: 'contain',
                }}
              />
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#0f172a',
              }}>
                Stil og tone
              </h2>
              <p style={{
                color: '#64748b',
                fontSize: '15px',
                lineHeight: '1.6',
                margin: 0,
              }}>
                Les om mønstre, god praksis og visuell stil.
              </p>
            </Link>

            <Link
              to="https://github.com/Skatteetaten/designsystemet"
              style={{
                display: 'block',
                padding: '32px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <img 
                src={utviklerIcon} 
                alt="Utviklerressurser"
                style={{
                  width: '48px',
                  height: '48px',
                  marginBottom: '16px',
                  objectFit: 'contain',
                }}
              />
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#0f172a',
              }}>
                Utviklerressurser
              </h2>
              <p style={{
                color: '#64748b',
                fontSize: '15px',
                lineHeight: '1.6',
                margin: 0,
              }}>
                Kildekode, tekniske krav og retningslinjer.
              </p>
            </Link>

            <Link
              to="https://www.skatteetaten.no/stilogtone/god-praksis/universell-utforming/"
              style={{
                display: 'block',
                padding: '32px',
                backgroundColor: '#fefce8',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <img 
                src={tilgjengelighetIcon} 
                alt="Tilgjengelighet"
                style={{
                  width: '48px',
                  height: '48px',
                  marginBottom: '16px',
                  objectFit: 'contain',
                }}
              />
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#0f172a',
              }}>
                Tilgjengelighet
              </h2>
              <p style={{
                color: '#64748b',
                fontSize: '15px',
                lineHeight: '1.6',
                margin: 0,
              }}>
                Lær hvordan vi sikrer universell utforming i Skatteetatens løsninger.
              </p>
            </Link>
          </div>

          {/* Component Generator CTA */}
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            marginBottom: '24px',
          }}>
            <h3 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#0f172a',
            }}>
              Komponent-generator
            </h3>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              marginBottom: '24px',
              maxWidth: '500px',
              margin: '0 auto 24px',
            }}>
              Generer komponenter fra tekstbeskrivelse
            </p>
            <Link
              to="/generator"
              style={{
                display: 'inline-block',
                padding: '14px 28px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '16px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1e293b';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#0f172a';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Åpne generator
            </Link>
          </div>

          {/* Rapport Generator CTA */}
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
          }}>
            <h3 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '12px',
              color: '#0f172a',
            }}>
              UU-rapport-generator
            </h3>
            <p style={{
              color: '#64748b',
              fontSize: '16px',
              marginBottom: '24px',
              maxWidth: '500px',
              margin: '0 auto 24px',
            }}>
              Fyll ut og generer profesjonelle UU-testrapporter med automatisk struktur og eksport til Word/PDF
            </p>
            <Link
              to="/rapport-generator"
              style={{
                display: 'inline-block',
                padding: '14px 28px',
                backgroundColor: '#005AA0',
                color: '#ffffff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: '600',
                fontSize: '16px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#0066b3';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#005AA0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Åpne rapportgenerator
            </Link>
          </div>
        </div>
      </main>
    </Layout>
  );
}
