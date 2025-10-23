import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/stilogtone-hub/blog',
    component: ComponentCreator('/stilogtone-hub/blog', 'b6c'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/archive',
    component: ComponentCreator('/stilogtone-hub/blog/archive', '1c7'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/authors',
    component: ComponentCreator('/stilogtone-hub/blog/authors', '393'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/authors/all-sebastien-lorber-articles',
    component: ComponentCreator('/stilogtone-hub/blog/authors/all-sebastien-lorber-articles', '5f1'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/authors/yangshun',
    component: ComponentCreator('/stilogtone-hub/blog/authors/yangshun', 'f53'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/first-blog-post',
    component: ComponentCreator('/stilogtone-hub/blog/first-blog-post', '572'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/long-blog-post',
    component: ComponentCreator('/stilogtone-hub/blog/long-blog-post', 'be0'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/mdx-blog-post',
    component: ComponentCreator('/stilogtone-hub/blog/mdx-blog-post', '4d8'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/tags',
    component: ComponentCreator('/stilogtone-hub/blog/tags', 'faa'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/tags/docusaurus',
    component: ComponentCreator('/stilogtone-hub/blog/tags/docusaurus', '948'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/tags/facebook',
    component: ComponentCreator('/stilogtone-hub/blog/tags/facebook', '617'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/tags/hello',
    component: ComponentCreator('/stilogtone-hub/blog/tags/hello', 'df9'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/tags/hola',
    component: ComponentCreator('/stilogtone-hub/blog/tags/hola', '889'),
    exact: true
  },
  {
    path: '/stilogtone-hub/blog/welcome',
    component: ComponentCreator('/stilogtone-hub/blog/welcome', 'c6e'),
    exact: true
  },
  {
    path: '/stilogtone-hub/markdown-page',
    component: ComponentCreator('/stilogtone-hub/markdown-page', '36d'),
    exact: true
  },
  {
    path: '/stilogtone-hub/docs',
    component: ComponentCreator('/stilogtone-hub/docs', '9da'),
    routes: [
      {
        path: '/stilogtone-hub/docs',
        component: ComponentCreator('/stilogtone-hub/docs', '498'),
        routes: [
          {
            path: '/stilogtone-hub/docs',
            component: ComponentCreator('/stilogtone-hub/docs', 'd8e'),
            routes: [
              {
                path: '/stilogtone-hub/docs/category/tutorial---basics',
                component: ComponentCreator('/stilogtone-hub/docs/category/tutorial---basics', '767'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/category/tutorial---extras',
                component: ComponentCreator('/stilogtone-hub/docs/category/tutorial---extras', '509'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/intro',
                component: ComponentCreator('/stilogtone-hub/docs/intro', '202'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/monster/header-topbanner',
                component: ComponentCreator('/stilogtone-hub/docs/monster/header-topbanner', 'c5e'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/teknisk/browserstotte',
                component: ComponentCreator('/stilogtone-hub/docs/teknisk/browserstotte', '362'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-basics/congratulations',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-basics/congratulations', 'e38'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-basics/create-a-blog-post',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-basics/create-a-blog-post', '6ab'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-basics/create-a-document',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-basics/create-a-document', 'be1'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-basics/create-a-page',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-basics/create-a-page', '3bb'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-basics/deploy-your-site',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-basics/deploy-your-site', 'c43'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-basics/markdown-features',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-basics/markdown-features', 'e0c'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-extras/manage-docs-versions',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-extras/manage-docs-versions', '422'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/stilogtone-hub/docs/tutorial-extras/translate-your-site',
                component: ComponentCreator('/stilogtone-hub/docs/tutorial-extras/translate-your-site', 'b72'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/stilogtone-hub/',
    component: ComponentCreator('/stilogtone-hub/', '674'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
