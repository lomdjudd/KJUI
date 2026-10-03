import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Bras mécanique 3D (dossier robot-arm/) : build en un seul fichier HTML
// autonome -> dist-bras/index.html (fonctionne hors-ligne, par double-clic).
export default defineConfig({
  root: 'robot-arm',
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: '../dist-bras',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
});
