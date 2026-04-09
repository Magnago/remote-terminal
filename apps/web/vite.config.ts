import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    host: true, // expose on LAN so phone can reach dev server directly
  },
});
