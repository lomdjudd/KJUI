// Matériaux partagés (PBR) des pièces de fusée.

import * as THREE from 'three';
import * as TX from './textures.js';

let M = null;

// Peintures disponibles dans l'atelier (clé -> libellé)
export const PAINTS = [
  { id: null, name: 'Origine', color: '#888' },
  { id: 'white', name: 'Blanc', color: '#f1f1ec' },
  { id: 'black', name: 'Noir', color: '#1c1e21' },
  { id: 'steel', name: 'Inox', color: '#c9cdd1' },
  { id: 'foam', name: 'Mousse', color: '#cd6a2d' },
  { id: 'carbon', name: 'Carbone', color: '#2a2c30' },
  { id: 'gold', name: 'Or', color: '#d7a748' },
  { id: 'navy', name: 'Bleu nuit', color: '#1f3a78' },
  { id: 'red', name: 'Rouge', color: '#c8322b' },
  { id: 'orange', name: 'Orange', color: '#f07a22' },
  { id: 'grey', name: 'Gris', color: '#8d9298' },
  { id: 'teal', name: 'Sarcelle', color: '#1f8a8a' },
];

export function materials() {
  if (M) return M;
  const panel = TX.panelTextures();
  const foam = TX.foamTextures();
  const steel = TX.steelTextures();
  const foil = TX.foilTextures();
  const carbon = TX.carbonTextures();
  const regen = TX.regenTextures();
  const honey = TX.honeycombTextures();
  const solar = TX.solarTextures();
  const hex = TX.hexTileTextures();

  const paint = (color, extra = {}) =>
    new THREE.MeshPhysicalMaterial({
      color, roughness: 0.46, metalness: 0.0, clearcoat: 0.18, clearcoatRoughness: 0.4, envMapIntensity: 0.7,
      normalMap: panel.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughnessMap: panel.rough, ...extra,
    });

  M = {
    white: paint('#f0f0ea'),
    black: paint('#1a1c1f', { roughness: 0.5, clearcoat: 0.2 }),
    navy: paint('#1f3a78'),
    red: paint('#c02c26'),
    orange: paint('#ee7420'),
    grey: paint('#8d9298', { roughness: 0.5 }),
    teal: paint('#1f8a8a'),
    foam: new THREE.MeshStandardMaterial({ color: '#ffffff', map: foam.map, normalMap: foam.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.88, metalness: 0 }),
    steel: new THREE.MeshStandardMaterial({ color: '#d2d6da', metalness: 1, roughness: 0.28, normalMap: steel.normal, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: steel.rough }),
    hexTiles: new THREE.MeshStandardMaterial({ color: '#ffffff', map: hex.map, normalMap: hex.normal, roughness: 0.75, metalness: 0.05 }),
    carbon: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: carbon.map, normalMap: carbon.normal, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.35, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.12 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 1, roughness: 0.3, normalMap: foil.normal, normalScale: new THREE.Vector2(1, 1), roughnessMap: foil.rough }),
    silverFoil: new THREE.MeshStandardMaterial({ color: '#d4d8dc', metalness: 1, roughness: 0.28, normalMap: foil.normal, normalScale: new THREE.Vector2(1, 1), roughnessMap: foil.rough }),
    darkMetal: new THREE.MeshStandardMaterial({ color: '#3c4046', metalness: 0.85, roughness: 0.42 }),
    metal: new THREE.MeshStandardMaterial({ color: '#9aa0a8', metalness: 0.9, roughness: 0.32 }),
    brightMetal: new THREE.MeshStandardMaterial({ color: '#d8dce2', metalness: 1, roughness: 0.18 }),
    titanium: new THREE.MeshStandardMaterial({ color: '#8b8f96', metalness: 0.95, roughness: 0.38 }),
    copper: new THREE.MeshStandardMaterial({ color: '#b8703c', metalness: 1, roughness: 0.3, normalMap: regen.normal, normalScale: new THREE.Vector2(0.6, 0.6) }),
    bronze: new THREE.MeshStandardMaterial({ color: '#6b4d36', metalness: 0.9, roughness: 0.38, normalMap: regen.normal, normalScale: new THREE.Vector2(0.8, 0.8) }),
    nozzle: new THREE.MeshStandardMaterial({ color: '#2f3237', metalness: 0.9, roughness: 0.34, emissive: new THREE.Color('#ff5a1a'), emissiveIntensity: 0 }),
    nozzleInner: new THREE.MeshStandardMaterial({ color: '#3a2a22', metalness: 0.8, roughness: 0.5, side: THREE.BackSide, emissive: new THREE.Color('#ff7a2a'), emissiveIntensity: 0 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#141516', metalness: 0.1, roughness: 0.8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#0a0e16', metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, emissive: new THREE.Color('#ffc98a'), emissiveIntensity: 0.12 }),
    shield: new THREE.MeshStandardMaterial({ color: '#ffffff', map: honey.map, normalMap: honey.normal, roughness: 0.92, metalness: 0, emissive: new THREE.Color('#ff6a20'), emissiveIntensity: 0 }),
    solar: new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: solar.map, metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, side: THREE.DoubleSide }),
    solarBack: new THREE.MeshStandardMaterial({ color: '#d8d2c0', metalness: 0.3, roughness: 0.6 }),
    canopy: new THREE.MeshStandardMaterial({ map: TX.canopyTexture(), roughness: 0.85, side: THREE.DoubleSide }),
    line: new THREE.LineBasicMaterial({ color: '#d8d4cc', transparent: true, opacity: 0.8 }),
    hazard: new THREE.MeshStandardMaterial({ map: TX.hazardTexture(), roughness: 0.6 }),
    emissiveBlue: new THREE.MeshStandardMaterial({ color: '#0a1830', emissive: new THREE.Color('#3aa6ff'), emissiveIntensity: 2.2 }),
    emissiveGreen: new THREE.MeshStandardMaterial({ color: '#0a2010', emissive: new THREE.Color('#48ff8a'), emissiveIntensity: 2.4 }),
    emissiveRed: new THREE.MeshStandardMaterial({ color: '#300a0a', emissive: new THREE.Color('#ff3040'), emissiveIntensity: 2.4 }),
    emissivePink: new THREE.MeshStandardMaterial({ color: '#301028', emissive: new THREE.Color('#ff5ad8'), emissiveIntensity: 2.4 }),
    lamp: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#fff2d0'), emissiveIntensity: 0 }),
    goo: new THREE.MeshPhysicalMaterial({ color: '#5cff6a', emissive: new THREE.Color('#1c8a28'), emissiveIntensity: 0.6, roughness: 0.1, transmission: 0 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#f4f2ec', roughness: 0.6, metalness: 0.05 }),
    aerogel: new THREE.MeshStandardMaterial({ color: '#dfe8f2', roughness: 0.95, metalness: 0, normalMap: foam.normal, normalScale: new THREE.Vector2(0.4, 0.4) }),
    tantalum: new THREE.MeshStandardMaterial({ color: '#4b4f5a', metalness: 1, roughness: 0.25 }),
    ablative: new THREE.MeshStandardMaterial({ color: '#2b211b', roughness: 0.95, metalness: 0 }),
    decalMat: new Map(),
  };
  M.paint = { white: M.white, black: M.black, steel: M.steel, foam: M.foam, carbon: M.carbon, gold: M.gold, navy: M.navy, red: M.red, orange: M.orange, grey: M.grey, teal: M.teal };
  return M;
}

export function decalMaterial(texture) {
  const m = materials();
  if (!m.decalMat.has(texture)) {
    m.decalMat.set(texture, new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.5, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false }));
  }
  return m.decalMat.get(texture);
}
