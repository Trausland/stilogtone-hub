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
    
    // Fjern duplikater basert på URL og heading (men behold første forekomst)
    // Dette sikrer at headings med samme URL (men forskjellig heading) ikke blir fjernet
    const uniqueResults = reorganized.filter((result, index, self) =>
      index === self.findIndex(r => {
        // Hvis begge har heading, må både URL og heading matche for å være duplikat
        if (r.heading && result.heading) {
          return r.url === result.url && r.heading === result.heading;
        }
        // Hvis ingen av dem har heading, eller bare en har heading, sjekk bare URL
        return r.url === result.url;
      })
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

  // Helper function to highlight search query in text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={index} style={{ color: '#005AA0', fontWeight: '600' }}>{part}</span>
      ) : part
    );
  };

  const searchResultsStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    width: '100%',
    maxWidth: '600px',
    marginTop: '8px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    maxHeight: '500px',
    overflowY: 'auto',
    padding: '8px',
  };

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    marginBottom: '8px',
  };

  const sectionHeaderIconStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    color: '#64748b',
  };

  const sectionHeaderTextStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '700',
    color: '#0f172a',
  };

  const resultCardStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '8px',
    textDecoration: 'none',
    transition: 'all 0.15s ease',
    cursor: 'pointer',
  };

  const resultCardContentStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    textAlign: 'left',
  };

  const resultTitleStyle: React.CSSProperties = {
    fontWeight: '600',
    color: '#0f172a',
    fontSize: '15px',
    marginBottom: '4px',
    lineHeight: '1.4',
    textAlign: 'left',
  };

  const resultSubtitleStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    lineHeight: '1.4',
    textAlign: 'left',
  };

  const arrowIconStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    color: '#3b82f6',
    flexShrink: 0,
  };

  const subItemIconStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
    color: '#64748b',
    marginRight: '8px',
    flexShrink: 0,
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
  
  // Sorter kategorier: "Stil og tone" først, "Storybook" sist
  const categories = Object.keys(results).sort((a, b) => {
    // "Stil og tone" skal alltid komme først
    if (a === 'Stil og tone' && b !== 'Stil og tone') return -1;
    if (b === 'Stil og tone' && a !== 'Stil og tone') return 1;
    
    // "Storybook" skal alltid komme sist
    if (a === 'Storybook' && b !== 'Storybook') return 1;
    if (b === 'Storybook' && a !== 'Storybook') return -1;
    
    // For andre kategorier, behold alfabetisk rekkefølge
    return a.localeCompare(b);
  });
  
  return (
    <div style={searchResultsStyle}>
      {/* Results by Category */}
      {categories.map((category, catIdx) => (
        <div key={category} style={catIdx > 0 ? { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' } : {}}>
          {/* Category Header */}
          <div style={sectionHeaderStyle}>
            {(() => {
              const isStorybookCategory = category === 'STORYBOOK' || category.toLowerCase().includes('storybook');
              if (isStorybookCategory) {
                return (
                  <svg viewBox="-31.5 0 319 319" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" preserveAspectRatio="xMidYMid" style={sectionHeaderIconStyle}>
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      <defs>
                        <path d="M9.87245893,293.324145 L0.0114611411,30.5732167 C-0.314208957,21.8955842 6.33948896,14.5413918 15.0063196,13.9997149 L238.494389,0.0317105427 C247.316188,-0.519651867 254.914637,6.18486163 255.466,15.0066607 C255.486773,15.339032 255.497167,15.6719708 255.497167,16.0049907 L255.497167,302.318596 C255.497167,311.157608 248.331732,318.323043 239.492719,318.323043 C239.253266,318.323043 239.013844,318.317669 238.774632,318.306926 L25.1475605,308.712253 C16.8276309,308.338578 10.1847994,301.646603 9.87245893,293.324145 L9.87245893,293.324145 Z" id="path-1"></path>
                      </defs>
                      <g>
                        <mask id="mask-2" fill="white">
                          <use xlinkHref="#path-1"></use>
                        </mask>
                        <use fill="#FF4785" fillRule="nonzero" xlinkHref="#path-1"></use>
                        <path d="M188.665358,39.126973 L190.191903,2.41148534 L220.883535,0 L222.205755,37.8634126 C222.251771,39.1811466 221.22084,40.2866846 219.903106,40.3327009 C219.338869,40.3524045 218.785907,40.1715096 218.342409,39.8221376 L206.506729,30.4984116 L192.493574,41.1282444 C191.443077,41.9251106 189.945493,41.7195021 189.148627,40.6690048 C188.813185,40.2267976 188.6423,39.6815326 188.665358,39.126973 Z M149.413703,119.980309 C149.413703,126.206975 191.355678,123.222696 196.986019,118.848893 C196.986019,76.4467826 174.234041,54.1651411 132.57133,54.1651411 C90.9086182,54.1651411 67.5656805,76.7934542 67.5656805,110.735941 C67.5656805,169.85244 147.345341,170.983856 147.345341,203.229219 C147.345341,212.280549 142.913138,217.654777 133.162291,217.654777 C120.456641,217.654777 115.433477,211.165914 116.024438,189.103298 C116.024438,184.317101 67.5656805,182.824962 66.0882793,189.103298 C62.3262146,242.56887 95.6363019,257.990394 133.753251,257.990394 C170.688279,257.990394 199.645341,238.303123 199.645341,202.663511 C199.645341,139.304202 118.683759,141.001326 118.683759,109.604526 C118.683759,96.8760922 128.139127,95.178968 133.753251,95.178968 C139.662855,95.178968 150.300143,96.2205679 149.413703,119.980309 Z" fill="#FFFFFF" fillRule="nonzero" mask="url(#mask-2)"></path>
                      </g>
                    </g>
                  </svg>
                );
              } else {
                return (
                  <svg xmlns="http://www.w3.org/2000/svg" enableBackground="new 0 0 24 24" height="24" style={sectionHeaderIconStyle} viewBox="0 0 24 24" width="24">
                    <g>
                      <rect fill="none" height="24" width="24"/>
                    </g>
                    <g fill="rgb(111, 44, 63)">
                      <path d="M21,5c-1.11-0.35-2.33-0.5-3.5-0.5c-1.95,0-4.05,0.4-5.5,1.5c-1.45-1.1-3.55-1.5-5.5-1.5S2.45,4.9,1,6v14.65 c0,0.25,0.25,0.5,0.5,0.5c0.1,0,0.15-0.05,0.25-0.05C3.1,20.45,5.05,20,6.5,20c1.95,0,4.05,0.4,5.5,1.5c1.35-0.85,3.8-1.5,5.5-1.5 c1.65,0,3.35,0.3,4.75,1.05c0.1,0.05,0.15,0.05,0.25,0.05c0.25,0,0.5-0.25,0.5-0.5V6C22.4,5.55,21.75,5.25,21,5z M21,18.5 c-1.1-0.35-2.3-0.5-3.5-0.5c-1.7,0-4.15,0.65-5.5,1.5V8c1.35-0.85,3.8-1.5,5.5-1.5c1.2,0,2.4,0.15,3.5,0.5V18.5z"/>
                      <path d="M17.5,10.5c0.88,0,1.73,0.09,2.5,0.26V9.24C19.21,9.09,18.36,9,17.5,9c-1.7,0-3.24,0.29-4.5,0.83v1.66 C14.13,10.85,15.7,10.5,17.5,10.5z"/>
                      <path d="M13,12.49v1.66c1.13-0.64,2.7-0.99,4.5-0.99c0.88,0,1.73,0.09,2.5,0.26V11.9c-0.79-0.15-1.64-0.24-2.5-0.24 C15.8,11.66,14.26,11.96,13,12.49z"/>
                      <path d="M17.5,14.33c-1.7,0-3.24,0.29-4.5,0.83v1.66c1.13-0.64,2.7-0.99,4.5-0.99c0.88,0,1.73,0.09,2.5,0.26v-1.52 C19.21,14.41,18.36,14.33,17.5,14.33z"/>
                    </g>
                  </svg>
                );
              }
            })()}
            <span style={sectionHeaderTextStyle}>{category}</span>
          </div>

          {/* Category Results */}
          {results[category].map((result, idx) => {
            const isSubPage = (result.level || 0) > 0;
            const subtitle = result.parent || result.heading || category;
            
            return (
              <a
                key={`${result.url}-${idx}`}
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                style={resultCardStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
              >
                <div style={resultCardContentStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    {isSubPage && (
                      <svg xmlns="http://www.w3.org/2000/svg" style={subItemIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 7v7h8" />
                        <path d="M14 10l3 3-3 3" />
                      </svg>
                    )}
                    <div style={resultTitleStyle}>
                      {highlightText(result.title, query)}
                    </div>
                  </div>
                  {subtitle && (
                    <div style={{ paddingLeft: isSubPage ? '28px' : '0' }}>
                      <div style={resultSubtitleStyle}>
                        {subtitle}
                      </div>
                    </div>
                  )}
                </div>
                <svg style={arrowIconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </a>
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
            <style>{`
              input[type="search"]::-webkit-search-cancel-button {
                -webkit-appearance: none;
                appearance: none;
                display: none;
              }
              input[type="search"]::-ms-clear {
                display: none;
              }
            `}</style>
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
              <div style={{ position: 'relative', width: '100%' }}>
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
                    padding: '16px 44px 16px 48px',
                    borderRadius: '8px',
                    border: '1px solid #3b82f6',
                    boxShadow: 'none',
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
                    if (searchQuery) {
                      setIsSearchOpen(true);
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsSearchOpen(false);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSearchQuery('');
                      setIsSearchOpen(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#475569';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
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
