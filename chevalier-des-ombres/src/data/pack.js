// Paquet de données embarqué : modèles 3D (GLB). Il est décodé et préparé une seule fois,
// lors de l'installation des données, puis conservé dans le stockage de l'appareil.
import knightGlb from '../../assets/models/knight.glb?inline';

export const PACK = {
  models: {
    knight: { data: knightGlb, label: 'Chevalier cornu', height: 1.92 },
  },
};

// Taille approximative du paquet (octets)
export function packSize() {
  let n = 0;
  for (const m of Object.values(PACK.models)) n += Math.round((m.data.length - m.data.indexOf(',')) * 0.75);
  return n;
}

// URL de données base64 → ArrayBuffer
export function decodeDataUrl(u) {
  const bin = atob(u.slice(u.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
