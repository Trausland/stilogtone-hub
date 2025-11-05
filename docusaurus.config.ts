import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title: 'Søk stil og tone',
  tagline: 'Finn alt om komponenter, mønstre, stil og utvikling',
  favicon: 'img/skatteetatenlogo/fav-icon/64x64/png/favicon64x64.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
   url: 'https://trausland.github.io',
  baseUrl: '/designsystem-hub/',


  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'trausland', // Usually your GitHub org/user name.
  projectName: 'designsystem-hub', // Usually your repo name.

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
  ],
  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
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
};

export default config;
