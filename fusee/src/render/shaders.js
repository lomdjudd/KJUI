// Code GLSL partagé.

export const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm3(vec3 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*snoise(p);p*=2.03;a*=0.5;}return s;}
`;

export const LOGDEPTH_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
`;
export const LOGDEPTH_F = /* glsl */ `
#include <logdepthbuf_pars_fragment>
`;

// ---------------------------------------------------------------------------
// Surface des planètes (3D)
export const PLANET_VS = /* glsl */ `
${LOGDEPTH_V}
varying vec3 vObjN;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vR0;
varying vec3 vR1;
varying vec3 vR2;
void main(){
  vUv = uv;
  vObjN = normal;
  vR0 = normalize(modelMatrix[0].xyz);
  vR1 = normalize(modelMatrix[1].xyz);
  vR2 = normalize(modelMatrix[2].xyz);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

export const PLANET_FS = /* glsl */ `
${LOGDEPTH_F}
uniform sampler2D map;
uniform sampler2D normalMap;
uniform sampler2D nightMap;
uniform sampler2D specMap;
uniform float hasNormal;
uniform float hasNight;
uniform float isEarth;
uniform float liquidSpec;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float ambient;
uniform vec3 baseColor;
uniform float hasMap;
uniform vec3 holeDir;
uniform float holeCos;
uniform float emissive;
uniform float time;
uniform float gasFlow;
varying vec3 vObjN;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vR0;
varying vec3 vR1;
varying vec3 vR2;
void main(){
  #include <logdepthbuf_fragment>
  vec3 on = normalize(vObjN);
  if (dot(on, holeDir) > holeCos) discard;
  vec2 uv = vUv;
  if (gasFlow > 0.0) {
    float lat = (uv.y - 0.5) * 3.14159;
    uv.x += time * gasFlow * (0.6 + 0.4 * sin(lat * 9.0));
  }
  vec4 tex = hasMap > 0.5 ? texture2D(map, uv) : vec4(baseColor, 1.0);
  vec3 col = tex.rgb;
  vec3 nObj = on;
  if (hasNormal > 0.5) nObj = normalize(texture2D(normalMap, uv).xyz * 2.0 - 1.0);
  mat3 rot = mat3(vR0, vR1, vR2);
  vec3 N = normalize(rot * nObj);
  vec3 Ng = normalize(rot * on);
  float geo = dot(Ng, sunDir);
  float term = smoothstep(-0.06, 0.16, geo);
  float diff = max(dot(N, sunDir), 0.0);
  diff = mix(max(geo, 0.0), diff, 0.85) * term;
  vec3 lit = col * (sunColor * diff + ambient);
  vec3 V = normalize(cameraPosition - vWorld);
  if (hasNight > 0.5) {
    vec3 night = texture2D(nightMap, uv).rgb;
    float dark = 1.0 - smoothstep(-0.18, 0.04, geo);
    lit += night * night * dark * vec3(2.6, 2.1, 1.5);
  }
  float water = 0.0;
  if (isEarth > 0.5) water = 1.0 - smoothstep(0.35, 0.6, texture2D(specMap, uv).g);
  if (liquidSpec > 0.5) water = 1.0 - tex.a;
  if (water > 0.0) {
    vec3 H = normalize(sunDir + V);
    float sp = pow(max(dot(Ng, H), 0.0), 120.0) * 3.0 + pow(max(dot(Ng, H), 0.0), 12.0) * 0.12;
    lit += sunColor * sp * water * term;
    lit = mix(lit, lit * vec3(0.85, 0.92, 1.05), water * 0.5);
  }
  lit += col * emissive;
  gl_FragColor = vec4(lit, 1.0);
}`;

// Nuages (Terre, Vénus)
export const CLOUD_FS = /* glsl */ `
${LOGDEPTH_F}
uniform sampler2D map;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float ambient;
uniform float opacity;
uniform float time;
uniform float drift;
uniform vec3 tint;
uniform vec3 holeDir;
uniform float holeCos;
varying vec3 vObjN;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vR0;
varying vec3 vR1;
varying vec3 vR2;
void main(){
  #include <logdepthbuf_fragment>
  vec3 on = normalize(vObjN);
  vec2 uv = vUv + vec2(time * drift, 0.0);
  vec4 t = texture2D(map, uv);
  float a = t.a * opacity;
  if (a < 0.01) discard;
  mat3 rot = mat3(vR0, vR1, vR2);
  vec3 Ng = normalize(rot * on);
  float geo = dot(Ng, sunDir);
  float term = smoothstep(-0.12, 0.2, geo);
  vec3 col = t.rgb * tint * (sunColor * max(geo, 0.0) * term + ambient);
  // léger rougeoiement au terminateur
  col += vec3(0.5, 0.25, 0.1) * sunColor * smoothstep(0.15, 0.0, abs(geo - 0.02)) * 0.25;
  gl_FragColor = vec4(col, a);
}`;

// ---------------------------------------------------------------------------
// Diffusion atmosphérique (Rayleigh + Mie), marche de rayon dans une coquille
export function atmoFS(steps, lsteps) {
  return /* glsl */ `
${LOGDEPTH_F}
#define STEPS ${steps}
#define LSTEPS ${lsteps}
uniform vec3 uPlanet;
uniform float uR;
uniform float uRa;
uniform vec3 uBetaR;
uniform float uBetaM;
uniform float uHR;
uniform float uHM;
uniform float uG;
uniform vec3 uSunDir;
uniform float uSunI;
varying vec3 vWorld;
vec2 rs(vec3 o, vec3 d, float r){ float b=dot(o,d); float c=dot(o,o)-r*r; float h=b*b-c; if(h<0.0) return vec2(1e9,-1e9); h=sqrt(h); return vec2(-b-h,-b+h); }
void main(){
  #include <logdepthbuf_fragment>
  vec3 ro = (cameraPosition - uPlanet) / uR;
  vec3 rd = normalize(vWorld - cameraPosition);
  float Ra = uRa / uR;
  vec2 a = rs(ro, rd, Ra);
  if (a.x > a.y || a.y < 0.0) discard;
  float t0 = max(a.x, 0.0);
  float t1 = a.y;
  vec2 pl = rs(ro, rd, 1.0);
  if (pl.x < pl.y && pl.x > 0.0) t1 = min(t1, pl.x);
  float seg = (t1 - t0) / float(STEPS);
  float HR = uHR / uR, HM = uHM / uR;
  vec3 bR = uBetaR * uR;
  float bM = uBetaM * uR;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (t0 + seg * (float(i) + 0.5));
    float h = max(length(p) - 1.0, 0.0);
    float dR = exp(-h / HR) * seg;
    float dM = exp(-h / HM) * seg;
    odR += dR; odM += dM;
    vec2 sp = rs(p, uSunDir, 1.0);
    if (sp.x > 0.0 && sp.x < sp.y) continue;
    vec2 l = rs(p, uSunDir, Ra);
    float ls = l.y / float(LSTEPS);
    float lR = 0.0, lM = 0.0;
    for (int j = 0; j < LSTEPS; j++) {
      vec3 q = p + uSunDir * ls * (float(j) + 0.5);
      float hq = max(length(q) - 1.0, 0.0);
      lR += exp(-hq / HR) * ls;
      lM += exp(-hq / HM) * ls;
    }
    vec3 att = exp(-(bR * (odR + lR) + bM * 1.1 * (odM + lM)));
    sumR += dR * att;
    sumM += dM * att;
  }
  float mu = dot(rd, uSunDir);
  float pR = 0.0597 * (1.0 + mu * mu);
  float g = uG;
  float pM = 0.1194 * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(max(1.0 + g * g - 2.0 * g * mu, 1e-4), 1.5));
  vec3 col = uSunI * (sumR * bR * pR + sumM * bM * pM);
  vec3 tr = exp(-(bR * odR + bM * 1.1 * odM));
  float alpha = 1.0 - (tr.r + tr.g + tr.b) / 3.0;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`;
}

export const ATMO_VS = /* glsl */ `
${LOGDEPTH_V}
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

// ---------------------------------------------------------------------------
// Anneaux
export const RING_VS = /* glsl */ `
${LOGDEPTH_V}
varying vec3 vWorld;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;

export const RING_FS = /* glsl */ `
${LOGDEPTH_F}
uniform sampler2D map;
uniform vec3 sunDir;
uniform vec3 planetPos;
uniform float planetR;
uniform float opacity;
uniform vec3 color;
varying vec3 vWorld;
varying vec2 vUv;
void main(){
  #include <logdepthbuf_fragment>
  vec4 t = texture2D(map, vec2(vUv.x, 0.5));
  float a = t.a * opacity;
  if (a < 0.005) discard;
  // ombre de la planète sur les anneaux
  vec3 o = vWorld - planetPos;
  float b = dot(o, sunDir);
  float c = dot(o, o) - planetR * planetR;
  float h = b * b - c;
  float shadow = (h > 0.0 && -b - sqrt(h) > 0.0) ? 0.08 : 1.0;
  vec3 col = t.rgb * color * (0.15 + 0.85 * shadow) * 1.4;
  gl_FragColor = vec4(col, a);
}`;

// ---------------------------------------------------------------------------
// Soleil (surface animée)
export const SUN_FS = /* glsl */ `
${LOGDEPTH_F}
${NOISE_GLSL}
uniform float time;
varying vec3 vObjN;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vR0;
varying vec3 vR1;
varying vec3 vR2;
void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vObjN);
  float g = fbm3(n * 9.0 + vec3(0.0, 0.0, time * 0.02));
  float g2 = snoise(n * 40.0 + time * 0.05);
  vec3 V = normalize(cameraPosition - vWorld);
  float limb = pow(max(dot(normalize(mat3(vR0, vR1, vR2) * n), V), 0.0), 0.45);
  vec3 col = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.86, 0.55), 0.55 + g * 0.5 + g2 * 0.08);
  gl_FragColor = vec4(col * (6.0 + 5.0 * limb), 1.0);
}`;

// Étoiles (points)
export const STAR_VS = /* glsl */ `
${LOGDEPTH_V}
attribute float size;
attribute vec3 tint;
uniform float scale;
uniform float time;
uniform float twinkle;
varying vec3 vTint;
void main(){
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float tw = 1.0 + twinkle * 0.5 * sin(time * 7.0 + position.x * 0.37 + position.y * 0.19);
  gl_PointSize = size * scale * tw;
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
export const STAR_FS = /* glsl */ `
${LOGDEPTH_F}
uniform float brightness;
varying vec3 vTint;
void main(){
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float a = smoothstep(0.5, 0.0, d);
  a = a * a;
  gl_FragColor = vec4(vTint * a * brightness, a);
}`;

// Voie lactée (sphère de fond)
export const MILKY_FS = /* glsl */ `
${LOGDEPTH_F}
${NOISE_GLSL}
uniform float brightness;
varying vec3 vWorld;
varying vec3 vObjN;
void main(){
  #include <logdepthbuf_fragment>
  vec3 d = normalize(vObjN);
  vec3 bandN = normalize(vec3(0.3, 0.55, 0.78));
  float b = dot(d, bandN);
  float band = exp(-b * b / 0.012);
  float core = exp(-(1.0 - dot(d, normalize(vec3(-0.6, 0.7, -0.35)))) / 0.08);
  float n = fbm3(d * 6.0) * 0.5 + 0.5;
  float dust = smoothstep(0.4, 0.75, fbm3(d * 13.0 + 3.0) * 0.5 + 0.5);
  float neb = pow(max(fbm3(d * 2.2 + 7.0), 0.0), 2.0);
  vec3 col = vec3(0.5, 0.58, 0.8) * band * (0.2 + n * 0.6) * (1.0 - dust * 0.8);
  col += vec3(0.95, 0.78, 0.58) * band * core * 0.8 * (1.0 - dust * 0.6);
  col += vec3(0.45, 0.2, 0.6) * neb * 0.03 + vec3(0.12, 0.25, 0.5) * pow(max(fbm3(d * 3.1 - 5.0), 0.0), 2.0) * 0.025;
  col *= 0.16;
  gl_FragColor = vec4(col * brightness, 1.0);
}`;
export const BG_VS = /* glsl */ `
${LOGDEPTH_V}
varying vec3 vWorld;
varying vec3 vObjN;
void main(){
  vObjN = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
  #include <logdepthbuf_vertex>
}`;
