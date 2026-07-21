import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'GAOS Grid SDK',
  description: 'Deterministic turn-based grid mechanics and agentic-play infrastructure.',
  base: '/GAOS-TurnBasedGrid-SDK/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#6657d9' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'GAOS Turn-Based Grid SDK' }],
    ['meta', {
      property: 'og:description',
      content: 'Reusable deterministic grid mechanics, turn protocols, and agent-ready environments.',
    }],
  ],
  themeConfig: {
    siteTitle: 'GAOS Grid SDK',
    nav: [
      { text: 'Guide', link: '/quickstart' },
      { text: 'Mechanisms', link: '/engine' },
      { text: 'Agentic play', link: '/agentic-play' },
      { text: 'Protocol', link: '/protocol-v1' },
      { text: 'Python', link: '/python' },
      { text: 'v0.9.0', link: '/releases' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Quickstart', link: '/quickstart' },
          { text: 'Architecture map', link: '/architecture' },
        ],
      },
      {
        text: 'Engine',
        items: [
          { text: 'Reusable mechanisms', link: '/engine' },
          { text: 'Turn settlement', link: '/settlement' },
        ],
      },
      {
        text: 'Agents and integration',
        items: [
          { text: 'Agentic play', link: '/agentic-play' },
          { text: 'Turn protocol v1', link: '/protocol-v1' },
          { text: 'Python client', link: '/python' },
        ],
      },
      {
        text: 'Project',
        items: [
          { text: 'Support and compatibility', link: '/support' },
          { text: 'Releasing', link: '/releases' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK' },
    ],
    search: { provider: 'local' },
    editLink: {
      pattern: 'https://github.com/yugao-gaos/GAOS-TurnBasedGrid-SDK/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    outline: { level: [2, 3], label: 'On this page' },
    footer: {
      message: 'Reusable mechanics in the SDK. Product content stays in the product.',
      copyright: 'GAOS Turn-Based Grid SDK',
    },
  },
});
