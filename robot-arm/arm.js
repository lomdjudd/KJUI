import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------------------------------------------------------------------------
// Bras robotisé 6 axes « BRAS-6A » — modélisation 3D détaillée.
//
// Chaîne cinématique (Y vers le haut, X vers l'avant du robot au repos) :
//   J1 lacet (axe Y)  carrousel
//   J2 tangage (Z)    épaule
//   J3 tangage (Z)    coude
//   J4 roulis (Y)     avant-bras
//   J5 tangage (Z)    poignet
//   J6 roulis (Y)     bride d'outil + pince parallèle
//
// Chaque pièce est un groupe « recentré » sur son centre géométrique : il suffit
// donc de lui ajouter un vecteur de décalage pour obtenir la vue éclatée.
// ---------------------------------------------------------------------------

export const DIM = {
  BASE_H: 0.28, // hauteur de l'axe J1
  J2_Y: 0.42, // axe J2 au-dessus de J1
  L1: 0.75, // bras inférieur (J2 -> J3)
  J4_Y: 0.34, // début du roulis d'avant-bras
  L2: 0.65, // avant-bras (J3 -> J5)
  J6_Y: 0.1, // J5 -> bride
  TCP_Y: 0.22, // bride -> milieu des tampons de la pince
};
DIM.J2H = DIM.BASE_H + DIM.J2_Y; // hauteur absolue de l'axe J2
DIM.TOOL = DIM.J6_Y + DIM.TCP_Y; // J5 -> TCP

// Débattements articulaires (degrés)
export const LIMITS = [
  [-170, 170],
  [-25, 105],
  [-35, 150],
  [-180, 180],
  [-125, 125],
  [-360, 360],
];

export const JOINT_NAMES = [
  'J1 · Carrousel',
  'J2 · Épaule',
  'J3 · Coude',
  'J4 · Avant-bras',
  'J5 · Poignet',
  'J6 · Bride',
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Cinématique inverse analytique, outil pointé vers le bas.
// target : position du TCP dans le repère de la base. Retourne q (radians).
export function solveIK(target, yaw = 0) {
  const { L1, L2, J2H, TOOL } = DIM;
  const q1 = Math.atan2(-target.z, target.x);
  let r = Math.hypot(target.x, target.z);
  let wy = target.y + TOOL - J2H; // centre du poignet par rapport à J2
  let d = Math.hypot(r, wy);
  const dmax = L1 + L2 - 0.004;
  const dmin = Math.abs(L1 - L2) + 0.03;
  const dc = clamp(d, dmin, dmax);
  if (d > 1e-6 && dc !== d) {
    r *= dc / d;
    wy *= dc / d;
    d = dc;
  }
  const cg = (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2);
  const q3 = Math.PI - Math.acos(clamp(cg, -1, 1));
  const phi = Math.atan2(r, wy);
  const q2 = phi - Math.atan2(L2 * Math.sin(q3), L1 + L2 * Math.cos(q3));
  const q5 = Math.PI - q2 - q3;
  return [q1, q2, q3, 0, q5, yaw];
}

export function clampJoints(q) {
  return q.map((v, i) => {
    const [lo, hi] = LIMITS[i];
    return clamp(v, (lo * Math.PI) / 180, (hi * Math.PI) / 180);
  });
}

export function buildArm(M) {
  const root = new THREE.Group();
  root.name = 'Bras-6A';
  const parts = [];
  const movers = []; // pièces + repères articulaires qui reçoivent un décalage d'éclatement
  const ledMeshes = [];

  // -------------------------------------------------------------- géométries
  const mk = (geo, mat, pos, rot) => {
    const m = new THREE.Mesh(geo, mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const cylY = (r, h, mat, pos, seg = 48) => mk(new THREE.CylinderGeometry(r, r, h, seg), mat, pos);
  const cylZ = (r, h, mat, pos, seg = 48) =>
    mk(new THREE.CylinderGeometry(r, r, h, seg), mat, pos, [Math.PI / 2, 0, 0]);
  const cylX = (r, h, mat, pos, seg = 48) =>
    mk(new THREE.CylinderGeometry(r, r, h, seg), mat, pos, [0, 0, Math.PI / 2]);
  const rbox = (w, h, d, rad, mat, pos) => mk(new RoundedBoxGeometry(w, h, d, 4, rad), mat, pos);
  const lathe = (pts, mat, pos, seg = 72) =>
    mk(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat, pos);
  const sphere = (r, mat, pos) => mk(new THREE.SphereGeometry(r, 24, 16), mat, pos);

  // vis hexagonales disposées en couronne autour de l'axe Y
  const boltRing = (n, R, r, h, mat, y) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      out.push(mk(new THREE.CylinderGeometry(r, r, h, 6), mat, [Math.cos(a) * R, y, Math.sin(a) * R]));
    }
    return out;
  };
  // idem autour de l'axe Z (en groupe pivoté)
  const boltRingZ = (n, R, r, h, mat, z, cx = 0, cy = 0) => {
    const g = new THREE.Group();
    boltRing(n, R, r, h, mat, 0).forEach((b) => g.add(b));
    g.rotation.x = Math.PI / 2;
    g.position.set(cx, cy, z);
    return g;
  };

  // moteur brushless (axe Y, centré à l'origine) : cloche avant, bobinage, ailettes, codeur
  const motor = (r, h) => {
    const g = new THREE.Group();
    g.add(cylY(r * 1.03, h * 0.14, M.steel, [0, h * 0.43, 0]));
    g.add(cylY(r * 0.97, h * 0.06, M.copper, [0, h * 0.33, 0]));
    g.add(cylY(r, h * 0.6, M.graphite, [0, 0, 0]));
    for (let i = 0; i < 7; i++) g.add(cylY(r * 1.07, h * 0.022, M.graphite, [0, -h * 0.26 + i * h * 0.087, 0]));
    g.add(cylY(r * 0.98, h * 0.14, M.darkSteel, [0, -h * 0.37, 0]));
    g.add(cylY(r * 0.55, h * 0.08, M.graphite, [0, -h * 0.5, 0]));
    g.add(cylY(r * 0.22, h * 0.34, M.steel, [0, h * 0.67, 0], 24));
    return g;
  };

  // -------------------------------------------------------------- pièces
  const tmpBox = new THREE.Box3();
  const tmpV = new THREE.Vector3();

  // Crée une pièce : recentre les enfants sur leur boîte englobante.
  function part(parent, def, children, explode = [0, 0, 0], order = 0) {
    const g = new THREE.Group();
    g.name = def.name;
    children.forEach((c) => g.add(c));
    parent.add(g);
    root.updateMatrixWorld(true);
    tmpBox.setFromObject(g);
    tmpBox.getCenter(tmpV);
    parent.worldToLocal(tmpV);
    g.children.forEach((c) => c.position.sub(tmpV));
    g.position.copy(tmpV);
    finishPart(g, def, explode, order);
    return g;
  }

  // Même chose mais sans recentrage (pièces dont l'orientation est pilotée à la main)
  function finishPart(g, def, explode, order) {
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.userData.base = {
          emissive: o.material.emissive ? o.material.emissive.clone() : null,
          emissiveIntensity: o.material.emissiveIntensity,
        };
      }
    });
    g.userData = {
      isPart: true,
      def,
      home: g.position.clone(),
      explode: new THREE.Vector3(...explode),
      extra: new THREE.Vector3(),
      order,
    };
    parts.push(g);
    movers.push(g);
  }

  // Repère articulaire (groupe pivot) avec son propre décalage d'éclatement
  function frame(parent, pos, explode, order, name) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...pos);
    g.userData = { home: g.position.clone(), explode: new THREE.Vector3(...explode), extra: new THREE.Vector3(), order };
    parent.add(g);
    movers.push(g);
    return g;
  }

  const { BASE_H, J2_Y, L1, J4_Y, L2, J6_Y, TCP_Y } = DIM;
  const j1 = frame(root, [0, BASE_H, 0], [0, 0.28, 0], 1, 'J1');
  const j2 = frame(j1, [0, J2_Y, 0], [0, 0.28, 0], 2, 'J2');
  const j3 = frame(j2, [0, L1, 0], [0, 0.28, 0], 3, 'J3');
  const j4 = frame(j3, [0, J4_Y, 0], [0, 0.28, 0], 4, 'J4');
  const j5 = frame(j4, [0, L2 - J4_Y, 0], [0, 0.24, 0], 5, 'J5');
  const j6 = frame(j5, [0, J6_Y, 0], [0, 0.2, 0], 6, 'J6');
  const tcp = new THREE.Object3D();
  tcp.position.set(0, TCP_Y, 0);
  j6.add(tcp);

  // =========================================================== BASE (fixe)
  part(
    root,
    {
      id: 'plate',
      name: "Plaque d'ancrage",
      group: 'Base',
      material: 'Acier S355 usiné',
      desc: "Platine de 900 × 900 mm scellée dans la dalle béton. Elle reprend le couple de renversement du robot.",
    },
    [rbox(0.9, 0.04, 0.9, 0.012, M.graphite, [0, 0.02, 0])],
    [0, -0.4, 0],
    0
  );

  const bolts = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      bolts.push(mk(new THREE.CylinderGeometry(0.034, 0.034, 0.036, 6), M.steel, [sx * 0.37, 0.058, sz * 0.37]));
      bolts.push(cylY(0.05, 0.006, M.darkSteel, [sx * 0.37, 0.043, sz * 0.37], 32));
    }
  part(
    root,
    {
      id: 'anchors',
      name: "Boulons d'ancrage ×4",
      group: 'Base',
      material: 'Acier classe 10.9',
      desc: 'Quatre tiges filetées M20 avec rondelles : serrage de la plaque sur la dalle de béton.',
    },
    bolts,
    [0, 0.26, 0],
    0
  );

  part(
    root,
    {
      id: 'pedestal',
      name: 'Socle',
      group: 'Base',
      material: 'Aluminium anodisé',
      desc: 'Fût tronconique qui rehausse le robot et abrite la carte contrôleur ainsi que les connecteurs de puissance.',
    },
    [
      lathe(
        [
          [0.0, 0.04],
          [0.37, 0.04],
          [0.37, 0.058],
          [0.31, 0.105],
          [0.275, 0.165],
          [0.275, 0.235],
          [0.0, 0.235],
        ],
        M.graphite
      ),
    ],
    [0, -0.14, 0],
    0
  );

  const led = mk(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 24), M.ledGreen, [0, 0.15, 0.3], [Math.PI / 2, 0, 0]);
  ledMeshes.push(led);
  part(
    root,
    {
      id: 'panel',
      name: 'Panneau de commande',
      group: 'Base',
      material: 'Aluminium + polycarbonate',
      desc: "Face avant du socle : voyant d'état (vert = manuel, cyan = automatique, ambre = vue éclatée) et connecteurs.",
    },
    [
      rbox(0.17, 0.1, 0.02, 0.006, M.darkSteel, [0, 0.15, 0.285]),
      led,
      cylZ(0.012, 0.012, M.gold, [-0.05, 0.15, 0.297], 16),
      cylZ(0.012, 0.012, M.gold, [0.05, 0.15, 0.297], 16),
    ],
    [0, -0.14, 0.55],
    0
  );

  const pcb = [rbox(0.36, 0.016, 0.24, 0.002, M.pcb, [0, 0.12, 0])];
  for (const [x, z, w, d] of [
    [-0.08, 0.02, 0.07, 0.07],
    [0.04, -0.04, 0.05, 0.05],
    [0.1, 0.05, 0.04, 0.04],
  ])
    pcb.push(rbox(w, 0.012, d, 0.002, M.chip, [x, 0.134, z]));
  for (let i = 0; i < 5; i++) pcb.push(cylY(0.014, 0.034, M.steel, [-0.15 + i * 0.03, 0.14, -0.085], 20));
  for (let i = 0; i < 8; i++) pcb.push(rbox(0.008, 0.012, 0.012, 0.001, M.gold, [-0.1 + i * 0.012, 0.133, 0.1]));
  part(
    root,
    {
      id: 'board',
      name: 'Carte contrôleur',
      group: 'Base',
      material: 'FR4 + composants CMS',
      desc: "Cerveau du robot : calcule les trajectoires, pilote les 6 variateurs de moteur et lit les codeurs.",
    },
    pcb,
    [-0.75, -0.14, 0.2],
    0
  );

  part(
    root,
    {
      id: 'bearing1',
      name: 'Roulement de couronne J1',
      group: 'Base',
      material: 'Acier 100Cr6',
      desc: "Roulement à billes à contact oblique de grand diamètre : guide la rotation du carrousel et encaisse les charges.",
    },
    [
      lathe(
        [
          [0.2, 0.237],
          [0.262, 0.237],
          [0.262, 0.277],
          [0.2, 0.277],
          [0.2, 0.237],
        ],
        M.steel
      ),
      mk(new THREE.TorusGeometry(0.231, 0.007, 12, 72), M.rubber, [0, 0.257, 0], [Math.PI / 2, 0, 0]),
    ],
    [0, 0.1, 0],
    0
  );

  // =========================================================== J1 : carrousel
  part(
    j1,
    {
      id: 'gear1',
      name: 'Réducteur harmonique J1',
      group: 'J1 · Carrousel',
      material: 'Acier trempé',
      desc: "Réducteur à onde de déformation (rapport 1:120) : démultiplie le couple du moteur sans jeu.",
    },
    [cylY(0.19, 0.04, M.steel, [0, 0.02, 0], 64), ...boltRing(18, 0.165, 0.008, 0.012, M.darkSteel, 0.044)],
    [0, 0.0, 0],
    1
  );

  const cheekShape = new THREE.Shape();
  cheekShape.moveTo(-0.18, 0.2);
  cheekShape.lineTo(0.18, 0.2);
  cheekShape.lineTo(0.18, J2_Y);
  cheekShape.absarc(0, J2_Y, 0.18, 0, Math.PI, false);
  cheekShape.lineTo(-0.18, 0.2);
  const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 4,
    curveSegments: 40,
  });
  const cheekGeoR = cheekGeo.clone().rotateY(Math.PI);
  part(
    j1,
    {
      id: 'turret',
      name: 'Carrousel',
      group: 'J1 · Carrousel',
      material: 'Fonte d’aluminium peinte',
      desc: "Pièce moulée qui pivote sur J1. Ses deux joues portent l'axe d'épaule J2.",
    },
    [
      cylY(0.245, 0.2, M.paint, [0, 0.14, 0], 72),
      mk(cheekGeo, M.paint, [0, 0, 0.115]),
      mk(cheekGeoR, M.paint, [0, 0, -0.115]),
    ],
    [0, 0.18, 0],
    1
  );

  part(
    j1,
    {
      id: 'motor1',
      name: 'Moteur J1',
      group: 'J1 · Carrousel',
      material: 'Servomoteur brushless 750 W',
      desc: "Moteur synchrone à aimants permanents avec codeur absolu : il fait tourner tout le robot autour de l'axe vertical.",
    },
    [motor(0.085, 0.14).translateX(-0.1).translateY(0.15)],
    [-0.6, 0.12, 0],
    1
  );

  const motor2 = motor(0.1, 0.22);
  motor2.rotation.x = Math.PI / 2;
  motor2.position.set(0, J2_Y, 0.285);
  part(
    j1,
    {
      id: 'motor2',
      name: 'Moteur J2 (épaule)',
      group: 'J1 · Carrousel',
      material: 'Servomoteur brushless 1,5 kW',
      desc: "Gros moteur fixé sur la joue gauche : il soulève le bras inférieur. Il est équipé d'un frein à manque de courant.",
    },
    [motor2],
    [0, 0, 0.65],
    1
  );

  part(
    j1,
    {
      id: 'gear2',
      name: 'Réducteur harmonique J2',
      group: 'J1 · Carrousel',
      material: 'Acier trempé',
      desc: "Réducteur de l'épaule (rapport 1:160), monté côté droit en regard du moteur.",
    },
    [cylZ(0.15, 0.05, M.steel, [0, J2_Y, -0.2], 64), boltRingZ(14, 0.125, 0.008, 0.012, M.darkSteel, -0.228, 0, J2_Y)],
    [0, 0, -0.5],
    1
  );

  part(
    j1,
    {
      id: 'cap2',
      name: "Capot d'épaule",
      group: 'J1 · Carrousel',
      material: 'Aluminium peint',
      desc: "Cache de protection du réducteur d'épaule, retenu par quatre vis.",
    },
    [
      mk(new THREE.CylinderGeometry(0.12, 0.145, 0.04, 56), M.paint, [0, J2_Y, -0.255], [Math.PI / 2, 0, 0]),
      cylZ(0.04, 0.012, M.graphite, [0, J2_Y, -0.28], 32),
    ],
    [0, 0, -0.95],
    1
  );

  part(
    j1,
    {
      id: 'lug',
      name: 'Chape de vérin',
      group: 'J1 · Carrousel',
      material: 'Acier galvanisé',
      desc: "Patte soudée à l'arrière du carrousel : point d'ancrage inférieur du vérin d'équilibrage.",
    },
    [rbox(0.06, 0.08, 0.1, 0.01, M.darkSteel, [-0.275, 0.1, 0]), cylZ(0.016, 0.13, M.steel, [-0.3, 0.1, 0], 24)],
    [-0.55, -0.1, 0.0],
    1
  );

  // Vérin d'équilibrage : orienté dynamiquement entre la chape et le balancier
  const A = new THREE.Vector3(-0.3, 0.1, 0); // ancrage sur le carrousel (repère J1)
  const B2 = new THREE.Vector3(-0.3, 0, 0); // ancrage sur le bras (repère J2)
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32).translate(0, 0.5, 0);
  const strutBody = mk(cylGeo, M.graphite);
  strutBody.scale.set(0.038, 0.2, 0.038);
  const strutRod = mk(cylGeo, M.steel);
  strutRod.scale.set(0.02, 0.2, 0.02);
  const strutSleeve = mk(cylGeo, M.paint);
  strutSleeve.scale.set(0.044, 0.05, 0.044);
  const strut = new THREE.Group();
  strut.name = "Vérin d'équilibrage";
  strut.add(strutBody, strutRod, strutSleeve);
  strut.position.copy(A);
  j1.add(strut);
  finishPart(
    strut,
    {
      id: 'strut',
      name: "Vérin d'équilibrage",
      group: 'J1 · Carrousel',
      material: 'Ressort à gaz azote',
      desc: "Compense le poids du bras pour soulager le moteur d'épaule. Sa tige coulisse et suit chaque mouvement de J2.",
    },
    [-0.5, 0, -0.75],
    1
  );
  const strutDir = new THREE.Vector3();
  const strutB = new THREE.Vector3();
  const Y_AXIS = new THREE.Vector3(0, 1, 0);

  // =========================================================== J2 : bras inférieur
  const shellShape = new THREE.Shape();
  const R0 = 0.155;
  const R1 = 0.125;
  shellShape.moveTo(R0, 0);
  shellShape.lineTo(R1, L1);
  shellShape.absarc(0, L1, R1, 0, Math.PI, false);
  shellShape.lineTo(-R0, 0);
  shellShape.absarc(0, 0, R0, Math.PI, Math.PI * 2, false);
  const shellGeo = new THREE.ExtrudeGeometry(shellShape, {
    depth: 0.068,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 5,
    curveSegments: 48,
  });
  const shellGeoR = shellGeo.clone().rotateY(Math.PI);
  part(
    j2,
    {
      id: 'shellL',
      name: 'Coque bras inférieur · gauche',
      group: 'J2 · Épaule',
      material: 'Aluminium moulé peint',
      desc: "Demi-coque du bras inférieur. Les deux coques s'assemblent en sandwich autour des organes internes.",
    },
    [mk(shellGeo, M.paint, [0, 0, 0.025])],
    [0, 0, 0.5],
    2
  );
  part(
    j2,
    {
      id: 'shellR',
      name: 'Coque bras inférieur · droite',
      group: 'J2 · Épaule',
      material: 'Aluminium moulé peint',
      desc: 'Seconde demi-coque : elle porte le marquage constructeur et les trappes de visite.',
    },
    [mk(shellGeoR, M.paint, [0, 0, -0.025])],
    [0, 0, -0.5],
    2
  );

  const motor3 = motor(0.075, 0.2);
  motor3.rotation.x = Math.PI / 2;
  motor3.position.set(0, 0.5, 0);
  part(
    j2,
    {
      id: 'motor3',
      name: 'Moteur J3 (coude)',
      group: 'J2 · Épaule',
      material: 'Servomoteur brushless 1 kW',
      desc: "Logé dans le bras inférieur, il entraîne le coude via un réducteur coaxial.",
    },
    [motor3],
    [0, 0.05, 1.0],
    2
  );

  part(
    j2,
    {
      id: 'gear3',
      name: 'Réducteur harmonique J3',
      group: 'J2 · Épaule',
      material: 'Acier trempé',
      desc: "Démultiplie le couple du moteur de coude (rapport 1:120).",
    },
    [cylZ(0.11, 0.07, M.steel, [0, L1, 0], 64), boltRingZ(12, 0.085, 0.007, 0.01, M.darkSteel, 0.039, 0, L1)],
    [0, 0.1, -1.0],
    2
  );

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.19, 0.1, 0),
    new THREE.Vector3(-0.2, 0.28, 0),
    new THREE.Vector3(-0.17, 0.5, 0),
    new THREE.Vector3(-0.115, L1 - 0.02, 0),
  ]);
  const cableMeshes = [];
  for (const z of [-0.022, 0.022]) {
    const c = cableCurve.clone();
    c.points.forEach((p) => p.setZ(z));
    cableMeshes.push(mk(new THREE.TubeGeometry(c, 40, 0.019, 12), M.cable));
  }
  for (const t of [0.15, 0.5, 0.85]) {
    const p = cableCurve.getPoint(t);
    cableMeshes.push(cylZ(0.04, 0.012, M.darkSteel, [p.x, p.y, 0], 24));
  }
  part(
    j2,
    {
      id: 'cables',
      name: 'Faisceau de câbles',
      group: 'J2 · Épaule',
      material: 'Gaine PVC + colliers inox',
      desc: "Alimentation et signaux de l'avant-bras, maintenus par des colliers le long du bras.",
    },
    cableMeshes,
    [-0.6, 0, 0],
    2
  );

  part(
    j2,
    {
      id: 'rocker',
      name: 'Balancier & axe de vérin',
      group: 'J2 · Épaule',
      material: 'Aluminium peint + acier',
      desc: "Prolongement arrière du bras inférieur : il reçoit l'extrémité de la tige du vérin d'équilibrage.",
    },
    [rbox(0.16, 0.07, 0.1, 0.012, M.paint, [-0.22, 0, 0]), cylZ(0.016, 0.13, M.steel, [B2.x, B2.y, 0], 24)],
    [-0.45, 0, 0.0],
    2
  );

  // =========================================================== J3 : coude + avant-bras proximal
  part(
    j3,
    {
      id: 'elbow',
      name: "Boîtier de coude",
      group: 'J3 · Coude',
      material: 'Aluminium moulé peint',
      desc: "Carter du coude : cylindre transversal et fût conique qui accueille le moteur de roulis d'avant-bras.",
    },
    [
      cylZ(0.135, 0.26, M.paint, [0, 0, 0], 64),
      lathe(
        [
          [0, 0.05],
          [0.118, 0.05],
          [0.108, 0.2],
          [0.1, J4_Y],
          [0, J4_Y],
        ],
        M.paint
      ),
    ],
    [0, 0.05, 0],
    3
  );
  for (const s of [1, -1]) {
    part(
      j3,
      {
        id: s > 0 ? 'elbowCapL' : 'elbowCapR',
        name: s > 0 ? 'Capot de coude · gauche' : 'Capot de coude · droit',
        group: 'J3 · Coude',
        material: 'Aluminium anodisé graphite',
        desc: "Capot latéral du coude : protège l'axe et masque les vis de fixation.",
      },
      [cylZ(0.105, 0.022, M.graphite, [0, 0, s * 0.145], 48), cylZ(0.03, 0.01, M.steel, [0, 0, s * 0.158], 24)],
      [0, 0, s * 0.65],
      3
    );
  }
  part(
    j3,
    {
      id: 'motor4',
      name: 'Moteur J4 (roulis)',
      group: 'J3 · Coude',
      material: 'Servomoteur brushless 400 W',
      desc: "Placé dans l'axe de l'avant-bras, il le fait tourner sur lui-même.",
    },
    [motor(0.06, 0.2).translateY(0.2)],
    [0.6, 0.05, 0],
    3
  );
  part(
    j3,
    {
      id: 'gear4',
      name: 'Réducteur J4',
      group: 'J3 · Coude',
      material: 'Acier trempé',
      desc: "Étage de réduction du roulis, au raccord entre le coude et le tube d'avant-bras.",
    },
    [cylY(0.1, 0.03, M.steel, [0, J4_Y - 0.015, 0], 56), ...boltRing(10, 0.08, 0.006, 0.01, M.darkSteel, J4_Y + 0.004)],
    [0, 0.15, 0],
    3
  );

  // =========================================================== J4 : tube d'avant-bras
  part(
    j4,
    {
      id: 'forearm',
      name: "Tube d'avant-bras",
      group: 'J4 · Avant-bras',
      material: 'Alliage léger peint',
      desc: "Tube conique tournant sur J4 : léger et rigide pour limiter l'inertie au bout du bras.",
    },
    [
      lathe(
        [
          [0, 0],
          [0.1, 0],
          [0.1, 0.02],
          [0.088, 0.18],
          [0.074, 0.29],
          [0.074, 0.31],
          [0, 0.31],
        ],
        M.paint
      ),
    ],
    [0, 0.0, 0],
    4
  );

  const forkShape = new THREE.Shape();
  forkShape.moveTo(-0.085, 0.2);
  forkShape.lineTo(0.085, 0.2);
  forkShape.lineTo(0.085, L2 - J4_Y);
  forkShape.absarc(0, L2 - J4_Y, 0.085, 0, Math.PI, false);
  forkShape.lineTo(-0.085, 0.2);
  const forkGeo = new THREE.ExtrudeGeometry(forkShape, {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 3,
    curveSegments: 32,
  });
  const forkGeoR = forkGeo.clone().rotateY(Math.PI);
  part(
    j4,
    {
      id: 'fork',
      name: 'Fourche de poignet',
      group: 'J4 · Avant-bras',
      material: 'Aluminium usiné peint',
      desc: "Deux flasques qui tiennent l'axe du poignet J5, comme une chape.",
    },
    [mk(forkGeo, M.paint, [0, 0, 0.055]), mk(forkGeoR, M.paint, [0, 0, -0.055])],
    [0, 0.22, 0],
    4
  );
  const motor5 = motor(0.05, 0.14);
  motor5.rotation.x = Math.PI / 2;
  motor5.position.set(0, L2 - J4_Y, 0.16);
  part(
    j4,
    {
      id: 'motor5',
      name: 'Moteur J5 (poignet)',
      group: 'J4 · Avant-bras',
      material: 'Servomoteur brushless 200 W',
      desc: "Petit moteur compact qui incline le poignet vers le haut ou le bas.",
    },
    [motor5],
    [0, 0.05, 0.65],
    4
  );
  part(
    j4,
    {
      id: 'wristCap',
      name: 'Capot de poignet',
      group: 'J4 · Avant-bras',
      material: 'Aluminium anodisé',
      desc: "Cache côté droit de la fourche, avec un bouchon de graissage.",
    },
    [cylZ(0.065, 0.02, M.graphite, [0, L2 - J4_Y, -0.105], 40), cylZ(0.016, 0.012, M.steel, [0, L2 - J4_Y, -0.117], 20)],
    [0, 0.05, -0.65],
    4
  );

  // =========================================================== J5 : poignet
  part(
    j5,
    {
      id: 'wrist',
      name: 'Boîtier de poignet',
      group: 'J5 · Poignet',
      material: 'Aluminium anodisé + peinture',
      desc: "Cylindre d'axe J5 prolongé par le col qui reçoit la bride tournante J6.",
    },
    [
      cylZ(0.06, 0.1, M.graphite, [0, 0, 0], 48),
      cylY(0.052, 0.07, M.paint, [0, 0.05, 0], 48),
      cylY(0.058, 0.016, M.steel, [0, 0.092, 0], 48),
      cylZ(0.02, 0.116, M.steel, [0, 0, 0], 24),
    ],
    [0, 0, 0],
    5
  );

  // =========================================================== J6 : bride + pince
  part(
    j6,
    {
      id: 'flange',
      name: "Bride d'outil (ISO 9409)",
      group: 'J6 · Pince',
      material: 'Acier inoxydable',
      desc: "Interface normalisée sur laquelle on monte n'importe quel outil : pince, ventouse, soudure…",
    },
    [cylY(0.068, 0.022, M.steel, [0, 0.011, 0], 64), ...boltRing(8, 0.052, 0.006, 0.008, M.darkSteel, 0.024)],
    [0, 0, 0],
    6
  );
  part(
    j6,
    {
      id: 'adapter',
      name: "Adaptateur d'outil",
      group: 'J6 · Pince',
      material: 'Aluminium anodisé',
      desc: "Pièce intermédiaire avec ergot de centrage et passage de l'air comprimé.",
    },
    [cylY(0.05, 0.03, M.graphite, [0, 0.037, 0], 48), cylY(0.01, 0.012, M.gold, [0.034, 0.036, 0], 16)],
    [0, 0.08, 0],
    6
  );
  part(
    j6,
    {
      id: 'gripperBody',
      name: 'Corps de pince',
      group: 'J6 · Pince',
      material: 'Aluminium anodisé',
      desc: "Boîtier de la pince parallèle : il contient le mini-vérin pneumatique et le pignon-crémaillère qui synchronise les doigts.",
    },
    [
      rbox(0.18, 0.064, 0.09, 0.012, M.graphite, [0, 0.084, 0]),
      rbox(0.182, 0.012, 0.092, 0.003, M.paint, [0, 0.104, 0]),
    ],
    [0, 0.2, 0],
    6
  );
  part(
    j6,
    {
      id: 'rails',
      name: 'Rails de guidage',
      group: 'J6 · Pince',
      material: 'Acier rectifié',
      desc: "Deux barres lisses sur lesquelles coulissent les doigts avec très peu de jeu.",
    },
    [cylX(0.007, 0.27, M.steel, [0, 0.1235, -0.024], 24), cylX(0.007, 0.27, M.steel, [0, 0.1235, 0.024], 24)],
    [0, 0.34, 0],
    6
  );
  const fingers = {};
  for (const s of [-1, 1]) {
    const meshes = [
      rbox(0.052, 0.03, 0.078, 0.006, M.paint, [s * 0.046, 0.1315, 0]),
      rbox(0.016, 0.11, 0.06, 0.004, M.graphite, [s * 0.046, 0.2, 0]),
      rbox(0.008, 0.07, 0.056, 0.002, M.rubber, [s * 0.034, 0.22, 0]),
    ];
    const f = part(
      j6,
      {
        id: s < 0 ? 'fingerL' : 'fingerR',
        name: s < 0 ? 'Doigt de pince · gauche' : 'Doigt de pince · droit',
        group: 'J6 · Pince',
        material: 'Aluminium + tampon caoutchouc',
        desc: "Le doigt coulisse sur les rails ; son tampon en caoutchouc épouse la pièce saisie sans la marquer.",
      },
      meshes,
      [s * 0.35, 0.42, 0],
      6
    );
    f.userData.closedHome = f.userData.home.clone();
    f.userData.side = s;
    fingers[s] = f;
  }
  part(
    j6,
    {
      id: 'camera',
      name: 'Caméra de vision',
      group: 'J6 · Pince',
      material: 'Polymère + optique verre',
      desc: "Mini-caméra qui repère la pièce à saisir avant la descente de la pince.",
    },
    [
      rbox(0.05, 0.036, 0.03, 0.006, M.graphite, [0, 0.084, 0.06]),
      cylZ(0.014, 0.006, M.steel, [0, 0.084, 0.0765], 32),
      cylZ(0.011, 0.01, M.glass, [0, 0.084, 0.079], 32),
    ],
    [0, 0.2, 0.45],
    6
  );

  // =========================================================== état visuel
  let view = 'solid';
  let selected = null;
  let hovered = null;
  let isolate = false;
  const HILITE = new THREE.Color(0x2a8cff);

  function applyVisual() {
    for (const p of parts) {
      const isSel = p === selected;
      const isHov = p === hovered;
      const dim = isolate && selected && !isSel;
      p.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        m.wireframe = view === 'wire';
        const ghost = view === 'xray' || dim;
        if (m.transparent !== ghost) {
          m.transparent = ghost;
          m.needsUpdate = true; // le define OPAQUE du shader dépend de ce drapeau
        }
        m.opacity = dim ? 0.1 : view === 'xray' ? (isSel ? 0.7 : 0.26) : 1;
        m.depthWrite = !ghost;
        if (m.emissive) {
          const base = o.userData.base;
          if (isSel || isHov) {
            m.emissive.copy(HILITE);
            m.emissiveIntensity = isSel ? 0.7 : 0.35;
          } else {
            m.emissive.copy(base.emissive);
            m.emissiveIntensity = base.emissiveIntensity;
          }
        }
      });
    }
  }

  // =========================================================== lignes de rappel
  const leaderPos = new Float32Array(parts.length * 6);
  const leaderGeo = new THREE.BufferGeometry();
  leaderGeo.setAttribute('position', new THREE.BufferAttribute(leaderPos, 3));
  const leaderLines = new THREE.LineSegments(
    leaderGeo,
    new THREE.LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.55, depthTest: false })
  );
  const dotPos = new Float32Array(parts.length * 3);
  const dotGeo = new THREE.BufferGeometry();
  dotGeo.setAttribute('position', new THREE.BufferAttribute(dotPos, 3));
  const leaderDots = new THREE.Points(
    dotGeo,
    new THREE.PointsMaterial({ color: 0xffb347, size: 5, sizeAttenuation: false, depthTest: false })
  );
  leaderLines.frustumCulled = leaderDots.frustumCulled = false;
  leaderLines.renderOrder = leaderDots.renderOrder = 10;
  const leaders = new THREE.Group();
  leaders.add(leaderLines, leaderDots);
  leaders.visible = false;

  // =========================================================== API
  let explode = 0;
  const STAGGER = 0.8;
  const easeInOut = (t) => t * t * (3 - 2 * t);

  function layoutExplode() {
    for (const o of movers) {
      const u = o.userData;
      const k = easeInOut(clamp(explode * (1 + STAGGER) - (u.order * STAGGER) / 6, 0, 1));
      o.position.copy(u.home).add(u.extra).addScaledVector(u.explode, k);
    }
  }

  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();

  const api = {
    root,
    joints: { j1, j2, j3, j4, j5, j6 },
    tcp,
    parts,
    leaders,
    get explode() {
      return explode;
    },

    setJoints(q) {
      j1.rotation.y = q[0];
      j2.rotation.z = -q[1];
      j3.rotation.z = -q[2];
      j4.rotation.y = q[3];
      j5.rotation.z = -q[4];
      j6.rotation.y = q[5];
    },

    // ouverture de la pince : 0 = fermée (écart 60 mm) … 1 = ouverte (écart 160 mm)
    setGripper(g) {
      for (const s of [-1, 1]) {
        const f = fingers[s];
        f.userData.extra.set(s * g * 0.05, 0, 0);
      }
    },

    setExplode(e) {
      explode = e;
    },

    // à appeler une fois par image, après setJoints / setGripper / setExplode
    update() {
      layoutExplode();
      root.updateMatrixWorld(true);

      // vérin : de la chape (carrousel) au balancier (bras inférieur)
      const a = -j2.rotation.z;
      strutB.set(
        B2.x * Math.cos(a) + B2.y * Math.sin(a),
        -B2.x * Math.sin(a) + B2.y * Math.cos(a) + J2_Y,
        0
      );
      strutDir.subVectors(strutB, A);
      const d = strutDir.length();
      strut.quaternion.setFromUnitVectors(Y_AXIS, strutDir.normalize());
      strutBody.scale.y = d * 0.52;
      strutSleeve.scale.y = d * 0.1;
      strutSleeve.position.y = d * 0.46;
      strutRod.scale.y = d * 0.55;
      strutRod.position.y = d * 0.47;

      if (explode > 0.005) {
        leaders.visible = true;
        root.updateMatrixWorld(true);
        parts.forEach((p, i) => {
          const u = p.userData;
          tmpA.copy(u.home).add(u.extra);
          p.parent.localToWorld(tmpA);
          p.getWorldPosition(tmpB);
          leaderPos.set([tmpA.x, tmpA.y, tmpA.z, tmpB.x, tmpB.y, tmpB.z], i * 6);
          dotPos.set([tmpA.x, tmpA.y, tmpA.z], i * 3);
        });
        leaderGeo.attributes.position.needsUpdate = true;
        dotGeo.attributes.position.needsUpdate = true;
      } else {
        leaders.visible = false;
      }
    },

    setView(v) {
      view = v;
      applyVisual();
    },
    setHighlight({ selected: s = selected, hovered: h = hovered, isolate: i = isolate } = {}) {
      selected = s;
      hovered = h;
      isolate = i;
      applyVisual();
    },
    setStatusColor(hex) {
      for (const m of ledMeshes) {
        m.material.emissive.set(hex);
        m.material.color.set(hex).multiplyScalar(0.12);
        m.userData.base.emissive.set(hex);
      }
    },
    // remonte la hiérarchie jusqu'à la pièce sélectionnable
    findPart(obj) {
      let o = obj;
      while (o) {
        if (o.userData && o.userData.isPart) return o;
        o = o.parent;
      }
      return null;
    },
  };

  api.setJoints([0, 0, 0, 0, 0, 0]);
  api.setGripper(1);
  api.update();
  return api;
}
