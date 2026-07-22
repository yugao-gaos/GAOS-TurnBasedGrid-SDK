import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'GAOS Turn-Based Grid Toolkit',
  description: 'Games as benchmarks for human and AI agents.',
  base: '/GAOS-TurnBasedGrid-SDK/',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#6657d9' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'GAOS Turn-Based Grid Toolkit' }],
    ['meta', {
      property: 'og:url',
      content: 'https://yugao-gaos.github.io/GAOS-TurnBasedGrid-SDK/',
    }],
    ['meta', {
      property: 'og:description',
      content: 'Games as benchmarks for human and AI agents.',
    }],
    ['meta', {
      property: 'og:image',
      content: 'https://yugao-gaos.github.io/GAOS-TurnBasedGrid-SDK/gaos-grid-sdk-social.png',
    }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', {
      property: 'og:image:alt',
      content: 'GAOS Turn-Based Grid Toolkit — Games as benchmarks for human and AI agents.',
    }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'GAOS Turn-Based Grid Toolkit' }],
    ['meta', {
      name: 'twitter:description',
      content: 'Games as benchmarks for human and AI agents.',
    }],
    ['meta', {
      name: 'twitter:image',
      content: 'https://yugao-gaos.github.io/GAOS-TurnBasedGrid-SDK/gaos-grid-sdk-social.png',
    }],
    ['meta', {
      name: 'twitter:image:alt',
      content: 'GAOS Turn-Based Grid Toolkit — Games as benchmarks for human and AI agents.',
    }],
  ],
  themeConfig: {
    siteTitle: 'GAOS Turn-Based Grid Toolkit',
    nav: [
      { text: 'Mission', link: '/mission' },
      { text: 'Guide', link: '/quickstart' },
      { text: 'Mechanisms', link: '/mechanisms/' },
      { text: 'Agentic play', link: '/agentic-play' },
      { text: 'Protocol', link: '/protocol-v1' },
      { text: 'Python', link: '/python' },
      { text: 'v0.9.1', link: '/releases' },
    ],
    sidebar: [
      {
        text: 'Start here',
        items: [
          { text: 'Mission and benchmark thesis', link: '/mission' },
          { text: 'Quickstart', link: '/quickstart' },
          { text: 'Architecture map', link: '/architecture' },
        ],
      },
      {
        text: 'Engine',
        items: [
          { text: 'Engine boundary', link: '/engine' },
          { text: 'Mechanism overview', link: '/mechanisms/' },
          { text: 'Grid model', link: '/mechanisms/grid-model' },
          { text: 'Simultaneous movement', link: '/mechanisms/movement' },
          { text: 'Geometry and FOV', link: '/mechanisms/geometry' },
          { text: 'Turn settlement', link: '/settlement' },
        ],
      },
      {
        text: 'Interaction mechanisms',
        collapsed: true,
        items: [
          { text: 'Chain reactions', link: '/mechanisms/chain-reactions' },
          { text: 'Projectiles and flight', link: '/mechanisms/projectiles' },
          { text: 'Push chains', link: '/mechanisms/push-chains' },
          { text: 'Arrival rules', link: '/mechanisms/arrivals' },
          { text: 'Resource claims', link: '/mechanisms/resource-claims' },
          { text: 'Resource transactions', link: '/mechanisms/resources' },
          { text: 'Gates', link: '/mechanisms/gates' },
          { text: 'Latched triggers', link: '/mechanisms/triggers' },
          { text: 'Grid rays', link: '/mechanisms/rays' },
          { text: 'Behavior trees', link: '/mechanisms/behavior-trees' },
        ],
      },
      {
        text: 'Systems and verification',
        collapsed: true,
        items: [
          { text: 'Transport and interlocks', link: '/mechanisms/transport' },
          { text: 'Deterministic randomness', link: '/mechanisms/randomness' },
          { text: 'Scoring and AI action limits', link: '/mechanisms/scoring' },
          { text: 'Solver', link: '/mechanisms/solver' },
          { text: 'Replay verification', link: '/mechanisms/replay' },
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
          { text: 'Built with GPT-5.6 Sol', link: '/building-with-gpt-5-6-sol' },
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
      message: 'Reusable mechanics in the toolkit. Product content stays in the product.',
      copyright: 'GAOS Turn-Based Grid Toolkit',
    },
  },
});
