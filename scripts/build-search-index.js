#!/usr/bin/env node
/**
 * Build script for creating a search index from stilogtone.no and Storybook
 * Crawls all pages from stilogtone.no and extracts headings
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Polyfill File API for Node.js < 20
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(bits, name, options = {}) {
      this.name = name;
      this.type = options.type || '';
      this.size = bits.length;
      this.lastModified = options.lastModified || Date.now();
      this.bits = bits;
    }
  };
}

const BASE_URL = 'https://www.skatteetaten.no';
const START_URL = 'https://www.skatteetaten.no/stilogtone/';
const STORYBOOK_BASE = 'https://skatteetaten.github.io/designsystemet';

// Landing pages that should be excluded from search results (navigation pages only)
const LANDING_PAGES = new Set([
  'https://www.skatteetaten.no/stilogtone/god-praksis/',
  'https://www.skatteetaten.no/stilogtone/skrive/',
  'https://www.skatteetaten.no/stilogtone/monster/',
  'https://www.skatteetaten.no/stilogtone/designsystemet/',
  'https://www.skatteetaten.no/stilogtone/visuelt/',
  'https://www.skatteetaten.no/stilogtone/monster/interaksjon/',
  'https://www.skatteetaten.no/stilogtone/monster/skatteetatenno/',
  'https://www.skatteetaten.no/stilogtone/monster/skjemadesign',
]);

// Track visited URLs to avoid duplicates
const visited = new Set();
const toVisit = [START_URL];
const pages = [];

// Helper to normalize URLs
function normalizeUrl(url) {
  try {
    const urlObj = new URL(url, BASE_URL);
    // Remove fragments and trailing slashes
    return urlObj.origin + urlObj.pathname.replace(/\/$/, '') || '/';
  } catch {
    return null;
  }
}

// Extract headings from HTML
function extractHeadings(html, baseUrl) {
  const $ = cheerio.load(html);
  const headings = [];
  
  // Extract h1 (page title)
  const h1 = $('h1').first().text().trim();
  
  // First, find all anchor links on the page that point to headings
  // Store mapping of heading text to anchor ID (prioritize semantic IDs)
  const headingToAnchorMap = new Map();
  
  // Find all links that point to headings (href="#id")
  // Also find all elements with IDs that might be anchor targets
  const allAnchorIds = new Set();
  $('a[href^="#"]').each((i, elem) => {
    const $link = $(elem);
    const href = $link.attr('href');
    if (!href || href === '#') return;
    
    const anchorId = href.substring(1); // Remove #
    allAnchorIds.add(anchorId);
    
    // Check if this is a GUID-based ID (with or without dash after ID)
    const isGuidBased = anchorId.match(/^ID-?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
    
    // Find the heading this link is associated with
    // Could be a sibling, parent, or nearby heading
    const $heading = $link.closest('h2, h3, h4').first();
    if ($heading.length) {
      const headingText = $heading.text().trim();
      if (headingText) {
        // Only set if no mapping exists, or if existing mapping is GUID-based and this is semantic
        if (!headingToAnchorMap.has(headingText)) {
          headingToAnchorMap.set(headingText, anchorId);
        } else {
          const existingId = headingToAnchorMap.get(headingText);
          const existingIsGuid = existingId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
          // Replace GUID-based ID with semantic ID
          if (existingIsGuid && !isGuidBased) {
            headingToAnchorMap.set(headingText, anchorId);
          }
        }
      }
    } else {
      // Check if link is right before a heading
      const $nextHeading = $link.next('h2, h3, h4').first();
      if ($nextHeading.length) {
        const headingText = $nextHeading.text().trim();
        if (headingText) {
          // Only set if no mapping exists, or if existing mapping is GUID-based and this is semantic
          if (!headingToAnchorMap.has(headingText)) {
            headingToAnchorMap.set(headingText, anchorId);
          } else {
            const existingId = headingToAnchorMap.get(headingText);
            const existingIsGuid = existingId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
            // Replace GUID-based ID with semantic ID
            if (existingIsGuid && !isGuidBased) {
              headingToAnchorMap.set(headingText, anchorId);
            }
          }
        }
      }
    }
    
    // Also check if link text matches a heading (for table of contents)
    const linkText = $link.text().trim();
    if (linkText) {
      // Find headings with matching text
      $('h2, h3, h4').each((j, headingElem) => {
        const $heading = $(headingElem);
        const headingText = $heading.text().trim();
        // Match if link text is similar to heading text
        if (headingText && (headingText === linkText || headingText.includes(linkText) || linkText.includes(headingText))) {
          // Only set if no mapping exists, or if existing mapping is GUID-based and this is semantic
          if (!headingToAnchorMap.has(headingText)) {
            headingToAnchorMap.set(headingText, anchorId);
          } else {
            const existingId = headingToAnchorMap.get(headingText);
            const existingIsGuid = existingId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
            // Replace GUID-based ID with semantic ID
            if (existingIsGuid && !isGuidBased) {
              headingToAnchorMap.set(headingText, anchorId);
            }
          }
        }
      });
    }
  });
  
  // Also find all elements with IDs on the page
  $('[id]').each((i, elem) => {
    const $elem = $(elem);
    const id = $elem.attr('id');
    if (id) {
      allAnchorIds.add(id);
      
      // Check if this is a GUID-based ID
      const isGuidBased = id.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
      
      // Check if this element is a heading or associated with one
      const $heading = $elem.is('h2, h3, h4') ? $elem : $elem.closest('h2, h3, h4').first();
      if ($heading.length) {
        // If this element IS a heading with an ID, prioritize it in the mapping
        const headingText = $heading.text().trim();
        if (headingText) {
          // Always use the heading's own ID if it exists (prioritize semantic IDs on headings)
          if (!headingToAnchorMap.has(headingText)) {
            headingToAnchorMap.set(headingText, id);
          } else {
            const existingId = headingToAnchorMap.get(headingText);
            const existingIsGuid = existingId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
            // Replace GUID-based ID with semantic ID, or if this is a heading's own ID, always use it
            if (existingIsGuid && !isGuidBased) {
              headingToAnchorMap.set(headingText, id);
            } else if ($elem.is('h2, h3, h4') && !isGuidBased) {
              // If this is the heading element itself with a semantic ID, always use it
              headingToAnchorMap.set(headingText, id);
            }
          }
        }
      } else if (!$heading.length && $elem.closest('a, button').length === 0) {
        // Check if heading is nearby
        const $nearbyHeading = $elem.prev('h2, h3, h4').first();
        if ($nearbyHeading.length) {
          const headingText = $nearbyHeading.text().trim();
          if (headingText) {
            // Only set if no mapping exists, or if existing mapping is GUID-based and this is semantic
            if (!headingToAnchorMap.has(headingText)) {
              headingToAnchorMap.set(headingText, id);
            } else {
              const existingId = headingToAnchorMap.get(headingText);
              const existingIsGuid = existingId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
              // Replace GUID-based ID with semantic ID
              if (existingIsGuid && !isGuidBased) {
                headingToAnchorMap.set(headingText, id);
              }
            }
          }
        }
      }
    }
  });
  
  // Extract h2, h3, h4 as subheadings
  $('h2, h3, h4').each((i, elem) => {
    const $elem = $(elem);
    const text = $elem.text().trim();
    if (!text) return;
    
    let id = null;
    let guidBasedId = null; // Store GUID-based IDs separately
    
    // CRITICAL: First, check if heading element has a semantic ID on itself
    // This must be checked FIRST to ensure it's always prioritized over any other IDs
    const headingSemanticId = $elem.attr('id');
    if (headingSemanticId && !headingSemanticId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
      // Always use the heading's own semantic ID if it exists (like id="innholdsdesign")
      id = headingSemanticId;
    } else if (headingSemanticId && headingSemanticId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
      // Store GUID-based ID separately
      guidBasedId = headingSemanticId;
    }
    
    // Also check if there's an anchor link inside the heading that points to a semantic ID
    // This handles cases where the ID is added dynamically with JavaScript (e.g., by Docusaurus)
    // The anchor link (e.g., <a href="#innholdsdesign">) is in the HTML, but the ID on the heading
    // element itself is added dynamically, so we use the anchor link's href as the semantic ID
    if (!id) {
      const $anchor = $elem.find('a[href^="#"]');
      if ($anchor.length) {
        $anchor.each((j, anchor) => {
          const href = $(anchor).attr('href');
          if (href && href.startsWith('#')) {
            const targetId = href.substring(1);
            // Check if it's a semantic ID (not GUID-based)
            if (!targetId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
              // Use the semantic ID from the anchor link directly
              // Don't check if element exists since ID is added dynamically with JavaScript
              id = targetId;
              return false; // Break out of each loop
            }
          }
        });
      }
    }
    
    // If no semantic ID exists, check if heading is wrapped in an anchor tag or button
    // Also check if there's a button inside the heading with a data-target pointing to a GUID-based ID
    if (!id) {
      // First, check if heading is wrapped in an anchor tag or button
      const $parentAnchor = $elem.closest('a[id], button[id]');
      if ($parentAnchor.length) {
        const parentId = $parentAnchor.attr('id');
        if (!parentId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
          id = parentId;
        } else if (!guidBasedId) {
          guidBasedId = parentId;
        }
      }
      
      // Check if there's a button inside the heading with a span.oc-heading
      // For headings with buttons, the button text usually matches the semantic ID
      // Generate semantic ID from button text instead of using GUID from data-target
      if (!id) {
        const $button = $elem.find('button');
        if ($button.length) {
          let buttonText = null;
          
          // First, look for span.oc-heading inside the button
          const $ocHeading = $button.find('span.oc-heading');
          if ($ocHeading.length) {
            buttonText = $ocHeading.text().trim();
            
            // Also check for span.oc-ingress (for multi-line buttons)
            const $ocIngress = $button.find('span.oc-ingress');
            if ($ocIngress.length) {
              const ingressText = $ocIngress.text().trim();
              if (ingressText) {
                // Combine heading and ingress text
                buttonText = `${buttonText} ${ingressText}`;
              }
            }
          } else {
            // If no span.oc-heading found, use button text directly
            buttonText = $button.text().trim();
          }
          
          if (buttonText) {
            // Generate semantic ID from button text (like Docusaurus does)
            const normalizedText = buttonText.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
            const generatedId = normalizedText
              .toLowerCase()
              .replace(/å/g, 'a')
              .replace(/æ/g, 'ae')
              .replace(/ø/g, 'o')
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .substring(0, 100);
            
            // Use the generated semantic ID
            id = generatedId;
          }
        }
      }
    }
    
    // If still no semantic ID, check if there's an anchor tag or button before the heading
    if (!id) {
      const $prevAnchor = $elem.prev('a[id], button[id]');
      if ($prevAnchor.length) {
        const prevId = $prevAnchor.attr('id');
        if (!prevId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
          id = prevId;
        } else if (!guidBasedId) {
          guidBasedId = prevId;
        }
      }
    }
    
    // If still no semantic ID, check if there's an anchor tag or button that wraps or is near the heading
    if (!id) {
      const $nearbyAnchor = $elem.siblings('a[id], button[id]').first();
      if ($nearbyAnchor.length) {
        const nearbyId = $nearbyAnchor.attr('id');
        if (!nearbyId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
          id = nearbyId;
        } else if (!guidBasedId) {
          guidBasedId = nearbyId;
        }
      }
    }
    
    // If still no semantic ID, try to find elements with semantic IDs that match this heading
    // First, check if an element with a semantic ID exists on the page
    if (!id) {
      // Normalize text for ID generation (remove newlines and extra spaces)
      const normalizedText = text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
      const generatedId = normalizedText
        .toLowerCase()
        .replace(/å/g, 'a')
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
      
      // First, check if an element with this semantic ID exists on the page
      const $targetElement = $(`#${generatedId}`);
      if ($targetElement.length > 0) {
        // Check if this element is the heading or associated with it
        // Normalize heading text for comparison
        const $targetHeading = $targetElement.is('h2, h3, h4') ? $targetElement : $targetElement.closest('h2, h3, h4').first();
        if ($targetHeading.length) {
          const targetHeadingText = $targetHeading.text().trim().replace(/\s+/g, ' ').replace(/\n/g, ' ');
          if (targetHeadingText === normalizedText) {
            id = generatedId;
          }
        } else {
          // Check if heading is nearby
          const $nearbyHeading = $targetElement.prev('h2, h3, h4').first();
          if ($nearbyHeading.length) {
            const nearbyHeadingText = $nearbyHeading.text().trim().replace(/\s+/g, ' ').replace(/\n/g, ' ');
            if (nearbyHeadingText === normalizedText) {
              id = generatedId;
            }
          }
        }
      }
      
      // If still no ID, check if any link on the page points to this semantic ID
      if (!id) {
        const $anchorLink = $(`a[href="#${generatedId}"]`);
        if ($anchorLink.length) {
          // Verify this link is associated with this heading
          const $linkHeading = $anchorLink.closest('h2, h3, h4').first();
          if (!$linkHeading.length) {
            const $nextHeading = $anchorLink.next('h2, h3, h4').first();
            if ($nextHeading.length && $nextHeading.text().trim() === text) {
              // Verify the ID actually exists on the page (element must exist, not just a link pointing to it)
              if ($(`#${generatedId}`).length > 0) {
                id = generatedId;
              }
            }
          } else if ($linkHeading.text().trim() === text) {
            // Verify the ID actually exists on the page (element must exist, not just a link pointing to it)
            if ($(`#${generatedId}`).length > 0) {
              id = generatedId;
            }
          }
        }
      }
    }
    
    // If still no semantic ID, check our mapping from anchor links (prioritize semantic IDs)
    // But only if the heading element itself doesn't have a semantic ID
    if (!id && headingToAnchorMap.has(text)) {
      const mappedId = headingToAnchorMap.get(text);
      // Only use if it's not a GUID-based ID
      if (!mappedId.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
        // Use semantic ID from mapping directly
        // Don't check if element exists since ID might be added dynamically with JavaScript
        id = mappedId;
      } else if (!guidBasedId) {
        guidBasedId = mappedId;
      }
    }
    
    // If still no ID, try to find any element with an ID that could match this heading
    if (!id) {
      // Generate a few variations of the ID
      const variations = [
        text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'),
        text.toLowerCase().replace(/å/g, 'a').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-'),
      ];
      
      for (const variant of variations) {
        const $target = $(`#${variant}`);
        if ($target.length) {
          // Check if this element is the heading or associated with it
          let $targetHeading = $target.closest('h2, h3, h4').first();
          if (!$targetHeading.length) {
            $targetHeading = $target.is('h2, h3, h4') ? $target : null;
          }
          if ($targetHeading && $targetHeading.length && $targetHeading.text().trim() === text) {
            id = variant;
            break;
          }
        }
      }
    }
    
    // Final fallback: generate ID from heading text (like Docusaurus does)
    // This handles cases where IDs are added dynamically with JavaScript
    // We generate the semantic ID based on the heading text and use it directly
    // since Docusaurus will add the ID dynamically when the page loads
    if (!id) {
      // Normalize text for ID generation (remove newlines and extra spaces)
      const normalizedText = text.replace(/\s+/g, ' ').replace(/\n/g, ' ').trim();
      const generatedId = normalizedText
        .toLowerCase()
        .replace(/å/g, 'a')
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'o')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 100);
      
      // Always use the generated semantic ID if it's not empty
      // Even if element or anchor link doesn't exist yet, Docusaurus will add it dynamically
      if (generatedId) {
        id = generatedId;
      }
    }
    
    // Only use GUID-based ID as last resort if no semantic ID was found
    if (!id && guidBasedId) {
      // Verify GUID-based ID exists on the page (element must exist, not just a link pointing to it)
      if ($(`#${guidBasedId}`).length > 0) {
        id = guidBasedId;
      }
    }
    
    const level = elem.tagName === 'h2' ? 1 : elem.tagName === 'h3' ? 2 : 3;
    
    // Include ID if:
    // 1. Element exists on the page, OR
    // 2. There's an anchor link pointing to it (even if element doesn't exist yet - it will be added dynamically)
    // 3. It's a generated semantic ID (not GUID-based) - assume it will be added dynamically
    let verifiedId = null;
    if (id) {
      const isGuidBased = id.match(/^ID-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
      if ($(`#${id}`).length > 0) {
        // Element exists, use it
        verifiedId = id;
      } else if (!isGuidBased) {
        // Semantic ID doesn't exist yet, but check if there's an anchor link pointing to it
        // This handles cases where ID is added dynamically with JavaScript
        const $anchorLink = $(`a[href="#${id}"]`);
        if ($anchorLink.length > 0) {
          // There's an anchor link pointing to this ID, use it even if element doesn't exist yet
          // The ID will be added dynamically with JavaScript when the page loads
          verifiedId = id;
        } else {
          // No anchor link found, but if it's a generated semantic ID, assume it will be added dynamically
          // Only use if it's not a GUID-based ID
          verifiedId = id;
        }
      }
    }
    
    headings.push({
      title: text,
      id: verifiedId, // Only include ID if it exists on the page
      level: level,
    });
  });
  
  return { title: h1, headings };
}

// Fetch a page and extract data
async function fetchPage(url) {
  try {
    console.log(`  Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SkatteetatenBot/1.0)',
      },
    });
    
    if (!response.ok) {
      console.warn(`  ⚠️  Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    const { title, headings } = extractHeadings(html, url);
    
    // Extract links to other stilogtone pages
    const $ = cheerio.load(html);
    const links = [];
    
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (!href) return;
      
      try {
        const absoluteUrl = new URL(href, url).href;
        if (absoluteUrl.startsWith(BASE_URL + '/stilogtone/')) {
          const normalized = normalizeUrl(absoluteUrl);
          if (normalized && !visited.has(normalized)) {
            links.push(normalized);
          }
        }
      } catch {
        // Invalid URL, skip
      }
    });
    
    return {
      url,
      title,
      headings,
      links,
    };
  } catch (error) {
    console.warn(`  ⚠️  Error fetching ${url}:`, error.message);
    return null;
  }
}

// Build hierarchy from URL structure
function buildHierarchy(url) {
  // Normalize URL first
  const normalized = normalizeUrl(url);
  if (!normalized || !normalized.includes('/stilogtone/')) {
    return { parent: 'Stil og tone', parentUrl: BASE_URL + '/stilogtone/' };
  }
  
  const parts = normalized.replace(BASE_URL + '/stilogtone', '').split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return { parent: 'Stil og tone', parentUrl: BASE_URL + '/stilogtone/' };
  }
  
  // Map URL parts to readable names
  const categoryMap = {
    'god-praksis': 'God praksis',
    'monster': 'Mønstre og maler',
    'designsystemet': 'Designsystemet',
    'språk': 'Språk',
    'skrive': 'Språk',
    'visuell-identitet': 'Visuell identitet',
    'visuelt': 'Visuell identitet',
    'komponenter': 'Komponenter',
    'interaksjon': 'Interaksjonsmønstre',
    'produkt': 'Produkt',
  };
  
  if (parts.length === 1) {
    const parent = categoryMap[parts[0]] || parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    return { parent, parentUrl: BASE_URL + '/stilogtone/' + parts[0] + '/' };
  }
  
  // For deeper pages, use the parent category
  const parentCategory = categoryMap[parts[0]] || parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const parentUrl = BASE_URL + '/stilogtone/' + parts.slice(0, -1).join('/') + '/';
  
  return { parent: parentCategory, parentUrl };
}

// Fetch Storybook components and other content
async function fetchStorybookComponents() {
  const items = [];
  
  // Komponenter
  const componentNames = [
    'Alert', 'Button', 'TextField', 'StepList', 'Card', 'Modal', 'Panel',
    'Checkbox', 'Select', 'TextArea', 'DatePicker', 'FileUploader',
    'ErrorMessage', 'ErrorSummary', 'Breadcrumbs', 'Pagination', 'Tabs',
    'Table', 'Accordion', 'Link', 'Icon', 'Spinner', 'Tag', 'Chips',
    'WordInfo',
  ];
  
  for (const name of componentNames) {
    const slug = name.toLowerCase();
    items.push({
      title: name,
      url: `${STORYBOOK_BASE}/?path=/docs/komponenter-${slug}--docs`,
      category: 'Storybook',
      parent: 'Komponenter',
      level: 0,
    });
  }
  
  // Generelt
  items.push({
    title: 'Introduksjon',
    url: `${STORYBOOK_BASE}/?path=/docs/generelt-introduksjon--docs`,
    category: 'Storybook',
    parent: 'Generelt',
    level: 0,
  });
  
  // Designtokens
  const designTokenNames = [
    'Breakpoints',
    'Containers',
    'Font',
    'Hjelpestiler (SCSS)',
    'Palette',
    'Sizes',
    'Spacing',
  ];
  
  for (const name of designTokenNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
    items.push({
      title: name,
      url: `${STORYBOOK_BASE}/?path=/docs/designtokens-${slug}--docs`,
      category: 'Storybook',
      parent: 'Designtokens',
      level: 0,
    });
  }
  
  // Sidetyper - Ekstern
  const eksternSidetyper = [
    'Kvittering',
    'Oppgaveliste (beta)',
    'Repeterende felter',
    'Skjema med steg',
  ];
  
  for (const name of eksternSidetyper) {
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
    items.push({
      title: name,
      url: `${STORYBOOK_BASE}/?path=/docs/sidetyper-ekstern-${slug}--docs`,
      category: 'Storybook',
      parent: 'Sidetyper • Ekstern',
      level: 0,
    });
  }
  
  // Sidetyper - Intern
  items.push({
    title: 'Saksvisning',
    url: `${STORYBOOK_BASE}/?path=/docs/sidetyper-intern-saksvisning--docs`,
    category: 'Storybook',
    parent: 'Sidetyper • Intern',
    level: 0,
  });
  
  // Verktøy
  const verktoyNames = [
    'Formatters',
    'Kommandolinjeverktøy',
  ];
  
  for (const name of verktoyNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    items.push({
      title: name,
      url: `${STORYBOOK_BASE}/?path=/docs/verktoy-${slug}--docs`,
      category: 'Storybook',
      parent: 'Verktøy',
      level: 0,
    });
  }
  
  return items;
}

const buildSearchIndex = async () => {
  // Check if index already exists and is recent (less than 7 days old)
  const staticDir = path.join(__dirname, '..', 'static');
  const indexPath = path.join(staticDir, 'search-index.json');
  
  if (fs.existsSync(indexPath)) {
    const stats = fs.statSync(indexPath);
    const ageInDays = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);
    
    if (ageInDays < 7) {
      console.log('✅ Search index exists and is recent (less than 7 days old)');
      console.log(`   Skipping rebuild. File: ${indexPath}`);
      console.log(`   Last updated: ${stats.mtime.toLocaleString('no-NO')}`);
      return;
    } else {
      console.log(`ℹ️  Search index is ${ageInDays.toFixed(1)} days old, rebuilding...`);
    }
  }
  
  console.log('🔍 Building search index from stilogtone.no...');
  console.log(`   Starting from: ${START_URL}`);
  
  // Crawl all pages
  while (toVisit.length > 0) {
    const url = toVisit.shift();
    const normalized = normalizeUrl(url);
    
    if (!normalized || visited.has(normalized)) {
      continue;
    }
    
    visited.add(normalized);
    
    const pageData = await fetchPage(normalized);
    if (!pageData) continue;
    
    // Add links to visit queue
    pageData.links.forEach(link => {
      if (!visited.has(link) && !toVisit.includes(link)) {
        toVisit.push(link);
      }
    });
    
    // Build hierarchy
    const hierarchy = buildHierarchy(normalized);
    
    // Mark if this is a landing page (should be excluded from search)
    const isLandingPage = LANDING_PAGES.has(normalized + '/') || LANDING_PAGES.has(normalized);
    
    pages.push({
      url: normalized,
      title: pageData.title || normalized.split('/').pop() || 'Untitled',
      category: 'Stil og tone',
      parent: hierarchy.parent,
      parentUrl: hierarchy.parentUrl,
      level: 0,
      headings: pageData.headings,
      isLandingPage: isLandingPage,
    });
    
    // Small delay to be respectful
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Crawled ${pages.length} pages from stilogtone.no`);
  
  // Fetch Storybook components
  console.log('\n📚 Fetching Storybook components...');
  const storybookComponents = await fetchStorybookComponents();
  console.log(`   Found ${storybookComponents.length} components`);
  
  // Flatten the index to include both pages and headings
  const flattenedIndex = [];
  
  // Add stilogtone pages (exclude landing pages)
  pages.forEach(page => {
    // Skip landing pages - they should not appear in search results
    if (page.isLandingPage) {
      return;
    }
    
    // Add the main page
    flattenedIndex.push({
      title: page.title,
      url: page.url,
      category: page.category,
      parent: page.parent,
      parentUrl: page.parentUrl,
      level: page.level || 0,
    });

    // Add headings as separate entries
    page.headings?.forEach(heading => {
      // Build full breadcrumb path: category > page title
      const breadcrumb = page.parent ? `${page.parent} • ${page.title}` : page.title;
      
      // Only include hash fragment if ID exists on the page
      const url = heading.id ? `${page.url}#${heading.id}` : page.url;
      
      flattenedIndex.push({
        title: heading.title,
        url: url,
        category: page.category,
        parent: breadcrumb, // Full breadcrumb path instead of just page title
        parentUrl: page.url,
        heading: heading.title,
        level: heading.level || 1,
      });
    });
  });
  
  // Add Storybook components
  storybookComponents.forEach(component => {
    flattenedIndex.push(component);
  });
  
  // Write to static directory
  if (!fs.existsSync(staticDir)) {
    fs.mkdirSync(staticDir, { recursive: true });
  }

  fs.writeFileSync(indexPath, JSON.stringify(flattenedIndex, null, 2), 'utf-8');

  console.log(`\n✅ Search index built: ${flattenedIndex.length} entries`);
  console.log(`   Saved to: ${indexPath}`);
};

buildSearchIndex().catch(console.error);
