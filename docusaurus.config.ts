import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import dotenv from 'dotenv';

// Last inn miljøvariabler fra .env-fil
dotenv.config();

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// Beregn baseUrl og full URL for bilder
const baseUrl = process.env.NODE_ENV === 'production' ? '/stilogtone-hub/' : '/';
const siteUrl = 'https://trausland.github.io';
const fullImageUrl = `${siteUrl}${baseUrl}img/skatteetatenlogo.png`;

const config: Config = {
  title: 'Søk stil og tone',
  tagline: 'Finn alt om komponenter, mønstre, stil og utvikling',
  favicon: 'img/skatteetatenlogo/fav-icon/64x64/png/favicon64x64.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: siteUrl,
  // Bruk '/' i utvikling, '/stilogtone-hub/' i produksjon
  baseUrl: baseUrl,


  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'trausland', // Usually your GitHub org/user name.
  projectName: 'stilogtone-hub', // Usually your repo name.

  onBrokenLinks: 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/',
          // Useful options to enforce blogging best practices
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  headTags: [
    // Production path (with baseUrl)
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        href: '/designsystem-hub/img/skatteetatenlogo/fav-icon/64x64/png/favicon64x64.png',
        type: 'image/png',
      },
    },
    // Development path (without baseUrl)
    {
      tagName: 'link',
      attributes: {
        rel: 'icon',
        href: '/img/skatteetatenlogo/fav-icon/64x64/png/favicon64x64.png',
        type: 'image/png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'shortcut icon',
        href: '/designsystem-hub/img/skatteetatenlogo/fav-icon/64x64/png/favicon64x64.png',
        type: 'image/png',
      },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'apple-touch-icon',
        href: '/designsystem-hub/img/skatteetatenlogo/fav-icon/64x64/png/favicon64x64.png',
      },
    },
    // Open Graph meta-tags for sosiale medier
    {
      tagName: 'meta',
      attributes: {
        property: 'og:image',
        content: fullImageUrl,
      },
    },
    {
      tagName: 'meta',
      attributes: {
        property: 'og:image:alt',
        content: 'Skatteetaten logo',
      },
    },
    // Twitter Card meta-tags
    {
      tagName: 'meta',
      attributes: {
        name: 'twitter:image',
        content: fullImageUrl,
      },
    },
    {
      tagName: 'meta',
      attributes: {
        name: 'twitter:image:alt',
        content: 'Skatteetaten logo',
      },
    },
    // Inline Firebase-konfigurasjon i HTML-en for klientside-tilgang
    {
      tagName: 'script',
      attributes: {
        type: 'application/json',
        id: 'firebase-config',
      },
      innerHTML: JSON.stringify({
        apiKey: process.env.FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
        projectId: process.env.FIREBASE_PROJECT_ID || '',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
        appId: process.env.FIREBASE_APP_ID || '',
      }),
    },
  ],
  themeConfig: {
    // Replace with your project's social card
    image: 'img/skatteetatenlogo.png',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      hideOnScroll: true,
      items: [
        {to: '/', label: 'Søk stil og tone', position: 'right'},
        {
          href: 'https://skatteetaten.github.io/uu-status/uu-status.html',
          label: 'UU-status Skatteetaten',
          position: 'right',
          target: '_blank',
        },
        {
          href: 'https://github.com/Skatteetaten/designsystemet/',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'light',
      links: [],
      copyright: `Copyright © ${new Date().getFullYear()} Skatteetaten.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
  customFields: {
    // Firebase-konfigurasjon fra miljøvariabler
    // Disse verdiene er tilgjengelige på klientsiden via useDocusaurusContext()
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
    },
  },
};

export default config;
