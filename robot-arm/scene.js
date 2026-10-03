import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  backgroundTexture,
  concreteTexture,
  floorMarkingTexture,
  radialAlphaTexture,
} from './materials.js';

// Positions des deux palettes de travail (repère de la base, Y vers le haut)
const PAD_R = 0.95;
const PAD_AZ = (38 * Math.PI) / 180;
export const PAD_H = 0.08;
export const CUBE = 0.08;
export const PADS = {
  A: new THREE.Vector3(PAD_R * Math.cos(PAD_AZ), 0, -PAD_R * Math.sin(PAD_AZ)),
  B: new THREE.Vector3(PAD_R * Math.cos(-PAD_AZ), 0, -PAD_R * Math.sin(-PAD_AZ)),
};

export function buildScene(renderer, M) {
  const scene = new THREE.Scene();
  scene.background = backgroundTexture();
  scene.fog = new THREE.Fog(0x0d1118, 14, 34);

  // Éclairage de studio : environnement HDR procédural + soleil ombré + contre-jours
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const key = new THREE.DirectionalLight(0xfff1de, 2.6);
  key.position.set(4.5, 8, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -4.5;
  sc.right = sc.top = 4.5;
  sc.near = 1;
  sc.far = 24;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x8fb4ff, 1.3);
  rim.position.set(-5, 3.5, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffd9b0, 0.5);
  fill.position.set(-3, 2.5, 5);
  scene.add(fill);

  // Sol : béton + voile d'estompage + marquage de sécurité
  const concrete = concreteTexture();
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 96),
    new THREE.MeshStandardMaterial({
      map: concrete,
      roughness: 0.78,
      metalness: 0.05,
      transparent: true,
      alphaMap: radialAlphaTexture(),
    })
  );
  concrete.repeat.set(5, 5);
  floor.material.color.setScalar(0.62);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  scene.add(floor);

  const marking = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshBasicMaterial({ map: floorMarkingTexture(), transparent: true, depthWrite: false, opacity: 0.9 })
  );
  marking.rotation.x = -Math.PI / 2;
  marking.position.y = 0.003;
  marking.renderOrder = 1;
  scene.add(marking);

  // Palettes de dépose
  const padGeo = new THREE.CylinderGeometry(0.15, 0.17, PAD_H, 48);
  for (const [name, pos] of Object.entries(PADS)) {
    const pad = new THREE.Mesh(padGeo, M.graphite);
    pad.position.set(pos.x, PAD_H / 2, pos.z);
    pad.castShadow = pad.receiveShadow = true;
    scene.add(pad);
    const top = new THREE.Mesh(new THREE.RingGeometry(0.085, 0.12, 48), M.yellow);
    top.rotation.x = -Math.PI / 2;
    top.position.set(pos.x, PAD_H + 0.001, pos.z);
    scene.add(top);
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.152, 0.152, 0.012, 48),
      new THREE.MeshStandardMaterial({ color: name === 'A' ? 0xf2b705 : 0x3fb6ff, roughness: 0.5, metalness: 0.2 })
    );
    label.position.set(pos.x, 0.03, pos.z);
    scene.add(label);
  }

  // Armoire électrique en arrière-plan (décor)
  const cab = new THREE.Group();
  const cabBody = new THREE.Mesh(new RoundedBoxGeometry(0.6, 1.5, 0.45, 4, 0.02), M.graphite);
  cabBody.position.y = 0.75;
  cabBody.castShadow = cabBody.receiveShadow = true;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x03121a, emissive: 0x1e90ff, emissiveIntensity: 0.9, roughness: 0.2 })
  );
  screen.position.set(0, 1.12, 0.226);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.47), M.paint);
  stripe.position.y = 1.4;
  cab.add(cabBody, screen, stripe);
  cab.position.set(-4.3, 0, 1.8);
  cab.rotation.y = Math.atan2(4.3, -1.8);
  scene.add(cab);

  // Cube manipulable (état : repos / tenu / chute libre)
  const cube = new THREE.Mesh(new RoundedBoxGeometry(CUBE, CUBE, CUBE, 5, 0.008), M.cube);
  cube.castShadow = cube.receiveShadow = true;
  cube.name = 'cube';
  scene.add(cube);
  const cubeState = { mode: 'rest', vy: 0 };

  // Cubes décoratifs
  const decoColors = [0xe8453c, 0x8fd14f];
  decoColors.forEach((c, i) => {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(CUBE, CUBE, CUBE, 5, 0.008),
      new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 })
    );
    m.castShadow = m.receiveShadow = true;
    const ang = (i ? -0.5 : 0.6) + Math.PI * 0.92;
    m.position.set(Math.cos(ang) * 1.15, CUBE / 2, -Math.sin(ang) * 1.15);
    m.rotation.y = 0.4 + i;
    scene.add(m);
  });

  // Trace du TCP
  const TRAIL_N = 1400;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setDrawRange(0, 0);
  const trail = new THREE.Line(
    trailGeo,
    new THREE.LineBasicMaterial({ color: 0x35e0ff, transparent: true, opacity: 0.95 })
  );
  trail.frustumCulled = false;
  scene.add(trail);
  let trailCount = 0;

  // Cible cliquable (mode « Pointer une cible »)
  const target = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.07, 0.085, 48),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, side: THREE.DoubleSide, transparent: true, opacity: 0.95 })
  );
  ring.rotation.x = -Math.PI / 2;
  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(0.02, 0.03, 32),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, side: THREE.DoubleSide })
  );
  ring2.rotation.x = -Math.PI / 2;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 1, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.45 })
  );
  target.add(ring, ring2, beam);
  target.visible = false;
  scene.add(target);

  const props = {
    scene,
    key,
    floor,
    cube,
    cubeState,
    target,
    trail: {
      clear() {
        trailCount = 0;
        trailGeo.setDrawRange(0, 0);
      },
      push(v) {
        if (trailCount >= TRAIL_N) {
          trailPos.copyWithin(0, 3);
          trailCount = TRAIL_N - 1;
        }
        trailPos.set([v.x, v.y, v.z], trailCount * 3);
        trailCount++;
        trailGeo.setDrawRange(0, trailCount);
        trailGeo.attributes.position.needsUpdate = true;
      },
      setVisible(v) {
        trail.visible = v;
      },
    },
    setTarget(p) {
      target.visible = true;
      target.position.set(p.x, 0.004, p.z);
      const h = Math.max(0.01, p.y);
      beam.scale.y = h;
      beam.position.y = h / 2;
      ring2.position.y = h;
    },
    hideTarget() {
      target.visible = false;
    },

    // hauteur du support sous un point du plan horizontal
    supportHeight(x, z) {
      for (const p of Object.values(PADS)) if (Math.hypot(p.x - x, p.z - z) < 0.15) return PAD_H;
      return 0;
    },
    // pose le cube sur son support le plus proche
    placeCube(x, z, yaw = 0) {
      cube.position.set(x, props.supportHeight(x, z) + CUBE / 2, z);
      cube.rotation.set(0, yaw, 0);
      cubeState.mode = 'rest';
    },
    resetCube() {
      cube.removeFromParent();
      scene.add(cube);
      props.placeCube(PADS.A.x, PADS.A.z, PAD_AZ);
    },
    // lâche le cube : il tombe jusqu'au support situé en dessous
    dropCube() {
      scene.attach(cube);
      cubeState.mode = 'fall';
      cubeState.vy = 0;
    },
    update(dt) {
      if (cubeState.mode === 'fall') {
        cubeState.vy -= 9.81 * dt;
        cube.position.y += cubeState.vy * dt;
        const floorY = props.supportHeight(cube.position.x, cube.position.z) + CUBE / 2;
        if (cube.position.y <= floorY) {
          cube.position.y = floorY;
          if (Math.abs(cubeState.vy) > 1.2) cubeState.vy *= -0.18;
          else {
            cubeState.mode = 'rest';
            cubeState.vy = 0;
          }
        }
        // se remet à plat
        cube.rotation.x *= 0.85;
        cube.rotation.z *= 0.85;
      }
    },
  };
  props.resetCube();
  return props;
}
