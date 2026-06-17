// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  devToolbar: {
    enabled: false,
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
        '/socket.io': {
          target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:3000',
          ws: true,
        },
      },
    },
  }
});
