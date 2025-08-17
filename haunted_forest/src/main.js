// // nebbia funziona 
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let ambient, sun;
let debugEl;
let animateFog = true;       // [A] per ON/OFF
const _fogShaders = new Set();

/* ================== Procedural fog chunks (FBM) ================== */
const NOISE_GLSL = `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz - D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float FBM(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
`;

// 1) world position
THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying vec3 vWorldPosition;
#endif
`;
THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vWorldPosition = worldPosition.xyz;
#endif
`;

// 2) uniform + noise
THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
#ifdef USE_FOG
  uniform float fogTime;
  uniform vec3 fogColor;
  varying vec3 vWorldPosition;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`;

// 3) formula (parametri come la repo)
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  vec3 fogOrigin = cameraPosition;
  vec3 dir = normalize(vWorldPosition - fogOrigin);
  float dist = distance(vWorldPosition, fogOrigin);

  // scala/velocità come repo
  vec3 sampleP = vWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
  float n = FBM(sampleP + FBM(sampleP)); n = n*0.5 + 0.5;

  dist *= mix(n, 1.0, clamp((dist - 5000.0)/5000.0, 0.0, 1.0));
  dist *= dist;

  float y = dir.y; if(abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0)*1e-4;
  float heightFactor = 0.05;
  float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) *
                    (1.0 - exp(-dist * y * fogDensity)) / y;

  fogFactor = clamp(fogFactor, 0.0, 1.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
`;

// aggancia uniform fogTime ai materiali
function attachFogTo(root){
  root.traverse?.((child)=>{
    const mat = child.material; if(!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    mats.forEach(m=>{
      m.fog = true;
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader)=>{
        prev?.(shader);
        shader.uniforms.fogTime = { value: 0.0 };
        _fogShaders.add(shader);
      };
      m.needsUpdate = true;
    });
  });
}

/* ================== App ================== */
init();
animate();

function init(){
  // SCENA
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87a0c0);

  // CAMERA (far grande + camera alta)
  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 20000);
  camera.position.set(0, 20, 120);   // un po’ più indietro per percepire il tappeto
  camera.updateProjectionMatrix();

  // RENDERER
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('game-canvas'),
    antialias: true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;

  // LUCI
  ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);
  sun = new THREE.DirectionalLight(0xffe6b3, 1.0);
  sun.position.set(60, 120, 80);
  sun.castShadow = true;
  scene.add(sun);

  // FOG molto sottile (ordini di grandezza come repo)
  scene.fog = new THREE.FogExp2(0xDFE9F3, 5e-6);

  // TERRENO grande
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20000, 20000, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1 })
  );
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Qualche oggetto verticale per percepire la stratificazione
  const matCone = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7, metalness: 0.0 });
  for(let i=0;i<60;i++){
    const cone = new THREE.Mesh(new THREE.ConeGeometry(20, 200, 16), matCone);
    const r = 1200 + Math.random()*1800;
    const a = Math.random()*Math.PI*2;
    cone.position.set(Math.cos(a)*r, 100, Math.sin(a)*r);
    cone.castShadow = true;
    scene.add(cone);
  }

  // tre box come nel test
  const makeBox = (z, h=50, col=0x9db385)=>{
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.1 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(60, h, 60), m);
    b.position.set(0, h/2, z);
    b.castShadow = true;
    scene.add(b);
  };
  makeBox(-300, 80, 0xb9d097);
  makeBox(-900, 120, 0x9db385);
  makeBox(-1800, 200, 0x7f956c);

  // collega la fog procedurale
  attachFogTo(scene);

  // CONTROLS
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 60, -600);

  // UI
  setupDebug();
  addEventListener('resize', onResize);
}

function animate(){
  requestAnimationFrame(animate);

  // anima (o ferma) la foschia
  const t = performance.now() * 0.001;
  _fogShaders.forEach(s => { s.uniforms.fogTime.value = animateFog ? t : 0.0; });

  controls.update();
  renderer.render(scene, camera);
  updateDebug();
}

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

/* ---------------- UI ---------------- */
function setupDebug(){
  debugEl = document.createElement('div');
  debugEl.style.cssText = `
    position:fixed; left:8px; bottom:8px; z-index:9999;
    color:#dfe8f3; background:#0008; padding:6px 8px; border-radius:6px;
    font:12px/1.35 monospace; user-select:none; pointer-events:none; white-space:pre;`;
  document.body.appendChild(debugEl);

  addEventListener('keydown', (e)=>{
    switch(e.key){
      case '[': scene.fog.density = clamp(scene.fog.density - 1e-6, 0, 1); break;
      case ']': scene.fog.density = clamp(scene.fog.density + 1e-6, 0, 1); break;
      case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.2, 3.0); break;
      case '=':
      case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.2, 3.0); break;
      case 'a':
      case 'A': animateFog = !animateFog; break; // toggle animazione
    }
  });
}

function updateDebug(){
  if(!debugEl) return;
  debugEl.textContent =
    `FogExp2+FBM density: ${scene.fog?.density.toExponential(2)}  |  ` +
    `Exposure: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
    `shaders:${_fogShaders.size}  |  anim:${animateFog?'ON':'OFF'}\n` +
    `Keys: [ / ] fog  |  - / = exposure  |  A anim  |  orbit drag`;
}

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }



// // updated con nebbia funziona + step 3 

// // ===== Three.js core & controls (your originals) =====
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// // ===== Forest system (local modules from the skeleton) =====
// import { TreeCatalog } from './assets/TreeCatalog.js';
// import { ForestSystem } from './systems/ForestSystem.js';

// let scene, camera, renderer, controls;
// let ambient, sun;
// let debugEl;
// let animateFog = true;       // [A] per ON/OFF
// const _fogShaders = new Set();

// /* ================== Procedural fog chunks (FBM) ================== */
// const NOISE_GLSL = `
// vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
// vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
// vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
// vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
// float snoise(vec3 v){
//   const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
//   vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
//   vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
//   vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
//   vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
//   float n_=0.142857142857; vec3 ns=n_*D.wyz - D.xzx;
//   vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
//   vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
//   vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
//   vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
//   vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
//   vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
//   p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
//   vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
//   return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
// }
// float FBM(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
// `;

// // 1) world position
// THREE.ShaderChunk.fog_pars_vertex = `
// #ifdef USE_FOG
//   varying vec3 vWorldPosition;
// #endif
// `;
// THREE.ShaderChunk.fog_vertex = `
// #ifdef USE_FOG
//   vWorldPosition = worldPosition.xyz;
// #endif
// `;

// // 2) uniform + noise
// THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
// #ifdef USE_FOG
//   uniform float fogTime;
//   uniform vec3 fogColor;
//   varying vec3 vWorldPosition;
//   #ifdef FOG_EXP2
//     uniform float fogDensity;
//   #else
//     uniform float fogNear;
//     uniform float fogFar;
//   #endif
// #endif
// `;

// // 3) formula (parametri come la repo)
// THREE.ShaderChunk.fog_fragment = `
// #ifdef USE_FOG
//   vec3 fogOrigin = cameraPosition;
//   vec3 dir = normalize(vWorldPosition - fogOrigin);
//   float dist = distance(vWorldPosition, fogOrigin);

//   // scala/velocità come repo
//   vec3 sampleP = vWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
//   float n = FBM(sampleP + FBM(sampleP)); n = n*0.5 + 0.5;

//   dist *= mix(n, 1.0, clamp((dist - 5000.0)/5000.0, 0.0, 1.0));
//   dist *= dist;

//   float y = dir.y; if(abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0)*1e-4;
//   float heightFactor = 0.05;
//   float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) *
//                     (1.0 - exp(-dist * y * fogDensity)) / y;

//   fogFactor = clamp(fogFactor, 0.0, 1.0);
//   gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
// #endif
// `;

// // aggancia uniform fogTime ai materiali
// function attachFogTo(root){
//   root.traverse?.((child)=>{
//     const mat = child.material; if(!mat) return;
//     const mats = Array.isArray(mat) ? mat : [mat];
//     mats.forEach(m=>{
//       m.fog = true;
//       const prev = m.onBeforeCompile;
//       m.onBeforeCompile = (shader)=>{
//         prev?.(shader);
//         shader.uniforms.fogTime = { value: 0.0 };
//         _fogShaders.add(shader);
//       };
//       m.needsUpdate = true;
//     });
//   });
// }

// /* ================== App ================== */
// init();
// animate();

// async function init(){
//   // SCENA
//   scene = new THREE.Scene();
//   scene.background = new THREE.Color(0x87a0c0);

//   // CAMERA (far grande + camera alta)
//   camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 20000);
//   camera.position.set(0, 20, 120);
//   camera.updateProjectionMatrix();

//   // RENDERER
//   renderer = new THREE.WebGLRenderer({
//     canvas: document.getElementById('game-canvas'),
//     antialias: true
//   });
//   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
//   renderer.setSize(innerWidth, innerHeight);
//   renderer.outputColorSpace = THREE.SRGBColorSpace;
//   renderer.toneMapping = THREE.ACESFilmicToneMapping;
//   renderer.toneMappingExposure = 1.05;
//   renderer.shadowMap.enabled = true;

//   // LUCI
//   ambient = new THREE.AmbientLight(0xffffff, 0.35);
//   scene.add(ambient);
//   sun = new THREE.DirectionalLight(0xffe6b3, 1.0);
//   sun.position.set(60, 120, 80);
//   sun.castShadow = true;
//   scene.add(sun);

//   // FOG molto sottile (ordini di grandezza come repo)
//   scene.fog = new THREE.FogExp2(0xDFE9F3, 5e-6);

//   // TERRENO grande
//   const ground = new THREE.Mesh(
//     new THREE.PlaneGeometry(20000, 20000, 2, 2),
//     new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1 })
//   );
//   ground.rotation.x = -Math.PI/2;
//   ground.receiveShadow = true;
//   scene.add(ground);

//   // Collegare la fog procedurale
//   attachFogTo(scene);

//   // CONTROLS
//   controls = new OrbitControls(camera, renderer.domElement);
//   controls.enableDamping = true;
//   controls.dampingFactor = 0.05;
//   controls.target.set(0, 60, -600);

//   // --- FOREST: load OBJ trees & populate ---
//   await setupForest(scene);

//   // UI
//   setupDebug();
//   addEventListener('resize', onResize);
// }

// function animate(){
//   requestAnimationFrame(animate);

//   // anima (o ferma) la foschia
//   const t = performance.now() * 0.001;
//   _fogShaders.forEach(s => { s.uniforms.fogTime.value = animateFog ? t : 0.0; });

//   controls.update();
//   renderer.render(scene, camera);
//   updateDebug();
// }

// function onResize(){
//   camera.aspect = innerWidth/innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(innerWidth, innerHeight);
// }

// /* ================== Forest bootstrap ================== */
// async function setupForest(scene) {
//   const catalog = new TreeCatalog();

//   // Preload your tree types (adjust paths/colors/scales to your models)
//   await catalog.load('pine', '/assets/trees/pine.obj', { defaultColor: 0x2e7d32, scale: 1.0 });
//   // await catalog.load('oak',  '/assets/trees/oak.obj',  { defaultColor: 0x35682d, scale: 1.0 });

//   const forest = new ForestSystem(scene, {
//     seed: 2025,
//     innerRadius: 80,
//     outerRadius: 1800,
//     minSpacing: 8,
//     maxSpacing: 12,
//     count: 800,
//     scale: [0.85, 1.25],
//     clearings: [ { x:0, z:0, r: 100 } ],
//     types: [
//       { name: 'pine', url: '/assets/trees/pine.obj', occluderHeight: 140, occluderRadiusScale: 0.42 },
//       // { name: 'oak',  url: '/assets/trees/oak.obj',  occluderHeight: 160, occluderRadiusScale: 0.45 },
//     ],
//   }, catalog);

//   const result = await forest.generate();
//   console.log('Forest ready:', result);
//   // Keep a reference for later (LOS, cleanup, etc.)
//   window.forest = forest;
// }

// /* ---------------- UI ---------------- */
// function setupDebug(){
//   debugEl = document.createElement('div');
//   debugEl.style.cssText = `
//     position:fixed; left:8px; bottom:8px; z-index:9999;
//     color:#dfe8f3; background:#0008; padding:6px 8px; border-radius:6px;
//     font:12px/1.35 monospace; user-select:none; pointer-events:none; white-space:pre;`;
//   document.body.appendChild(debugEl);

//   addEventListener('keydown', (e)=>{
//     switch(e.key){
//       case '[': scene.fog.density = clamp(scene.fog.density - 1e-6, 0, 1); break;
//       case ']': scene.fog.density = clamp(scene.fog.density + 1e-6, 0, 1); break;
//       case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.2, 3.0); break;
//       case '=':
//       case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.2, 3.0); break;
//       case 'a':
//       case 'A': animateFog = !animateFog; break; // toggle animazione
//     }
//   });
// }

// function updateDebug(){
//   if(!debugEl) return;
//   debugEl.textContent =
//     `FogExp2+FBM density: ${scene.fog?.density.toExponential(2)}  |  ` +
//     `Exposure: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
//     `shaders:${_fogShaders.size}  |  anim:${animateFog?'ON':'OFF'}\n` +
//     `Keys: [ / ] fog  |  - / = exposure  |  A anim  |  orbit drag`;
// }

// function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }


// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
// import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
// import { MTLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js';
// import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

// const canvas   = document.getElementById('game-canvas');
// const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
// renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// renderer.setSize(innerWidth, innerHeight);
// renderer.outputColorSpace = THREE.SRGBColorSpace;
// renderer.toneMapping = THREE.ACESFilmicToneMapping;
// renderer.toneMappingExposure = 1.1;

// const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x1e1f24);

// const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.01, 1000);
// camera.position.set(0, 1.5, 3);

// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;

// // luci chiare (mantienile!)
// scene.add(new THREE.AmbientLight(0xffffff, 0.9));
// scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3038, 0.6));
// const dir = new THREE.DirectionalLight(0xffffff, 0.8); dir.position.set(2,3,2); scene.add(dir);

// scene.add(new THREE.GridHelper(10, 10, 0x444444, 0x333333));
// scene.add(new THREE.AxesHelper(1));

// let model, savedMaterials = new Map();

// // === carica qualsiasi formato (OBJ/MTL o GLB) ===
// async function loadAny(url, mtlUrl) {
//   const lower = url.toLowerCase();
//   let root;
//   try {
//     if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
//       const gltf = await new GLTFLoader().loadAsync(url);
//       root = gltf.scene;
//     } else {
//       const loader = new OBJLoader();
//       if (mtlUrl) {
//         const mtl = await new MTLLoader().loadAsync(mtlUrl);
//         mtl.preload(); loader.setMaterials(mtl);
//       }
//       root = await loader.loadAsync(url);
//     }
//   } catch (e) {
//     console.error('Load error:', e);
//     return;
//   }

//   // assicurati che i materiali si vedano
//   root.traverse(o => {
//     if (o.isMesh) {
//       o.castShadow = o.receiveShadow = true;
//       if (o.material) o.material.side = THREE.DoubleSide;
//     }
//   });

//   // centra + normalizza scala ~2 unità
//   const box = new THREE.Box3().setFromObject(root);
//   const size = box.getSize(new THREE.Vector3());
//   const center = box.getCenter(new THREE.Vector3());
//   root.position.sub(center);
//   const maxDim = Math.max(size.x, size.y, size.z) || 1;
//   const TARGET = 2.0;
//   const s = TARGET / maxDim;
//   root.scale.setScalar(s);

//   scene.add(root);
//   fitToView(root);
//   model = root;
//   console.log('Model loaded:', url, 'size:', size, 'scale:', s);
// }

// // inquadra il modello
// function fitToView(object) {
//   const box = new THREE.Box3().setFromObject(object);
//   const size = box.getSize(new THREE.Vector3());
//   const maxDim = Math.max(size.x, size.y, size.z) || 1;
//   const dist = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
//   camera.position.set(0, maxDim * 0.3, dist * 1.25);
//   controls.target.set(0, maxDim * 0.15, 0);
//   controls.update();
// }

// // toggle UNLIT (sempre visibile)
// function setUnlit(on) {
//   if (!model) return;
//   model.traverse(o => {
//     if (!o.isMesh) return;
//     if (on) {
//       if (!savedMaterials.has(o.uuid)) savedMaterials.set(o.uuid, o.material);
//       const src = savedMaterials.get(o.uuid);
//       o.material = new THREE.MeshBasicMaterial({
//         map: src?.map || null,
//         color: (src?.color && src.color.isColor) ? src.color.clone() : new THREE.Color(0xffffff),
//         side: THREE.DoubleSide
//       });
//     } else {
//       if (savedMaterials.has(o.uuid)) o.material = savedMaterials.get(o.uuid);
//     }
//   });
// }

// // ---- scegli cosa caricare ----
// // OBJ + MTL
// loadAny('/assets/textures/trees/again_pine.obj', '/assets/textures/trees/again_pine.mtl');


// addEventListener('keydown', (e) => {
//   if (e.key.toLowerCase() === 'u') { // toggle unlit
//     const unlit = !model?.userData?.unlit;
//     setUnlit(unlit);
//     if (model) model.userData.unlit = unlit;
//     console.log('Unlit:', unlit);
//   }
// });

// addEventListener('resize', () => {
//   camera.aspect = innerWidth / innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(innerWidth, innerHeight);
// });

// (function animate(){
//   requestAnimationFrame(animate);
//   controls.update();
//   renderer.render(scene, camera);
// })();


// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
// import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
// import { MTLLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/MTLLoader.js';
// import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

// const canvas   = document.getElementById('game-canvas');
// const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
// renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// renderer.setSize(innerWidth, innerHeight);
// renderer.outputColorSpace = THREE.SRGBColorSpace;
// renderer.toneMapping = THREE.ACESFilmicToneMapping;
// renderer.toneMappingExposure = 1.0;

// const scene = new THREE.Scene();
// scene.background = new THREE.Color(0x1e2126);

// const camera = new THREE.PerspectiveCamera(50, innerWidth/innerHeight, 0.01, 1000);
// camera.position.set(0, 1.5, 3);

// const controls = new OrbitControls(camera, renderer.domElement);
// controls.enableDamping = true;

// /* luci più “soft” da cartoon */
// scene.add(new THREE.AmbientLight(0xffffff, 0.50));
// scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a3038, 0.45)); // cielo freddo, suolo scuro
// const dir = new THREE.DirectionalLight(0xffffff, 0.65);
// dir.position.set(2, 3, 2);
// scene.add(dir);

// scene.add(new THREE.GridHelper(10, 10, 0x444444, 0x333333));
// scene.add(new THREE.AxesHelper(1));

// let model;

// /* palette “Animal Crossing” (desaturata e un po’ più scura) */
// let EMISSIVE_STRENGTH = 0.08; // quasi nullo
// const LEAF_COLOR  = new THREE.Color('#7FA36B'); // verde foglia soft
// const TRUNK_COLOR = new THREE.Color('#B28C72'); // legno caldo soft
// const OTHER_COLOR = new THREE.Color('#BFBFBF');

// function remapToACStyle(root) {
//   const TRUNK_NAMES  = ['材质'];      // dal tuo .mtl: tronco
//   const LEAVES_NAMES = ['材质.001'];  // dal tuo .mtl: chioma

//   root.traverse(o => {
//     if (!o.isMesh) return;

//     const mats = Array.isArray(o.material) ? o.material : [o.material];
//     const remapped = mats.map(m => {
//       const n = String(m?.name || '').normalize('NFC');
//       const isTrunk  = TRUNK_NAMES.includes(n);
//       const isLeaf   = LEAVES_NAMES.includes(n);
//       const baseCol  = isLeaf ? LEAF_COLOR : (isTrunk ? TRUNK_COLOR : OTHER_COLOR);

//       const mat = new THREE.MeshStandardMaterial({
//         color: baseCol.clone(),
//         roughness: 0.95,
//         metalness: 0.0,
//         flatShading: true,
//         side: THREE.DoubleSide
//       });
//       mat.emissive.copy(baseCol).multiplyScalar(0.5);
//       mat.emissiveIntensity = EMISSIVE_STRENGTH;
//       return mat;
//     });

//     o.material = (remapped.length === 1) ? remapped[0] : remapped;
//   });
// }

// /* loader */
// async function loadAny(url, mtlUrl) {
//   const lower = url.toLowerCase();
//   let root;
//   if (lower.endsWith('.glb') || lower.endsWith('.gltf')) {
//     const gltf = await new GLTFLoader().loadAsync(url);
//     root = gltf.scene;
//   } else {
//     const loader = new OBJLoader();
//     if (mtlUrl) {
//       const mtl = await new MTLLoader().loadAsync(mtlUrl);
//       mtl.preload(); loader.setMaterials(mtl);
//     }
//     root = await loader.loadAsync(url);
//   }

//   // centra + normalizza scala ~2u
//   const box = new THREE.Box3().setFromObject(root);
//   const size = box.getSize(new THREE.Vector3());
//   const center = box.getCenter(new THREE.Vector3());
//   root.position.sub(center);
//   const maxDim = Math.max(size.x, size.y, size.z) || 1;
//   root.scale.setScalar(2.0 / maxDim);

//   remapToACStyle(root);

//   scene.add(root);
//   fitToView(root);
//   model = root;
// }

// function fitToView(object) {
//   const box = new THREE.Box3().setFromObject(object);
//   const size = box.getSize(new THREE.Vector3());
//   const maxDim = Math.max(size.x, size.y, size.z) || 1;
//   const dist = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
//   camera.position.set(0, maxDim * 0.3, dist * 1.25);
//   controls.target.set(0, maxDim * 0.15, 0);
//   controls.update();
// }

// /* carica il tuo OBJ */
// loadAny('/assets/textures/trees/again_pine.obj', '/assets/textures/trees/again_pine.mtl');

// /* tweak veloce da tastiera: emissive +/- */
// addEventListener('keydown', (e) => {
//   if (e.key === '[' || e.key === ']') {
//     EMISSIVE_STRENGTH = Math.max(0, Math.min(0.4, EMISSIVE_STRENGTH + (e.key === ']' ? +0.02 : -0.02)));
//     if (model) model.traverse(o => {
//       if (o.isMesh && o.material && 'emissiveIntensity' in o.material) {
//         o.material.emissiveIntensity = EMISSIVE_STRENGTH;
//       }
//     });
//     console.log('emissiveIntensity:', EMISSIVE_STRENGTH.toFixed(2));
//   }
// });

// addEventListener('resize', () => {
//   camera.aspect = innerWidth / innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(innerWidth, innerHeight);
// });

// (function animate(){
//   requestAnimationFrame(animate);
//   controls.update();
//   renderer.render(scene, camera);
// })();

