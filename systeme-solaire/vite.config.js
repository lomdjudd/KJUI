import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Application "Mon Système Solaire" : build classique (textures et modèles 3D
// servis à côté de la page), à ouvrir via un serveur web.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
