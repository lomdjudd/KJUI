// Ciel, soleil, lune, étoiles et cycle jour/nuit.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { clamp, lerp } from '../core/util.js';

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSun: { value: new THREE.Vector3() },
      uNight: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(1800, 32, 16);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 uTop; uniform vec3 uBottom; uniform vec3 uSun; uniform float uNight;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          float h = clamp(vDir.y * 1.4 + 0.15, 0.0, 1.0);
          vec3 col = mix(uBottom, uTop, h);
          float s = max(dot(vDir, normalize(uSun)), 0.0);
          col += vec3(1.0, 0.85, 0.6) * pow(s, 800.0) * 3.0 * (1.0 - uNight);
          col += vec3(1.0, 0.6, 0.3) * pow(s, 8.0) * 0.35 * (1.0 - uNight);
          // Lune à l'opposé
          float mo = max(dot(vDir, -normalize(uSun)), 0.0);
          col += vec3(0.85, 0.9, 1.0) * smoothstep(0.9994, 0.9997, mo) * uNight;
          // Étoiles
          vec3 q = floor(vDir * 300.0);
          float st = step(0.9975, hash(q)) * uNight * smoothstep(0.0, 0.3, vDir.y);
          col += vec3(st);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.renderOrder = -1;
    scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x4a5a3a, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
    this.sun.castShadow = true;
    const q = G.settings.quality;
    const ss = q === 'low' ? 1024 : q === 'high' ? 4096 : 2048;
    this.sun.shadow.mapSize.set(ss, ss);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -70;
    sc.right = sc.top = 70;
    sc.near = 1;
    sc.far = 400;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.fog = new THREE.Fog(0xbfd8ee, 80, 520);
  }

  update(target, underwater) {
    const hour = G.time.hour;
    const ang = ((hour - 6) / 24) * Math.PI * 2; // 6h : lever
    const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0.35).normalize();
    const day = clamp(sunDir.y * 3 + 0.3, 0, 1);
    const dusk = clamp(1 - Math.abs(sunDir.y) * 4, 0, 1) * (sunDir.y > -0.2 ? 1 : 0);
    this.uniforms.uSun.value.copy(sunDir);
    this.uniforms.uNight.value = 1 - day;

    const top = new THREE.Color(0x0a1028).lerp(new THREE.Color(0x3a8ae0), day);
    const bottom = new THREE.Color(0x101830).lerp(new THREE.Color(0xc8e4f8), day).lerp(new THREE.Color(0xff9a5a), dusk * 0.6);
    this.uniforms.uTop.value.copy(top);
    this.uniforms.uBottom.value.copy(bottom);

    const lightDir = sunDir.y > -0.05 ? sunDir : sunDir.clone().negate(); // la lune éclaire la nuit
    this.sun.position.copy(target).addScaledVector(lightDir, 200);
    this.sun.target.position.copy(target);
    this.sun.intensity = lerp(0.35, 2.4, day);
    this.sun.color.setHex(0xfff2dd).lerp(new THREE.Color(0xff9a5a), dusk * 0.5);
    if (day < 0.2) this.sun.color.setHex(0x8aa0d0);
    this.hemi.intensity = lerp(0.35, 0.95, day) * (underwater ? 1.6 : 1);
    this.dome.position.copy(G.camera.position);

    const fog = this.scene.fog;
    if (underwater) {
      fog.color.setHex(0x0a4a6a).multiplyScalar(lerp(0.3, 1, day));
      fog.near = 2;
      fog.far = 70;
    } else {
      fog.color.copy(bottom);
      fog.near = 90;
      fog.far = G.settings.quality === 'low' ? 380 : 560;
    }
    this.day = day;
    this.sunDir = sunDir;
    if (G.world) {
      const u = G.world.water.material.uniforms;
      u.uSun.value.copy(sunDir);
      u.uLight.value = lerp(0.3, 1, day);
      u.uSky.value.copy(bottom);
    }
  }
}
