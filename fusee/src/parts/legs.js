// Géométrie des jambes d'atterrissage (partagée par la physique et les modèles).
//  - repliable : pivot en bas, jambe vers le haut au repos, rotation jusqu'à 2,25 rad
//  - alunisseur : pivot en haut, jambe vers le bas, pied en (span, -h/2 - drop)

export function legGeometry(def) {
  const h = def.h;
  if (def.legs.fold) {
    return { pivot: [0.12, -h / 2 + 0.1], L: h * 0.95, stowed: 0, deployed: 2.25 };
  }
  const px = 0.05, py = h / 2 - 0.1;
  const dx = def.legs.span - px, dy = py + h / 2 + def.legs.drop;
  return { pivot: [px, py], L: Math.hypot(dx, dy), stowed: 2.6, deployed: Math.atan2(dx, dy) };
}

// Position du pied (repère de la pièce, +X vers l'extérieur)
export function legFoot(def, deployT) {
  const g = legGeometry(def);
  const a = g.stowed + (g.deployed - g.stowed) * deployT;
  if (def.legs.fold) return [g.pivot[0] + Math.sin(a) * g.L, g.pivot[1] + Math.cos(a) * g.L];
  return [g.pivot[0] + Math.sin(a) * g.L, g.pivot[1] - Math.cos(a) * g.L];
}
