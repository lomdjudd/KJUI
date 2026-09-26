// Construction de la scène : Soleil, planètes, lunes, ceinture d'astéroïdes,
// étoiles, orbites, et la version "plan 2D" de chaque astre.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SUN, PLANETS, MOON } from './data.js';
import { sunShader, coronaShader, earthShader, atmosphereShader, rimShader, starsShader } from './shaders.js';
import { uranusTexture, saturnRingTexture, sun2DTexture, flatPlanetTexture, selectRingTexture } from './textures.js';

export const YEAR = 40; // secondes pour une année terrestre à la vitesse x1

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeOutBack = (x) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

function makeLabel(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'label ' + cls;
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.center.set(0.5, 0.5);
  return obj;
}

function circlePoints(r, n = 256) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  return pts;
}

function atmosphere(radius, color, scale, sunPos, power = 2, strength = 1) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(atmosphereShader.uniforms),
    vertexShader: atmosphereShader.vertexShader,
    fragmentShader: atmosphereShader.fragmentShader,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  m.uniforms.uColor.value = new THREE.Color(color);
  m.uniforms.sunPos.value = sunPos;
  m.uniforms.uPower.value = power;
  m.uniforms.uStrength.value = strength;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * scale, 64, 32), m);
  mesh.userData.noPick = true;
  return mesh;
}

function rim(radius, color, sunPos, strength = 1) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(rimShader.uniforms),
    vertexShader: rimShader.vertexShader,
    fragmentShader: rimShader.fragmentShader,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  m.uniforms.uColor.value = new THREE.Color(color);
  m.uniforms.sunPos.value = sunPos;
  m.uniforms.uStrength.value = strength;
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.004, 64, 32), m);
}

function ringMesh(inner, outer, map, opacity = 1) {
  const geo = new THREE.RingGeometry(inner, outer, 180, 1);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - inner) / (outer - inner), 0.5);
  }
  const mat = new THREE.MeshBasicMaterial({
    map, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, color: 0xe8e2d6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

// Position d'un point sur une sphère Three.js à partir de latitude/longitude
export function latLonToVec3(lat, lon, r) {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(r);
}

export function buildWorld(scene, T, pixelRatio) {
  const sunPos = new THREE.Vector3(0, 0, 0);
  const bodies = new Map();
  const pickables = [];
  const flatMats = [];
  const labels = [];

  // ---------- Lumières ----------
  const sunLight = new THREE.PointLight(0xfff4e6, 3.2, 0, 0);
  scene.add(sunLight);
  const ambient = new THREE.AmbientLight(0x6070a0, 0.05);
  scene.add(ambient);

  // ---------- Fond : carte d'étoiles de la NASA + étoiles scintillantes ----------
  T.stars.colorSpace = THREE.SRGBColorSpace;
  const skyMat = new THREE.MeshBasicMaterial({ map: T.stars, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, color: 0xb8c4ff });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 64, 32), skyMat);
  sky.rotation.set(0.5, 0, 0.3);
  sky.renderOrder = -10;
  scene.add(sky);

  const N = 3500;
  const sPos = new Float32Array(N * 3), sSize = new Float32Array(N), sPhase = new Float32Array(N), sCol = new Float32Array(N * 3);
  const palette = [new THREE.Color('#ffffff'), new THREE.Color('#cfe0ff'), new THREE.Color('#ffe7c4'), new THREE.Color('#ffd0d0'), new THREE.Color('#bcd4ff')];
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 1500;
    const s = Math.sqrt(1 - u * u);
    sPos.set([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r], i * 3);
    sSize[i] = Math.random() < 0.04 ? 3.5 + Math.random() * 3 : 1 + Math.random() * 2.2;
    sPhase[i] = Math.random();
    const c = palette[(Math.random() * palette.length) | 0];
    sCol.set([c.r, c.g, c.b], i * 3);
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  sGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
  sGeo.setAttribute('aColor', new THREE.BufferAttribute(sCol, 3));
  const starsMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(starsShader.uniforms),
    vertexShader: starsShader.vertexShader, fragmentShader: starsShader.fragmentShader,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  starsMat.uniforms.uPixelRatio.value = pixelRatio;
  const stars = new THREE.Points(sGeo, starsMat);
  stars.renderOrder = -9;
  scene.add(stars);

  // ---------- Plan 2D : grille façon carte ----------
  const gridGroup = new THREE.Group();
  const grid = new THREE.PolarGridHelper(92, 16, 10, 128, 0x5b7bd5, 0x33508f);
  grid.material.transparent = true;
  grid.material.depthWrite = false;
  grid.position.y = -0.6;
  gridGroup.add(grid);
  scene.add(gridGroup);

  // ---------- Soleil ----------
  const sunMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(sunShader.uniforms),
    vertexShader: sunShader.vertexShader, fragmentShader: sunShader.fragmentShader,
  });
  const sunGroup = new THREE.Group();
  scene.add(sunGroup);
  const sunScale = new THREE.Group();
  sunGroup.add(sunScale);
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN.radius, 96, 64), sunMat);
  sunScale.add(sunMesh);
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(coronaShader.uniforms),
    vertexShader: coronaShader.vertexShader, fragmentShader: coronaShader.fragmentShader,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  coronaMat.uniforms.uColor.value = new THREE.Color(1.0, 0.55, 0.2);
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), coronaMat);
  corona.scale.setScalar(SUN.radius * 3.2);
  corona.userData.noPick = true;
  corona.frustumCulled = false;
  sunScale.add(corona);

  const sunFlatMat = new THREE.MeshBasicMaterial({ map: sun2DTexture(), transparent: true, depthWrite: false });
  const sunFlat = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sunFlatMat);
  sunFlat.rotation.x = -Math.PI / 2;
  sunFlat.scale.setScalar(8.5);
  sunFlat.position.y = 0.2;
  sunFlat.renderOrder = 5;
  sunGroup.add(sunFlat);

  const sunPick = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
  sunPick.scale.setScalar(SUN.radius * 1.1);
  sunGroup.add(sunPick);
  const sunLabel = makeLabel(SUN.short, 'sun');
  sunGroup.add(sunLabel);
  labels.push(sunLabel);

  const sun = {
    data: SUN, id: 'sun', group: sunGroup, scaleGroup: sunScale, mesh: sunMesh, flat: sunFlat, label: sunLabel,
    pick: sunPick, radius: SUN.radius, r2d: 7.5, isSun: true,
  };
  sunPick.userData.body = sun;
  pickables.push(sunPick);
  bodies.set('sun', sun);

  // ---------- Planètes ----------
  const texFor = {
    mercury: T.moon, venus: T.venus, earth: T.earthDay, mars: T.mars, jupiter: T.jupiter,
    saturn: T.saturn, uranus: uranusTexture(), neptune: T.neptune, pluto: T.pluto,
  };
  const flatExtra = { earth: 'earth', jupiter: 'bands', saturn: 'bands', mercury: 'craters', mars: 'craters', pluto: 'craters' };
  const glow = { venus: ['#ffdca0', 1.14, 2.2, 0.9], earth: ['#5aa8ff', 1.16, 1.8, 1.4], mars: ['#ff9a6a', 1.08, 2.6, 0.6], jupiter: ['#ffdcae', 1.07, 2.5, 0.55], saturn: ['#ffe9b8', 1.07, 2.5, 0.55], uranus: ['#9ff4ff', 1.1, 2.0, 0.9], neptune: ['#6b93ff', 1.1, 2.0, 1.0] };

  PLANETS.forEach((d, idx) => {
    const group = new THREE.Group();
    scene.add(group);
    const tilt = new THREE.Group(); // inclinaison de l'axe
    group.add(tilt);
    const pop = new THREE.Group(); // grossit quand on passe en 3D
    tilt.add(pop);

    let mat;
    const segs = d.radius > 1.5 ? 96 : 64;
    const geo = new THREE.SphereGeometry(d.radius, segs, segs / 2);
    if (d.id === 'earth') {
      mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(earthShader.uniforms),
        vertexShader: earthShader.vertexShader, fragmentShader: earthShader.fragmentShader,
      });
      mat.uniforms.dayMap.value = T.earthDay;
      mat.uniforms.nightMap.value = T.earthNight;
      mat.uniforms.specMap.value = T.earthSpec;
      mat.uniforms.sunPos.value = sunPos;
    } else {
      const map = texFor[d.id];
      map.colorSpace = THREE.SRGBColorSpace;
      mat = new THREE.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
      if (d.id === 'mercury') mat.color.set('#d8c3ae');
      if (d.id === 'venus') mat.color.set('#ffe2b0');
    }
    const mesh = new THREE.Mesh(geo, mat);
    pop.add(mesh);

    if (d.id === 'earth') {
      T.earthClouds.colorSpace = THREE.SRGBColorSpace;
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(d.radius * 1.012, 64, 32),
        new THREE.MeshStandardMaterial({ map: T.earthClouds, alphaMap: T.earthClouds, transparent: true, depthWrite: false, roughness: 1, opacity: 0.9 }),
      );
      pop.add(clouds);
      mesh.userData.clouds = clouds;
    }
    if (glow[d.id]) {
      const [c, s, p, st] = glow[d.id];
      pop.add(atmosphere(d.radius, c, s, sunPos, p, st));
      if (['earth', 'uranus', 'neptune', 'venus'].includes(d.id)) pop.add(rim(d.radius, c, sunPos, 0.7));
    }
    if (d.id === 'saturn') {
      pop.add(ringMesh(d.radius * 1.24, d.radius * 2.3, saturnRingTexture()));
    }
    if (d.id === 'uranus') {
      const r = ringMesh(d.radius * 1.6, d.radius * 2.0, saturnRingTexture(), 0.25);
      pop.add(r);
    }

    // Version 2D (dessin plat)
    const flatMat = new THREE.MeshBasicMaterial({ map: flatPlanetTexture(d.color, flatExtra[d.id]), transparent: true, depthWrite: false });
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), flatMat);
    flat.rotation.x = -Math.PI / 2;
    flat.position.y = 0.3;
    flat.renderOrder = 5;
    const r2d = Math.max(d.radius * 1.45, 1.75);
    flat.scale.setScalar(r2d);
    group.add(flat);
    flatMats.push(flatMat);
    let flatRing = null;
    if (d.id === 'saturn') {
      flatRing = new THREE.Mesh(new THREE.RingGeometry(r2d * 1.35, r2d * 1.75, 64), new THREE.MeshBasicMaterial({ color: '#f3dca6', transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      flatRing.rotation.x = -Math.PI / 2;
      flatRing.position.y = 0.25;
      flatRing.renderOrder = 5;
      group.add(flatRing);
    }

    // Zone de clic (plus grande que la planète pour les petits doigts)
    const pick = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ visible: false }));
    pick.scale.setScalar(Math.max(d.radius * 1.25, 1.4));
    group.add(pick);

    const label = makeLabel(d.short || d.name);
    group.add(label);
    labels.push(label);

    // Orbites : pointillés vifs en 2D, fil discret en 3D
    const pts = circlePoints(d.dist);
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(pts);
    const orbit3D = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: d.color, transparent: true, opacity: 0, depthWrite: false }));
    const orbit2D = new THREE.Line(orbitGeo, new THREE.LineDashedMaterial({ color: '#dfe8ff', dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.6, depthWrite: false }));
    orbit2D.computeLineDistances();
    orbit2D.position.y = -0.3;
    if (d.id === 'pluto') { orbit3D.rotation.x = 0.1; orbit2D.material.dashSize = 0.4; orbit2D.material.gapSize = 1; }
    scene.add(orbit3D, orbit2D);

    const body = {
      data: d, id: d.id, group, tilt, pop, mesh, flat, flatRing, pick, label, r2d, radius: d.radius,
      orbit3D, orbit2D, angle: (idx * 2.399 + 0.6) % (Math.PI * 2), moons: [], index: idx,
      override: null, // position forcée (activité "Tailles")
      overrideScale: 1,
    };
    pick.userData.body = body;
    pickables.push(pick);
    bodies.set(d.id, body);
  });

  // ---------- Lunes ----------
  function addMoon(hostId, opts) {
    const host = bodies.get(hostId);
    const pivot = new THREE.Group();
    pivot.rotation.x = opts.incl || 0;
    host.group.add(pivot);
    const spinner = new THREE.Group();
    pivot.add(spinner);
    const map = opts.map;
    if (map) map.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(opts.radius, 48, 24),
      new THREE.MeshStandardMaterial({ map: map || null, color: opts.color || 0xffffff, roughness: 1 }),
    );
    mesh.position.x = opts.dist;
    spinner.add(mesh);
    const moon = { pivot, spinner, mesh, speed: opts.speed, angle: Math.random() * 6.28, host, opts };
    host.moons.push(moon);
    return moon;
  }

  const moon = addMoon('earth', { radius: 0.34, dist: 2.7, speed: 1.0, map: T.moon, incl: 0.09 });
  // La Lune est un astre cliquable à part entière
  const moonPick = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  moonPick.scale.setScalar(0.7);
  moon.mesh.add(moonPick);
  const moonLabel = makeLabel(MOON.short, 'small');
  moonLabel.position.y = 0.6;
  moon.mesh.add(moonLabel);
  labels.push(moonLabel);
  const moonBody = { data: MOON, id: 'moon', group: moon.mesh, mesh: moon.mesh, pick: moonPick, label: moonLabel, radius: 0.34, isMoon: true, moonRef: moon };
  moonPick.userData.body = moonBody;
  pickables.push(moonPick);
  bodies.set('moon', moonBody);

  addMoon('mars', { radius: 0.09, dist: 1.25, speed: 3.2, map: T.phobos, incl: 0.02 });
  addMoon('mars', { radius: 0.06, dist: 1.7, speed: 1.6, color: 0xb9a893, incl: 0.03 });
  addMoon('jupiter', { radius: 0.22, dist: 4.1, speed: 2.4, map: T.io, incl: 0.01 });
  addMoon('jupiter', { radius: 0.19, dist: 5.0, speed: 1.7, map: T.europa, incl: 0.02 });
  addMoon('jupiter', { radius: 0.3, dist: 6.1, speed: 1.2, map: T.ganymede, incl: 0.01 });
  addMoon('jupiter', { radius: 0.28, dist: 7.4, speed: 0.8, map: T.callisto, incl: 0.03 });
  addMoon('saturn', { radius: 0.3, dist: 7.0, speed: 0.7, map: T.titan, incl: 0.47 });
  addMoon('neptune', { radius: 0.2, dist: 2.7, speed: -1.1, color: 0xd9d4cf, incl: 0.4 });
  addMoon('pluto', { radius: 0.16, dist: 0.85, speed: 1.3, map: T.charon, incl: 0.2 });

  // ---------- Ceinture d'astéroïdes ----------
  const beltGroup = new THREE.Group();
  scene.add(beltGroup);
  const rockGeo = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = rockGeo.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(0.75 + Math.random() * 0.5); p.setXYZ(i, v.x, v.y, v.z); }
    rockGeo.computeVertexNormals();
  }
  const BELT = 1600;
  const belt = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ color: 0x9a8f84, roughness: 1, flatShading: true }), BELT);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const beltPts = new Float32Array(BELT * 3);
  for (let i = 0; i < BELT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 28 + Math.random() * 4.5 + (Math.random() - 0.5) * 1.5;
    ps.set(Math.cos(a) * r, (Math.random() - 0.5) * 1.1, Math.sin(a) * r);
    e.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    q.setFromEuler(e);
    const s = 0.04 + Math.pow(Math.random(), 3) * 0.22;
    sc.set(s, s * (0.6 + Math.random() * 0.5), s);
    m4.compose(ps, q, sc);
    belt.setMatrixAt(i, m4);
    beltPts.set([ps.x, 0, ps.z], i * 3);
  }
  beltGroup.add(belt);
  const beltDotsGeo = new THREE.BufferGeometry();
  beltDotsGeo.setAttribute('position', new THREE.BufferAttribute(beltPts, 3));
  const beltDots = new THREE.Points(beltDotsGeo, new THREE.PointsMaterial({ color: 0xc9bfae, size: 0.35, transparent: true, depthWrite: false }));
  beltGroup.add(beltDots);
  const beltLabel = makeLabel('Ceinture d\'astéroïdes', 'small belt');
  beltLabel.position.set(0, 0, 30.5);
  beltGroup.add(beltLabel);
  labels.push(beltLabel);

  // Halo pour le survol / la sélection
  const hoverSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: selectRingTexture(), color: 0xffd65c, transparent: true, depthWrite: false, depthTest: false, opacity: 0 }));
  hoverSprite.userData.noPick = true;
  hoverSprite.renderOrder = 20;
  scene.add(hoverSprite);

  // ---------- Mise à jour ----------
  let dim = 0; // 0 = plan 2D, 1 = 3D
  const tmp = new THREE.Vector3();

  function setDimension(k) {
    dim = k;
    const flatA = 1 - smooth(0.0, 0.55, k);
    bodies.forEach((b) => {
      if (b.isMoon) return;
      if (b.isSun) {
        const s = Math.max(0.001, easeOutBack(smooth(0.05, 0.6, k)));
        b.scaleGroup.scale.setScalar(s);
        b.flat.material.opacity = flatA;
        b.flat.visible = flatA > 0.001;
        b.flat.scale.setScalar(THREE.MathUtils.lerp(8.5, 6, smooth(0, 0.5, k)));
        return;
      }
      const t0 = 0.12 + b.index * 0.04;
      const s = Math.max(0.001, easeOutBack(smooth(t0, t0 + 0.4, k)));
      b.pop.scale.setScalar(s);
      b.pop.visible = s > 0.002;
      b.flat.material.opacity = flatA;
      b.flat.visible = flatA > 0.001;
      b.flat.scale.setScalar(THREE.MathUtils.lerp(b.r2d, b.radius, smooth(0, 0.5, k)));
      if (b.flatRing) { b.flatRing.material.opacity = flatA; b.flatRing.visible = flatA > 0.001; }
      b.tilt.rotation.z = b.data.tilt * smooth(0.3, 1, k);
      b.moons.forEach((m) => { m.pivot.scale.setScalar(Math.max(0.001, smooth(0.5, 1, k))); m.pivot.visible = k > 0.5; });
      b.orbit2D.material.opacity = 0.55 * flatA;
      b.orbit2D.visible = flatA > 0.001;
    });
    grid.material.opacity = 0.45 * flatA;
    grid.visible = flatA > 0.001;
    skyMat.opacity = smooth(0.2, 1, k) * 0.9;
    starsMat.uniforms.uOpacity.value = smooth(0.2, 1, k);
    coronaMat.uniforms.uOpacity.value = smooth(0.3, 1, k);
    belt.visible = k > 0.25;
    belt.scale.setScalar(Math.max(0.001, smooth(0.25, 0.8, k)));
    beltDots.material.opacity = flatA * 0.8;
    beltDots.visible = flatA > 0.001;
    ambient.intensity = THREE.MathUtils.lerp(0.9, 0.06, smooth(0, 0.6, k));
    labels.forEach((l) => l.element.classList.toggle('flat', k < 0.5));
  }

  const opt = { orbits: true, freeze: null }; // freeze : astre qui arrête de tourner (engin posé dessus)

  function update(dt, simDt, time, camera) {
    sunMat.uniforms.uTime.value = time;
    coronaMat.uniforms.uTime.value = time;
    starsMat.uniforms.uTime.value = time;
    sunMesh.rotation.y += dt * 0.02;
    sunFlat.rotation.z += dt * 0.08;
    const spinRate = Math.min(Math.abs(simDt / Math.max(dt, 1e-5)), 4) * Math.sign(simDt || 0);

    bodies.forEach((b) => {
      if (b.isSun || b.isMoon) return;
      const d = b.data;
      b.angle += (simDt / (d.period * YEAR)) * Math.PI * 2;
      const orbitPos = tmp.set(Math.cos(b.angle) * d.dist, 0, -Math.sin(b.angle) * d.dist);
      if (d.id === 'pluto') orbitPos.y = Math.sin(b.angle) * d.dist * 0.1;
      if (b.override) {
        b.group.position.lerp(b.override, 1 - Math.exp(-dt * 3));
        b.returning = true;
      } else if (b.returning) {
        // Retour en douceur sur l'orbite après l'activité "Tailles"
        b.group.position.lerp(orbitPos, 1 - Math.exp(-dt * 3.5));
        if (b.group.position.distanceTo(orbitPos) < 0.05) b.returning = false;
      } else {
        b.group.position.copy(orbitPos);
      }
      const os = b.overrideScale;
      if (Math.abs(b.group.scale.x - os) > 1e-4) b.group.scale.setScalar(THREE.MathUtils.lerp(b.group.scale.x, os, 1 - Math.exp(-dt * 3)));
      if (opt.freeze !== d.id) b.mesh.rotation.y += dt * d.spin * 0.6 * spinRate;
      if (b.mesh.userData.clouds) b.mesh.userData.clouds.rotation.y += dt * 0.05 * spinRate;
      b.moons.forEach((m) => {
        if (!(opt.freeze === 'moon' && m === moon)) m.angle += simDt * m.speed * 0.9;
        m.spinner.rotation.y = m.angle;
      });
      // Étiquette : sous le dessin en 2D, au-dessus de la planète en 3D
      const k = smooth(0.3, 0.8, dim);
      b.label.position.set(0, THREE.MathUtils.lerp(0.3, b.radius + 0.55, k), THREE.MathUtils.lerp(b.r2d + 1.1, 0, k));
      b.orbit3D.material.opacity = (opt.orbits ? 0.22 : 0) * smooth(0.4, 1, dim) * (b.orbitBoost || 1);
      b.orbit3D.visible = b.orbit3D.material.opacity > 0.001;
    });
    sunLabel.position.set(0, THREE.MathUtils.lerp(0, SUN.radius * sun.scaleGroup.scale.x + 1.2, smooth(0.3, 0.8, dim)), THREE.MathUtils.lerp(9.5, 0, smooth(0.3, 0.8, dim)));
    beltGroup.rotation.y += simDt * 0.02;
  }

  return {
    sun, bodies, pickables, sunPos, sunLight, ambient, hoverSprite, beltGroup, beltLabel, labels, grid,
    setDimension, update, opt, get dim() { return dim; },
  };
}
