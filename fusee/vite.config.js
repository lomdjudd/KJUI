import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Le build produit un unique fichier dist/index.html jouable hors-ligne
// (double-clic), avec Three.js, les textures et tout le code intégrés.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 100000000,
  },
  worker: {
    format: 'es',
  },
});
