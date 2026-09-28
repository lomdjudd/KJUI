// Carte d'environnement générée (PMREM) à partir des couleurs du ciel de la zone :
// donne aux armures et aux armes leurs reflets métalliques « next-gen 2008 ».
import * as THREE from 'three';

let current = null;

export function makeEnvironment(renderer, pal) {
  const scene = new THREE.Scene();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        top: { value: new THREE.Color(pal.skyTop) },
        mid: { value: new THREE.Color(pal.horizon) },
        bot: { value: new THREE.Color(pal.ground || 0x08060a) },
        accent: { value: new THREE.Color(pal.accent || pal.horizon) },
      },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 accent; varying vec3 vP;
        void main(){
          float y = vP.y;
          vec3 c = y > 0.0 ? mix(mid, top, pow(y, 0.6)) : mix(mid, bot, pow(-y, 0.4));
          float band = exp(-abs(y) * 9.0);
          c += accent * band * 0.22;
          c += accent * 0.35 * pow(max(0.0, dot(vP, normalize(vec3(-0.4, 0.3, -0.8)))), 16.0);
          gl_FragColor = vec4(c * 3.5 + vec3(0.02), 1.0);
        }`,
    }),
  );
  scene.add(sky);
  // Quelques panneaux lumineux pour des reflets marqués (lune, lueurs)
  const addPanel = (color, x, y, z, s) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  addPanel(new THREE.Color(pal.moon || 0xd8d0ff).multiplyScalar(6), 4, 6, 4, 2.5);
  addPanel(new THREE.Color(pal.accent || 0x7a3cff).multiplyScalar(1.5), -6, 1, -3, 2);
  addPanel(new THREE.Color(pal.rim || 0x39ff9a).multiplyScalar(1.2), 3, 0.5, -6, 2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.02);
  pmrem.dispose();
  sky.geometry.dispose();
  sky.material.dispose();
  if (current) current.dispose();
  current = rt;
  return rt.texture;
}
