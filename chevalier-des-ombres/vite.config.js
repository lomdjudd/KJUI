import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Le build produit un unique fichier dist/index.html jouable hors ligne (et embarqué dans l'APK).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  // Modèles 3D embarqués dans le paquet de données (décodés à l'installation)
  assetsInclude: ['**/*.glb'],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: 100000000,
  },
});
