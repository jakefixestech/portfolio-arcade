import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  vite: {
    plugins: [tailwindcss()],
  },

  adapter: cloudflare(),
});