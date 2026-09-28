import * as THREE from 'three';
import { N, PITCH, HALF, X0, STREET } from './city.js';
import { mulberry32, clamp } from '../engine/utils.js';
import { vehicleGeometries, makeVehicleMaterial, instancedVehicleGeometry, PAINTS, VEHICLE_KINDS } from './vehicles.js';
import { Crowd } from './crowd.js';

// ---------- Circulation ----------
// Voies : 2 par sens sur chaque rue, conduite à droite. Les voitures suivent la voiture de devant,
// s'arrêtent aux feux rouges, tournent aux carrefours (clignotant), allument leurs phares la nuit.

export const LANE_OFFSETS = [2.25, 6.3];
export const SIGNAL_CYCLE = 26;
const STOP_DIST = STREET / 2 + 4.6; // ligne d'arrêt, avant le passage piéton
const WINDOW = 200; // rayon de circulation simulée autour du joueur

// Phase d'un carrefour : les voies « x » (est-ouest) puis « z » (nord-sud) ont le vert
export function signalOffset(i, j) {
  return ((i * 3.7 + j * 2.3) % SIGNAL_CYCLE + SIGNAL_CYCLE) % SIGNAL_CYCLE;
}
// 0 = vert, 1 = orange, 2 = rouge
export function signalState(axis, i, j, t) {
  const u = (t + signalOffset(i, j)) % SIGNAL_CYCLE;
  if (axis === 'x') return u < 10.5 ? 0 : u < 13 ? 1 : 2;
  return u < 14 ? 2 : u < 23.5 ? 0 : u < 26 ? 1 : 2;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _sphere = new THREE.Sphere();
const _frustum = new THREE.Frustum();
const _pm = new THREE.Matrix4();
const _c = new THREE.Color();

// Halos de phares / feux arrière (billboards additifs) et flaques de lumière sur la chaussée
function makeGlowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      attribute vec3 iPos;
      attribute vec4 iCol;
      varying vec2 vUv;
      varying vec4 vCol;
      void main() {
        vUv = position.xy;
        vCol = iCol;
        vec4 mv = viewMatrix * vec4(iPos, 1.0);
        mv.xy += position.xy * iCol.a;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      varying vec4 vCol;
      void main() {
        float d = length(vUv) * 2.0;
        float g = exp(-d * d * 5.0) + 0.35 * exp(-d * 2.5);
        g *= 1.0 - smoothstep(0.8, 1.0, d);
        gl_FragColor = vec4(vCol.rgb * g, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
}

function makePoolMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uNight: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - vec2(0.5, 0.0);
        float along = vUv.y;
        float spread = 0.18 + along * 0.4;
        float g = exp(-pow(p.x / spread, 2.0) * 3.0) * smoothstep(0.0, 0.12, along) * (1.0 - smoothstep(0.45, 1.0, along));
        gl_FragColor = vec4(vec3(1.0, 0.9, 0.72) * g * 0.42 * uNight, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
}

export class Traffic {
  constructor(scene, city, quality) {
    this.scene = scene;
    this.city = city;
    this.quality = quality;
    this.clock = 0;
    this.night = 0;
    this.camera = null;
    this.obstacles = [];
    this.policeAlert = null;
    this.nearLod = quality.detail === false ? 24 : quality.bloom ? 60 : 42;
    const rng = mulberry32(1234);

    // Voies
    this.lanes = [];
    for (let i = 0; i <= N; i++) {
      const st = X0 + i * PITCH;
      for (const off of LANE_OFFSETS) {
        this.lanes.push({ axis: 'z', c: st - off, dir: 1, street: i, off, cars: [] });
        this.lanes.push({ axis: 'z', c: st + off, dir: -1, street: i, off, cars: [] });
        this.lanes.push({ axis: 'x', c: st + off, dir: 1, street: i, off, cars: [] });
        this.lanes.push({ axis: 'x', c: st - off, dir: -1, street: i, off, cars: [] });
      }
    }
    this.laneIndex = new Map();
    for (const l of this.lanes) this.laneIndex.set(`${l.axis}|${l.street}|${l.dir}|${l.off}`, l);

    // Véhicules
    const kinds = vehicleGeometries();
    this.kinds = kinds;
    const weights = VEHICLE_KINDS.map((k) => k.weight);
    const wsum = weights.reduce((a, b) => a + b, 0);
    const pickKind = () => {
      let r = rng() * wsum;
      for (let k = 0; k < weights.length; k++) {
        r -= weights[k];
        if (r <= 0) return k;
      }
      return 0;
    };
    const policeKind = VEHICLE_KINDS.findIndex((k) => k.key === 'police');
    const busKind = VEHICLE_KINDS.findIndex((k) => k.key === 'bus');
    this.cars = [];
    this.busKind = busKind;
    const total = quality.cars;
    for (let k = 0; k < total; k++) {
      const kind = rng() < 0.03 ? policeKind : pickKind();
      const def = VEHICLE_KINDS[kind];
      const speed = (kind === busKind ? 8.5 : 10.5) + rng() * 4;
      this.cars.push({
        kind,
        lane: null,
        s: 0,
        speed,
        cur: speed,
        len: def.len,
        radius: def.radius,
        paint: new THREE.Color(def.paint || PAINTS[Math.floor(rng() * PAINTS.length)]),
        spin: rng() * 6,
        brake: 0,
        blink: 0,
        turn: null,
        nextTurn: null,
        police: kind === policeKind,
        wait: 0,
        x: 0,
        z: 9999,
        yaw: 0,
        lastInter: -1,
      });
    }
    this._center = new THREE.Vector3(1e5, 0, 1e5);

    // Maillages instanciés : un par modèle et par niveau de détail
    this.uniforms = { time: { value: 0 }, night: { value: 0 } };
    this.material = makeVehicleMaterial(this.uniforms);
    this.meshes = kinds.map((k, ki) => {
      const count = Math.max(1, this.cars.filter((c) => c.kind === ki).length);
      const mk = (geo) => {
        const g = instancedVehicleGeometry(geo, count);
        const m = new THREE.InstancedMesh(g, this.material, count);
        m.count = 0;
        m.frustumCulled = false;
        m.castShadow = quality.shadows;
        m.receiveShadow = true;
        scene.add(m);
        return m;
      };
      return { near: mk(k.near), far: mk(k.far) };
    });

    // Lumières nocturnes
    const maxGlow = 4 * 90;
    const quad = new THREE.PlaneGeometry(1, 1);
    const glowGeo = new THREE.InstancedBufferGeometry();
    glowGeo.index = quad.index;
    glowGeo.setAttribute('position', quad.attributes.position);
    glowGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(maxGlow * 3), 3));
    glowGeo.setAttribute('iCol', new THREE.InstancedBufferAttribute(new Float32Array(maxGlow * 4), 4));
    glowGeo.instanceCount = 0;
    this.glow = new THREE.Mesh(glowGeo, makeGlowMaterial());
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 3;
    this.maxGlow = maxGlow;
    scene.add(this.glow);
    const poolGeo = new THREE.PlaneGeometry(4.2, 16);
    poolGeo.rotateX(-Math.PI / 2);
    poolGeo.translate(0, 0.06, -8);
    poolGeo.rotateY(Math.PI);
    this.poolMat = makePoolMaterial();
    this.pools = new THREE.InstancedMesh(poolGeo, this.poolMat, 90);
    this.pools.count = 0;
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 2;
    scene.add(this.pools);

    // Piétons
    this.crowd = new Crowd(scene, city, quality);
  }

  _sortLane(l) {
    const d = l.dir;
    l.cars.sort((a, b) => (a.s - b.s) * d);
  }

  _removeFromLane(car) {
    const arr = car.lane.cars;
    const i = arr.indexOf(car);
    if (i >= 0) arr.splice(i, 1);
  }

  // Position monde d'un point de voie
  _lanePoint(lane, s, out) {
    if (lane.axis === 'x') out.set(s * 1, 0, lane.c);
    else out.set(lane.c, 0, s);
    return out;
  }

  // Tente un virage à droite ou à gauche au carrefour « k » (indice de rue croisée)
  _tryTurn(car, k) {
    const L = car.lane;
    const right = L.off === LANE_OFFSETS[1];
    // cap actuel et vecteur droit
    const hx = L.axis === 'x' ? L.dir : 0;
    const hz = L.axis === 'z' ? L.dir : 0;
    const rx = -hz;
    const rz = hx;
    const sx = right ? rx : -rx;
    const sz = right ? rz : -rz;
    const axis = L.axis === 'x' ? 'z' : 'x';
    const dir = axis === 'x' ? Math.sign(sx) : Math.sign(sz);
    const off = right ? LANE_OFFSETS[1] : LANE_OFFSETS[0];
    const nl = this.laneIndex.get(`${axis}|${k}|${dir}|${off}`);
    if (!nl) return null;
    if (car.kind === this._bus && !right) return null;
    const center = X0 + k * PITCH; // coordonnée de la rue croisée
    const street = X0 + L.street * PITCH; // coordonnée de notre rue
    const entryS = center - L.dir * (STREET / 2 + 1);
    const exitS = street + dir * (STREET / 2 + 1);
    // la voie d'arrivée doit être libre
    for (const o of nl.cars) {
      const d = (o.s - exitS) * dir;
      if (d > -14 && d < 10) return null;
    }
    const p0 = this._lanePoint(L, entryS, new THREE.Vector3());
    const p2 = this._lanePoint(nl, exitS, new THREE.Vector3());
    const p1 = L.axis === 'x' ? new THREE.Vector3(nl.c, 0, L.c) : new THREE.Vector3(L.c, 0, nl.c);
    let len = 0;
    const a = new THREE.Vector3();
    const b = p0.clone();
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      a.set(0, 0, 0).addScaledVector(p0, (1 - t) * (1 - t)).addScaledVector(p1, 2 * t * (1 - t)).addScaledVector(p2, t * t);
      len += a.distanceTo(b);
      b.copy(a);
    }
    if ((entryS - car.s) * L.dir <= 0) return null;
    car.blink = right ? -1 : 1;
    return { p0, p1, p2, len, t: 0, lane: nl, exitS, entryS };
  }

  // Les voitures ne vivent que dans une fenêtre autour du joueur : la densité reste élevée partout
  _lanesNear(center) {
    return this.lanes.filter((l) => Math.abs(l.c - (l.axis === 'x' ? center.z : center.x)) < WINDOW);
  }

  _place(car, lane, s) {
    if (car.lane) this._removeFromLane(car);
    car.turn = null;
    car.nextTurn = null;
    car.blink = 0;
    car.lane = lane;
    car.s = s;
    car.cur = car.speed * 0.8;
    car.lastInter = -1;
    lane.cars.push(car);
    this._lanePoint(lane, s, _p);
    car.x = _p.x;
    car.z = _p.z;
    car.yaw = lane.axis === 'x' ? (lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : lane.dir > 0 ? 0 : Math.PI;
  }

  _free(lane, s, gap) {
    for (const o of lane.cars) if (Math.abs(o.s - s) < gap + o.len / 2) return false;
    return true;
  }

  _spawn(car, center, edge) {
    const lanes = this._near;
    for (let tries = 0; tries < 8; tries++) {
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      if (car.kind === this.busKind && lane.off !== LANE_OFFSETS[1]) continue;
      const along = lane.axis === 'x' ? center.x : center.z;
      const s = edge ? along - lane.dir * (WINDOW - Math.random() * 25) : along + (Math.random() * 2 - 1) * WINDOW;
      if (Math.abs(s) > HALF + 8) continue;
      if (!this._free(lane, s, 9)) continue;
      this._place(car, lane, s);
      return true;
    }
    if (car.lane) this._removeFromLane(car);
    car.lane = null;
    car.z = 9999;
    return false;
  }

  scatter(center) {
    this._center.copy(center);
    this._near = this._lanesNear(center);
    for (const car of this.cars) this._spawn(car, center, false);
    for (const l of this.lanes) this._sortLane(l);
  }

  update(dt, playerPos, danger) {
    if (Math.hypot(playerPos.x - this._center.x, playerPos.z - this._center.z) > WINDOW * 0.9) this.scatter(playerPos);
    else if (Math.hypot(playerPos.x - this._center.x, playerPos.z - this._center.z) > 20) {
      this._center.copy(playerPos);
      this._near = this._lanesNear(playerPos);
    }
    const center = this._center;
    this.clock += dt;
    this.uniforms.time.value = this.clock;
    const night = this.night;
    this.uniforms.night.value = night;
    this.poolMat.uniforms.uNight.value = night;
    if (this._bus === undefined) this._bus = VEHICLE_KINDS.findIndex((k) => k.key === 'bus');
    const obs = this.obstacles;
    const rng = Math.random;
    const t = this.clock;

    for (const l of this.lanes) this._sortLane(l);

    for (const car of this.cars) {
      if (!car.lane && !car.turn) {
        if (Math.random() < 0.1) this._spawn(car, center, true);
        continue;
      }
      if (!car.turn) {
        const L0 = car.lane;
        const along = L0.axis === 'x' ? center.x : center.z;
        const cross = L0.axis === 'x' ? center.z : center.x;
        if (Math.abs(car.s - along) > WINDOW + 10 || Math.abs(L0.c - cross) > WINDOW + 10 || Math.abs(car.s) > HALF + 12) {
          this._spawn(car, center, true);
          continue;
        }
      }
      if (car.turn) {
        const tr = car.turn;
        car.cur += (Math.min(car.speed, 7.5) - car.cur) * Math.min(1, dt * 2);
        tr.t += (car.cur * dt) / tr.len;
        if (tr.t >= 1) {
          car.turn = null;
          car.lane = tr.lane;
          car.s = tr.exitS;
          car.blink = 0;
          tr.lane.cars.push(car);
          this._sortLane(tr.lane);
        } else {
          const u = tr.t;
          const iu = 1 - u;
          car.x = tr.p0.x * iu * iu + tr.p1.x * 2 * u * iu + tr.p2.x * u * u;
          car.z = tr.p0.z * iu * iu + tr.p1.z * 2 * u * iu + tr.p2.z * u * u;
          const dx = 2 * iu * (tr.p1.x - tr.p0.x) + 2 * u * (tr.p2.x - tr.p1.x);
          const dz = 2 * iu * (tr.p1.z - tr.p0.z) + 2 * u * (tr.p2.z - tr.p1.z);
          car.yaw = Math.atan2(dx, dz);
          car.spin += (car.cur * dt) / 0.34;
          car.brake = 0;
          continue;
        }
      }
      const L = car.lane;
      const d = L.dir;
      const front = car.s + (d * car.len) / 2;
      let gap = 60; // distance libre devant
      // voiture de devant
      const arr = L.cars;
      const i = arr.indexOf(car);
      const lead = arr[i + 1];
      if (lead) gap = Math.min(gap, (lead.s - car.s) * d - (lead.len + car.len) / 2);
      // feux
      const along = (front - X0) / PITCH;
      const k = d > 0 ? Math.ceil(along + STOP_DIST / PITCH - 1e-3) : Math.floor(along - STOP_DIST / PITCH + 1e-3);
      if (k >= 0 && k <= N) {
        const center = X0 + k * PITCH;
        const stopAt = center - d * STOP_DIST;
        const g = (stopAt - front) * d;
        const ii = L.axis === 'x' ? k : L.street;
        const jj = L.axis === 'x' ? L.street : k;
        const st = signalState(L.axis, ii, jj, t);
        if (st !== 0 && g > -0.5 && !(st === 1 && g < 6)) gap = Math.min(gap, g);
        // décision de virage en approchant du carrefour (feu vert)
        if (st === 0 && g < 4 && g > -1 && car.lastInter !== k && !car.police && !car.nextTurn) {
          car.lastInter = k;
          if (k > 0 && k < N && rng() < 0.28) car.nextTurn = this._tryTurn(car, k);
        }
      }
      // début effectif du virage à l'entrée du carrefour
      if (car.nextTurn && (car.s - car.nextTurn.entryS) * d >= 0) {
        car.turn = car.nextTurn;
        car.nextTurn = null;
        this._removeFromLane(car);
        car.x = car.turn.p0.x;
        car.z = car.turn.p0.z;
        continue;
      }
      // obstacles (joueur, ennemis) sur la voie
      let blockedByPlayer = false;
      for (const o of obs) {
        if (o.y > 4) continue;
        const ox = o.x - (L.axis === 'x' ? car.s : L.c);
        const oz = o.z - (L.axis === 'z' ? car.s : L.c);
        const ahead = (L.axis === 'x' ? ox : oz) * d - car.len / 2;
        const lat = L.axis === 'x' ? oz : ox;
        if (ahead > -1 && ahead < 18 && Math.abs(lat) < 2.2) {
          gap = Math.min(gap, ahead - 1.5);
          if (o === playerPos) blockedByPlayer = true;
        }
      }
      // vitesse autorisée pour s'arrêter à temps
      const vAllowed = Math.sqrt(Math.max(0, 2 * 6 * (gap - 2.2)));
      const target = Math.min(car.speed, vAllowed);
      const prev = car.cur;
      if (target < car.cur) car.cur = Math.max(target, car.cur - 9 * dt);
      else car.cur = Math.min(target, car.cur + 2.6 * dt);
      car.brake += ((car.cur < prev - 0.02 || car.cur < 0.3 ? 1 : 0) - car.brake) * Math.min(1, dt * 10);
      car.s += car.cur * d * dt;
      car.spin += (car.cur * dt) / 0.34;
      if (car.cur < 0.2 && blockedByPlayer) {
        car.wait += dt;
        if (car.wait > 1.8) {
          car.wait = -3 - Math.random() * 3;
          this.onHorn && this.onHorn(car);
        }
      } else if (car.wait > 0) car.wait = 0;
      else car.wait = Math.min(0, car.wait + dt);
      this._lanePoint(L, car.s, _p);
      car.x = _p.x;
      car.z = _p.z;
      car.yaw = L.axis === 'x' ? (d > 0 ? Math.PI / 2 : -Math.PI / 2) : d > 0 ? 0 : Math.PI;
    }

    this._danger = danger;
    this.crowd.update(dt, playerPos, danger);
  }

  // Remplit les instances visibles (appelé juste avant le rendu, caméra à jour)
  render() {
    this._render(this._danger);
    this.crowd.render(this.camera);
  }

  _render(danger) {
    const cam = this.camera;
    const cp = cam ? cam.position : new THREE.Vector3();
    if (cam) {
      cam.updateMatrixWorld();
      _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_pm);
    }
    const far = (this.quality.fogFar || 1200) * 0.85;
    for (const m of this.meshes) {
      m.near.count = 0;
      m.far.count = 0;
    }
    const night = this.night;
    const head = Math.max(0.1, clamp((night - 0.15) * 2, 0, 1));
    const glowOn = night > 0.2;
    const gPos = this.glow.geometry.attributes.iPos.array;
    const gCol = this.glow.geometry.attributes.iCol.array;
    let ng = 0;
    let np = 0;
    const alert = danger;
    for (const car of this.cars) {
      const dx = car.x - cp.x;
      const dz = car.z - cp.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > far) continue;
      _sphere.center.set(car.x, 1, car.z);
      _sphere.radius = car.radius;
      if (cam && !_frustum.intersectsSphere(_sphere)) continue;
      const set = this.meshes[car.kind];
      const mesh = dist < this.nearLod ? set.near : set.far;
      const n = mesh.count++;
      _p.set(car.x, 0, car.z);
      _q.setFromAxisAngle(_up, car.yaw);
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(n, _m);
      const g = mesh.geometry;
      g.attributes.iPaint.setXYZ(n, car.paint.r, car.paint.g, car.paint.b);
      const siren = car.police && alert && Math.hypot(car.x - alert.x, car.z - alert.z) < 180;
      g.attributes.iState.setXYZW(n, car.brake, head, siren ? 2 : car.blink, car.spin % (Math.PI * 2));
      // Halos nocturnes
      if (glowOn && dist < 260 && ng < this.maxGlow - 4) {
        const fx = Math.sin(car.yaw);
        const fz = Math.cos(car.yaw);
        const toCam = (fx * -dx + fz * -dz) / Math.max(1, dist);
        const L2 = car.len / 2;
        const hw = car.kind === this._bus ? 0.9 : 0.62;
        const hk = clamp(toCam * 1.3, 0.08, 1) * night;
        const tk = clamp(-toCam * 1.3, 0.1, 1) * night * (0.5 + car.brake * 0.8);
        const size = 1 + dist * 0.01;
        for (const s of [1, -1]) {
          const px = car.x + fx * L2 + fz * hw * s;
          const pz = car.z + fz * L2 - fx * hw * s;
          gPos[ng * 3] = px;
          gPos[ng * 3 + 1] = 0.72;
          gPos[ng * 3 + 2] = pz;
          gCol[ng * 4] = 1.0 * hk;
          gCol[ng * 4 + 1] = 0.92 * hk;
          gCol[ng * 4 + 2] = 0.78 * hk;
          gCol[ng * 4 + 3] = 1.3 * size;
          ng++;
          gPos[ng * 3] = car.x - fx * L2 + fz * hw * s;
          gPos[ng * 3 + 1] = 0.9;
          gPos[ng * 3 + 2] = car.z - fz * L2 - fx * hw * s;
          gCol[ng * 4] = 1.0 * tk;
          gCol[ng * 4 + 1] = 0.06 * tk;
          gCol[ng * 4 + 2] = 0.04 * tk;
          gCol[ng * 4 + 3] = 0.9 * size;
          ng++;
        }
        if (dist < 160 && np < 90) {
          _p.set(car.x + fx * L2, 0, car.z + fz * L2);
          _m.compose(_p, _q, _s);
          this.pools.setMatrixAt(np++, _m);
        }
      }
    }
    for (const m of this.meshes) {
      for (const mesh of [m.near, m.far]) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.attributes.iPaint.needsUpdate = true;
        mesh.geometry.attributes.iState.needsUpdate = true;
        mesh.visible = mesh.count > 0;
      }
    }
    this.glow.geometry.instanceCount = ng;
    this.glow.geometry.attributes.iPos.needsUpdate = true;
    this.glow.geometry.attributes.iCol.needsUpdate = true;
    this.glow.visible = ng > 0;
    this.pools.count = np;
    this.pools.instanceMatrix.needsUpdate = true;
    this.pools.visible = np > 0;
  }

  // Véhicule isolé (poursuites en mission) partageant le rendu de la circulation
  createVehicle(key, paint) {
    const ki = VEHICLE_KINDS.findIndex((k) => k.key === key);
    const kind = this.kinds[Math.max(0, ki)];
    const g = instancedVehicleGeometry(kind.near, 1);
    const mesh = new THREE.InstancedMesh(g, this.material, 1);
    mesh.castShadow = this.quality.shadows;
    mesh.frustumCulled = false;
    const col = new THREE.Color(paint || kind.paint || '#222');
    g.attributes.iPaint.setXYZ(0, col.r, col.g, col.b);
    const v = {
      mesh,
      position: new THREE.Vector3(),
      yaw: 0,
      spin: 0,
      brake: 0,
      blink: 0,
      siren: false,
      update: (dt, speed) => {
        v.spin += (speed * dt) / 0.34;
        _q.setFromAxisAngle(_up, v.yaw);
        _m.compose(v.position, _q, _s);
        mesh.setMatrixAt(0, _m);
        mesh.instanceMatrix.needsUpdate = true;
        g.attributes.iState.setXYZW(0, v.brake, Math.max(0.1, this.night), v.siren ? 2 : v.blink, v.spin % (Math.PI * 2));
        g.attributes.iState.needsUpdate = true;
      },
    };
    return v;
  }
}
