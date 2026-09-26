// Shaders GLSL : Soleil animé, Terre jour/nuit, halos d'atmosphère.

const NOISE = /* glsl */ `
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
float fbm(vec3 p){float f=0.0;float a=0.5;for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.02;a*=0.5;}return f;}
`;

export const sunShader = {
  uniforms: { uTime: { value: 0 }, uIntensity: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
    void main(){
      vPos = position;
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform float uIntensity;
    varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
    ${NOISE}
    void main(){
      vec3 p = normalize(vPos);
      float t = uTime * 0.06;
      // Granulation + grandes cellules de convection qui bougent lentement
      float n1 = fbm(p * 3.0 + vec3(t, -t * 0.7, t * 0.4));
      float n2 = fbm(p * 9.0 - vec3(t * 1.7, t, -t * 1.3));
      float spots = smoothstep(0.55, 0.8, snoise(p * 2.2 + vec3(0.0, t * 0.3, 0.0)));
      float n = n1 * 0.65 + n2 * 0.35;
      vec3 deep = vec3(0.85, 0.22, 0.02);
      vec3 mid = vec3(1.0, 0.55, 0.08);
      vec3 hot = vec3(1.0, 0.82, 0.4);
      vec3 col = mix(deep, mid, smoothstep(-0.5, 0.2, n));
      col = mix(col, hot, smoothstep(0.1, 0.6, n));
      col *= 1.0 - spots * 0.45;
      // Assombrissement centre-bord (comme le vrai Soleil) + liseré lumineux
      float mu = clamp(dot(vNormal, vView), 0.0, 1.0);
      col *= 0.55 + 0.6 * pow(mu, 0.45);
      col += vec3(1.0, 0.45, 0.1) * pow(1.0 - mu, 3.0) * 0.8;
      gl_FragColor = vec4(col * 1.25 * uIntensity, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export const coronaShader = {
  uniforms: { uTime: { value: 0 }, uColor: { value: null }, uOpacity: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      // Billboard : le quad fait toujours face à la caméra
      vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float s = length(modelMatrix[0].xyz);
      mv.xy += position.xy * s;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
    varying vec2 vUv;
    ${NOISE}
    void main(){
      vec2 c = vUv - 0.5;
      float r = length(c) * 2.0;
      float a = atan(c.y, c.x);
      float rays = 0.5 + 0.5 * snoise(vec3(cos(a) * 2.5, sin(a) * 2.5, uTime * 0.15));
      rays += 0.35 * snoise(vec3(cos(a) * 9.0, sin(a) * 9.0, uTime * 0.3));
      float inner = 0.25; // rayon du disque solaire dans le quad
      float d = max(r - inner, 0.0);
      float glow = exp(-d * 6.5) * 0.55 + exp(-d * 16.0) * 0.9;
      glow *= 0.75 + 0.5 * rays;
      glow *= smoothstep(1.0, 0.7, r);
      gl_FragColor = vec4(uColor * glow * uOpacity, 1.0);
    }`,
};

export const earthShader = {
  uniforms: {
    dayMap: { value: null }, nightMap: { value: null }, specMap: { value: null },
    sunPos: { value: null }, uAmbient: { value: 0.04 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv; varying vec3 vWNormal; varying vec3 vWPos;
    void main(){
      vUv = uv;
      vWNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D dayMap; uniform sampler2D nightMap; uniform sampler2D specMap;
    uniform vec3 sunPos; uniform float uAmbient;
    varying vec2 vUv; varying vec3 vWNormal; varying vec3 vWPos;
    void main(){
      vec3 N = normalize(vWNormal);
      vec3 L = normalize(sunPos - vWPos);
      vec3 V = normalize(cameraPosition - vWPos);
      float ndl = dot(N, L);
      vec3 day = texture2D(dayMap, vUv).rgb;
      vec3 night = texture2D(nightMap, vUv).rgb * vec3(1.0, 0.8, 0.5) * 1.6;
      float spec = texture2D(specMap, vUv).r;
      float dayMix = smoothstep(-0.12, 0.25, ndl);
      vec3 lit = day * (max(ndl, 0.0) * 1.25 + uAmbient);
      // Reflet du Soleil sur les océans
      vec3 H = normalize(L + V);
      lit += vec3(1.0, 0.9, 0.7) * pow(max(dot(N, H), 0.0), 40.0) * spec * 0.9 * max(ndl, 0.0);
      // Lueur orangée au lever / coucher du soleil
      float twilight = smoothstep(-0.15, 0.0, ndl) * smoothstep(0.25, 0.0, ndl);
      lit += vec3(0.6, 0.25, 0.08) * twilight * 0.25;
      vec3 col = mix(night + day * uAmbient, lit, dayMix);
      gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

// Halo d'atmosphère : sphère un peu plus grande, vue par l'intérieur.
export const atmosphereShader = {
  uniforms: { uColor: { value: null }, sunPos: { value: null }, uPower: { value: 2.0 }, uStrength: { value: 1.0 } },
  vertexShader: /* glsl */ `
    varying vec3 vWNormal; varying vec3 vWPos;
    void main(){
      vWNormal = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform vec3 sunPos; uniform float uPower; uniform float uStrength;
    varying vec3 vWNormal; varying vec3 vWPos;
    void main(){
      vec3 N = normalize(vWNormal);
      vec3 V = normalize(cameraPosition - vWPos);
      float rim = clamp(-dot(N, V), 0.0, 1.0);
      float i = pow(rim, uPower) * smoothstep(0.0, 0.25, rim);
      vec3 L = normalize(sunPos - vWPos);
      float lit = smoothstep(-0.45, 0.5, dot(N, L));
      gl_FragColor = vec4(uColor * i * uStrength * (0.15 + lit), 1.0);
    }`,
};

// Liseré lumineux sur le bord éclairé d'une planète (face avant, additif).
export const rimShader = {
  uniforms: { uColor: { value: null }, sunPos: { value: null }, uStrength: { value: 1.0 } },
  vertexShader: atmosphereShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform vec3 sunPos; uniform float uStrength;
    varying vec3 vWNormal; varying vec3 vWPos;
    void main(){
      vec3 N = normalize(vWNormal);
      vec3 V = normalize(cameraPosition - vWPos);
      vec3 L = normalize(sunPos - vWPos);
      float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
      float lit = smoothstep(-0.25, 0.5, dot(N, L));
      gl_FragColor = vec4(uColor * fres * lit * uStrength, 1.0);
    }`,
};

// Étoiles scintillantes (points).
export const starsShader = {
  uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uPixelRatio: { value: 1 } },
  vertexShader: /* glsl */ `
    attribute float aSize; attribute float aPhase; attribute vec3 aColor;
    uniform float uTime; uniform float uPixelRatio;
    varying vec3 vColor; varying float vTw;
    void main(){
      vColor = aColor;
      vTw = 0.65 + 0.35 * sin(uTime * (0.8 + aPhase) + aPhase * 20.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * uPixelRatio;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uOpacity; varying vec3 vColor; varying float vTw;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      float a = smoothstep(0.5, 0.0, d);
      a = a * a;
      gl_FragColor = vec4(vColor * a * vTw * uOpacity * 1.6, 1.0);
    }`,
};
