import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // relative asset paths so the build loads over file://
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
