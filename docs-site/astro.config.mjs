import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

const site = process.env.DOCS_SITE_URL ?? 'http://localhost:4321';
const base = process.env.DOCS_BASE_PATH ?? '/';

export default defineConfig({
  site,
  base,
  integrations: [
    starlight({
      title: 'Daily Portal Docs',
      description: 'Documentacion tecnica y operativa del portal personal Daily Portal.',
      customCss: ['./src/styles/starlight.css'],
      sidebar: [
        {
          label: 'Inicio',
          items: [
            { label: 'Resumen', slug: 'index' },
            { label: 'Arquitectura', slug: 'architecture/overview' },
            { label: 'ADRs', slug: 'decisions/adr' },
          ],
        },
        {
          label: 'Modulos',
          autogenerate: { directory: 'modules' },
        },
        {
          label: 'Referencias',
          items: [
            { label: 'Frontend Compodoc', link: '/reference/frontend/' },
            { label: 'Backend TypeDoc', link: '/reference/backend/' },
            { label: 'API Reference', slug: 'api-reference' },
            { label: 'API Playground', slug: 'api-playground' },
          ],
        },
        {
          label: 'Setup',
          items: [
            { label: 'Espanol', slug: 'setup/es' },
            { label: 'English', slug: 'setup/en' },
          ],
        },
        {
          label: 'Operacion',
          items: [
            { label: 'Espanol', slug: 'deploy/es' },
            { label: 'English', slug: 'deploy/en' },
          ],
        },
      ],
    }),
  ],
});
