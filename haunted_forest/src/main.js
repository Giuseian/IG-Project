import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// Systems & UI
import { TreeCatalog } from './assets/TreeCatalog.js';
import { ForestSystem } from './systems/ForestSystem.js';
import { initHUD } from './ui/hud.js';
import { GhostSpawner } from './systems/GhostSpawner.js';
import { WASDController } from './systems/WASDController.js';
import { BeamSystem } from './systems/BeamSystem.js';
import { SanctuarySystem } from './systems/SanctuarySystem.js';
import { WispSystem } from './systems/WispSystem.js';   // (wisps)

/* ---------- REGOLE COLORI PINO ---------- */
const PINE_RULES = [
  { name: 'leaves', matchMat:['材质.001'], matchObj:['leaves','leaf','ico','pine'],
    color:'#7FA36B', roughness:0.95, metalness:0.0, emissiveScale:0.5, emissiveIntensity:0.08, flatShading:true },
  { name: 'trunk',  matchMat:['材质'], matchObj:['trunk','cylinder'],
    color:'#B28C72', roughness:0.95, metalness:0.0, emissiveScale:0.5, emissiveIntensity:0.08, flatShading:true },
  { name: 'other',  color:'#BFBFBF', roughness:0.95, metalness:0.0, emissiveScale:0.4, emissiveIntensity:0.04, flatShading:true }
];
const PINE_OPTIONS = { mtlUrl:'/assets/models/trees/pine.mtl', keepSourceMaps:false, scale:18, rules:PINE_RULES };

/* ================== FOG: parametri globali (ESTESO) ================== */
const INIT_FOG_DENSITY   = 4.0e-4;
const FOG_DENSITY_MULT   = 1.5;
const FOG_TIME_SPEED     = 0.12;
const FOG_NOISE_STRENGTH = 0.35;
const FOG_NEAR_BOOST     = 0.25;

// Height 
const FOG_HEIGHT_FACTOR = 0.16; // 0.14 -> 0.16/0.18 per più “foschia a terra”


// Lateral haze
const FOG_LATERAL_BOOST  = 0.08;   // intensità della foschia laterale
const FOG_LATERAL_RADIUS = 180.0;  // da che distanza orizzontale inizia a vedersi
const FOG_LATERAL_HEIGHT = 22.0;   // spessore verticale dello strato (m)

// Gap map (foschia più piena negli spazi tra gli alberi)
const FOG_GAPMAP_SIZE  = 256;      // 128 o 256 vanno bene
const FOG_GAP_MAXDIST  = 120;      // distanza oltre la quale consideriamo “spazio aperto”
const FOG_GAP_BOOST    = 0.25;     // quanto aumentare la fog nei vuoti (0..~1.5)

// Baseline e compensazioni dinamiche
const FOG_D0 = INIT_FOG_DENSITY * FOG_DENSITY_MULT; // baseline iniziale
let _nearMul = 1.0;   // moltiplicatore per fog vicino a terra
let _latMul  = 1.0;   // moltiplicatore per la lateral haze
let _fogGapTex = null;         // DataTexture (R8) 0..1 = “quanto è vuoto”
let _fogMapST  = null;         // vec4(scaleX, scaleY, offsetX, offsetY)


/* === Baseline & run-state (una sola fonte di verità) === */
const BASE = { captured:false, maxAlive:7, spawnInterval:1.2 };
let _debugCapDelta = 0;    // +cap fatto via KeyP (max +2)
let _won = false;          // hai completato tutti i totem?
let _sanctuaryItems0 = null; // snapshot degli spot per ricreare i totem al reset


/* Collezione degli shader patchati per aggiornare fog uniforms */
const _fogShaders = new Set();

/* ---------------- Fog FBM (SAFE) + controlli uniform ---------------- */
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
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a1.xy,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,p2),dot(p3,p3)));
}
float FBM(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
`;

// === Patch chunks
THREE.ShaderChunk.fog_pars_vertex = `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif
`;
THREE.ShaderChunk.fog_vertex = `
#ifdef USE_FOG
  vec3 posW = (modelMatrix * vec4( transformed, 1.0 )).xyz;
  vFogWorldPos = posW;
#endif
`;

THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
#ifdef USE_FOG
  uniform float fogTime;
  uniform float fogTimeSpeed;
  uniform float fogNoise;
  uniform float fogNearBoost;

  uniform float fogHeightFactor; 

  uniform sampler2D fogGapMap;
  uniform vec4  fogMapST;
  uniform float fogGapBoost;

  uniform float fogLateralBoost;
  uniform float fogLateralRadius;
  uniform float fogLateralHeight;

  uniform float fogNearMul;
  uniform float fogLateralMul;

  uniform vec3 fogColor;
  varying vec3 vFogWorldPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif
`;

THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  vec3 fogOrigin = cameraPosition;
  vec3 dir  = normalize(vFogWorldPos - fogOrigin);
  float dist = distance(vFogWorldPos, fogOrigin);

  // Drift diagonale XZ (vento)
  vec2 wind = normalize(vec2(0.7, 0.3));
  vec3 sampleP = vFogWorldPos * 0.00025
              + vec3(wind.x, 0.0, wind.y) * (fogTime * fogTimeSpeed * 0.025);

  float n = FBM(sampleP + FBM(sampleP)); 
  n = mix(1.0, n*0.5 + 0.5, clamp(fogNoise, 0.0, 1.0));

  // base: exp2 + height
  float dcurve   = pow(dist, 1.2);
  float baseExp  = 1.0 - exp(-dcurve * fogDensity * (0.85 + fogNearBoost));
  float y = dir.y; if (abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0) * 1e-4;
  // float heightFactor = 0.14;
  //float heightFog = heightFactor * exp(-fogOrigin.y * fogDensity) *
  //                  (1.0 - exp(-dcurve * y * fogDensity)) / y;

  float heightFog = fogHeightFactor * exp(-fogOrigin.y * fogDensity) *
                  (1.0 - exp(-dcurve * y * fogDensity)) / y;


  float fogFactor = clamp( mix(heightFog, heightFog + baseExp*0.85, 0.8) * n, 0.0, 1.0 );

  // GAP MAP: aggiunta “gentile” negli spazi aperti
  vec2  uv  = vFogWorldPos.xz * fogMapST.xy + fogMapST.zw;
  float gap = texture2D(fogGapMap, uv).r;
  float gapAdd = fogGapBoost * gap * (1.0 - fogFactor);
  fogFactor = clamp(fogFactor + gapAdd, 0.0, 1.0);

  // LATERAL HAZE: foschia radente all’orizzonte
  float distXZ       = length(vFogWorldPos.xz - fogOrigin.xz);
  float groundFalloff= exp( -max(0.0, vFogWorldPos.y) / max(1.0, fogLateralHeight) );
  float sideWeight   = smoothstep(32.0, max(32.0, fogLateralRadius), distXZ);
  float lateralHaze  = fogLateralBoost * groundFalloff * sideWeight;
  lateralHaze *= fogLateralMul;

  // Soft-union per riempire senza saturare
  fogFactor = 1.0 - (1.0 - fogFactor) * (1.0 - lateralHaze);
  fogFactor = clamp(fogFactor, 0.0, 1.0);

  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
`;

/* --- uniforms & patcher --- */
function attachFogTo(root){
  root.traverse?.(child=>{
    const mat = child.material; if(!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    mats.forEach(m=>{
      m.fog = true;
      const prev = m.onBeforeCompile;
      m.onBeforeCompile = (shader)=>{
        prev?.(shader);
        shader.uniforms.fogTime       = { value: 0.0 };
        shader.uniforms.fogTimeSpeed  = { value: FOG_TIME_SPEED };
        shader.uniforms.fogNoise      = { value: FOG_NOISE_STRENGTH };
        shader.uniforms.fogNearBoost  = { value: FOG_NEAR_BOOST };
        shader.uniforms.fogHeightFactor = { value: FOG_HEIGHT_FACTOR };

        // Lateral haze
        shader.uniforms.fogLateralBoost  = { value: FOG_LATERAL_BOOST };
        shader.uniforms.fogLateralRadius = { value: FOG_LATERAL_RADIUS };
        shader.uniforms.fogLateralHeight = { value: FOG_LATERAL_HEIGHT };
        shader.uniforms.fogNearMul       = { value: 1.0 };
        shader.uniforms.fogLateralMul    = { value: 1.0 };

        // Gap map placeholders
        if (!_fogGapTex) {
          const placeholder = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
          placeholder.needsUpdate = true;
          _fogGapTex = placeholder;
        }
        if (!_fogMapST) _fogMapST = new THREE.Vector4(0,0,0.5,0.5);

        shader.uniforms.fogGapMap   = { value: _fogGapTex };
        shader.uniforms.fogMapST    = { value: _fogMapST };
        shader.uniforms.fogGapBoost = { value: FOG_GAP_BOOST };

        _fogShaders.add(shader);
      };
      m.needsUpdate = true;
    });
  });
}

/* ---- Auto-compensazione near/lateral quando cambi densità ---- */
function recomputeFogComp(){
  const d = scene?.fog?.density ?? FOG_D0;
  const r = THREE.MathUtils.clamp(FOG_D0 / d, 0.6, 1.6);
  _nearMul = Math.min(1.10, Math.pow(r, 0.65));  // max +10%
  _latMul  = Math.min(1.10, Math.pow(r, 0.55));  // max +10%

  _fogShaders.forEach(s=>{
    if (s.uniforms.fogNearBoost)    s.uniforms.fogNearBoost.value    = FOG_NEAR_BOOST    * _nearMul;
    if (s.uniforms.fogLateralBoost) s.uniforms.fogLateralBoost.value = FOG_LATERAL_BOOST * _latMul;
  });
}

/* -------- Sky Fog Dome (riempie i “buchi” tra gli alberi) -------- */
let _skyFogDome = null;

/* ---------------- App & Game State ---------------- */
let scene, camera, renderer;
let animateFog = true;
let debugEl;

// Flags HUD/Debug
let _showDebug = false;
let _isNight   = false;

// Luci (mutabili per day/night)
let sun, ambient;

const player = { health:1.0, heat:0.0, score:0, beamOn:false, overheated:false };
let _scoreFloat = 0;

let hud;
let beam;
let beamSystem;

// Systems
let forest;
let spawner;
let playerCtl;
let sanctuaries;
let wisps;

// griglia collisione camera-tronchi
let _occGrid = null;

// Sanctuary
let _hudShowDoneUntil = 0;

// input schema: RMB = AIM, F = power toggle
let _aimHeld = false;
let _fireToggle = false;
let _wispsEnabled = true;
const ENABLE_TOTEM_EDGE = false;
let _showTotemEdge = false;

// reticolo
let _reticleEl = null;

// game freeze (GO/Win)
let _frozen = false;

let _tPrev = performance.now() * 0.001;

// Pause Game 
let _isPaused = false;
let _pausedFogWasAnimating = false;

// === Combat tuning ===
const ATTACK_RADIUS = 3.2;   // m (XZ)
const DPS_PER_GHOST = 0.12;  // health(0..1)/sec

/* -------- utility -------- */
function createSkyFogDome(colorHex = 0xDFE9F3, radius = 18000){
  const g = new THREE.SphereGeometry(radius, 32, 24);
  g.scale(-1, 1, 1);
  const m = new THREE.MeshBasicMaterial({ color: colorHex, fog: true, side: THREE.BackSide });
  const mesh = new THREE.Mesh(g, m);
  mesh.name = 'SkyFogDome';
  mesh.frustumCulled = false;
  return mesh;
}

/* ---- Day/Night preset ---- */
const DN_FADE_SECS   = 2.5;   // durata transizione day<->night
let _dnLerp   = 0;            // 0=giorno, 1=notte (blend corrente)
let _dnTarget = 0;            // 0/1 verso cui andiamo

const HALF_CYCLE_SECS = 45;   // ogni quanti secondi invertire (se auto)
let _cycleTimer = 0;
let _autoCycle  = true;      // attivalo con KeyN (vedi sotto)

function applyDayNight(night){
  _dnTarget = night ? 1 : 0;
}

function updateDayNight(dt){
  if (!sun || !ambient || !scene || !_skyFogDome || !renderer) return;

  if (_dnLerp !== _dnTarget){
    const step = dt / DN_FADE_SECS;
    _dnLerp = (_dnTarget > _dnLerp)
      ? Math.min(1, _dnLerp + step)
      : Math.max(0, _dnLerp - step);
  }

  const k0 = _dnLerp;                 
  const k  = k0*k0*(3 - 2*k0);

  const COL_DAY   = new THREE.Color(0xDFE9F3);
  const COL_NIGHT = new THREE.Color(0x0a1220);
  const fogCol    = COL_DAY.clone().lerp(COL_NIGHT, k);

  scene.fog.color.copy(fogCol);
  const m = _skyFogDome.material;
  m.color.copy(fogCol);
  m.depthWrite = false;
  m.depthTest  = false;
  _skyFogDome.renderOrder = -1000;

  ambient.intensity = THREE.MathUtils.lerp(0.35, 0.18, k);
  sun.intensity     = THREE.MathUtils.lerp(1.00, 0.35, k);
  sun.color.set(0xffe6b3).lerp(new THREE.Color(0x9fbfff), k);

  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.00, 0.90, k);
  renderer.setClearColor(fogCol.getHex(), 1);

  const elevDay   = THREE.MathUtils.degToRad(55);
  const elevNight = THREE.MathUtils.degToRad(-20);
  const elev = THREE.MathUtils.lerp(elevDay, elevNight, k);
  const azim = THREE.MathUtils.degToRad(45);
  const R = 300;
  const y  = Math.sin(elev) * R;
  const xz = Math.cos(elev) * R;
  const x  = Math.cos(azim) * xz;
  const z  = Math.sin(azim) * xz;
  sun.position.set(x, y, z);

  const nowNight = (k >= 0.5);
  if (nowNight !== _isNight){
    _isNight = nowNight;
    hud?.setDayNightIcon?.(_isNight);
  }

  if (_autoCycle){
    _cycleTimer += dt;
    if (_cycleTimer >= HALF_CYCLE_SECS){
      _cycleTimer = 0;
      applyDayNight(_dnTarget < 0.5 ? true : false);
    }
  }
}

// init();
// animate();
init().then(()=>{
  // Pre-warm: compila gli shader con le patch già attaccate
  renderer.compile(scene, camera);
  animate();
});




/* ----------------- PRNG deterministico (mulberry32) ----------------- */
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | t);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------- griglia per occluders (riusiamo anche per la camera) ------- */
function buildOccluderGrid(occs, cellSize = 100){
  const grid = new Map();
  const put = (i,j,idx)=>{
    const k = i+'|'+j;
    let arr = grid.get(k);
    if(!arr){ arr = []; grid.set(k, arr); }
    arr.push(idx);
  };
  for (let i=0;i<occs.length;i++){
    const c = occs[i];
    const ci = Math.floor(c.pos.x / cellSize);
    const cj = Math.floor(c.pos.z / cellSize);
    put(ci, cj, i);
  }
  return { grid, cellSize, occs };
}

function neighborsFor(x,z, grid){
  const cell = grid.cellSize;
  const ci = Math.floor(x / cell);
  const cj = Math.floor(z / cell);
  const neigh = [
    [0,0], [1,0], [-1,0], [0,1], [0,-1],
    [1,1], [1,-1], [-1,1], [-1,-1]
  ];
  let ids = [];
  for (const [di,dj] of neigh){
    const k = (ci+di)+'|'+(cj+dj);
    const arr = grid.grid.get(k);
    if (arr) ids = ids.concat(arr);
  }
  return ids;
}

/* ---- distanza dal tronco più vicino (usando griglia) ---- */
function minDistToOccluders(x, z, occGrid){
  let minD2 = Infinity;
  const ids = neighborsFor(x, z, occGrid);
  for (const idx of ids){
    const c = occGrid.occs[idx]; // {pos, radius}
    const dx = x - c.pos.x;
    const dz = z - c.pos.z;
    const d2 = dx*dx + dz*dz;
    if (d2 < minD2) minD2 = d2;
  }
  return Math.sqrt(minD2);
}

/* ---- Gap map dalla griglia di occluder ---- */
function buildFogGapMapFromOccGrid(occGrid, worldHalf = 6000, size = FOG_GAPMAP_SIZE){
  const w = size, h = size;
  const data = new Uint8Array(w*h);
  let k = 0;

  for (let j=0; j<h; j++){
    const z = (j/(h-1))*2*worldHalf - worldHalf;
    for (let i=0; i<w; i++){
      const x = (i/(w-1))*2*worldHalf - worldHalf;
      const d = minDistToOccluders(x, z, occGrid);
      const a = FOG_GAP_MAXDIST*0.5, b = FOG_GAP_MAXDIST;
      const t = Math.max(0, Math.min(1, (d - a)/(b - a)));
      data[k++] = Math.round(t*255);
    }
  }

  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  _fogGapTex = tex;
  _fogMapST  = new THREE.Vector4( 1/(2*worldHalf), 1/(2*worldHalf), 0.5, 0.5 );

  _fogShaders.forEach(s=>{
    if (s.uniforms.fogGapMap)   s.uniforms.fogGapMap.value   = _fogGapTex;
    if (s.uniforms.fogMapST)    s.uniforms.fogMapST.value    = _fogMapST;
    if (s.uniforms.fogGapBoost) s.uniforms.fogGapBoost.value = FOG_GAP_BOOST;
  });
}

/* ----------------- OVERLAYS (GO/Win) ----------------- */
function ensureOverlayCSS(){
  if (document.getElementById('overlay-style')) return;
  const s = document.createElement('style');
  s.id='overlay-style';
  s.textContent = `
    .overlay {
      position:fixed; inset:0; z-index:10001; display:flex; align-items:center; justify-content:center;
      background: rgba(6,12,18,.6); backdrop-filter: blur(6px);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
      color:#e8f1ff;
    }
    .overlay-card {
      background:#0f172aee; border-radius:16px; box-shadow:0 20px 50px #000c, inset 0 1px 0 #fff1;
      padding:28px 32px; min-width:320px; text-align:center;
    }
    .overlay-card h1{ margin:0 0 8px; font-size:28px; }
    .overlay-card p{ margin:0 0 16px; color:#a8b4c4; }
    .overlay-card .btns{ display:flex; gap:10px; justify-content:center; }
    .overlay-card button{
      padding:10px 16px; border:0; border-radius:12px; cursor:pointer; font-weight:700; letter-spacing:.2px;
      background:#18c08f; color:#06281f; box-shadow:0 4px 12px #0006;
    }
    .overlay-card button.secondary{ background:#334155; color:#cbd5e1; }
  `;
  document.head.appendChild(s);
}

let _overlayEl = null;
function hideOverlay(){
  if (_overlayEl && _overlayEl.parentNode) _overlayEl.parentNode.removeChild(_overlayEl);
  _overlayEl = null;
}

function showOverlay({ title, text, primary, secondary }){
  ensureOverlayCSS();
  hideOverlay();
  if (document.pointerLockElement) document.exitPointerLock?.();
  const root = document.createElement('div');
  root.className = 'overlay';
  root.innerHTML = `
    <div class="overlay-card">
      <h1>${title}</h1>
      <p>${text}</p>
      <div class="btns">
        <button id="ovl-primary">${primary?.label ?? 'OK'}</button>
        ${secondary ? `<button id="ovl-secondary" class="secondary">${secondary.label}</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(root);
  _overlayEl = root;
  const p = root.querySelector('#ovl-primary');
  const s = root.querySelector('#ovl-secondary');
  if (p && primary?.onClick) p.onclick = primary.onClick;
  if (s && secondary?.onClick) s.onclick = secondary.onClick;
}

function showGameOverOverlay(){
  _frozen = true;
  showOverlay({
    title: 'You Fell',
    text:  'The ghosts overwhelmed you.',
    primary:  { label:'Retry',  onClick: ()=>{ resetGame(); } }
  });
}

function pauseGame(){
  if (_isPaused || _frozen) return;
  _isPaused = true;

  _pausedFogWasAnimating = animateFog;
  animateFog = false;
  spawner?.pauseAggro?.(true);

  _frozen = true;
  showOverlay({
    title: 'Paused',
    text:  'Game paused.',
    primary:  { label:'Resume', onClick: resumeGame },
    secondary:{ label:'Retry',  onClick: resetGame }
  });
}

function resumeGame(){
  // Se sei arrivatə al win, "Resume" equivale a iniziare un nuovo run
  if (_won) { resetGame(); return; }

  if (!_isPaused) return;
  hideOverlay();
  _isPaused = false;
  _frozen = false;

  animateFog = true;
  spawner?.pauseAggro?.(false);

  _tPrev = performance.now() * 0.001;
  renderer?.domElement?.requestPointerLock?.();
}


function showWinOverlay(){
  _won = true;                    // <- segnalo che hai vinto
  _frozen = true;
  animateFog = false;
  spawner?.pauseAggro?.(true);    // niente più spawn mentre sei nel win overlay
  showOverlay({
    title: 'All Totems Purified!',
    text:  'The forest grows quiet. Play again?',
    primary:  { label:'Replay', onClick: ()=>{ resetGame(); } }
  });
}


window.showWinOverlay = showWinOverlay;


async function init(){
  scene = new THREE.Scene();
  scene.background = null; // DOME

  scene.fog = new THREE.FogExp2(0xDFE9F3, INIT_FOG_DENSITY * FOG_DENSITY_MULT);
  recomputeFogComp();

  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 20000);
  camera.position.set(0, 20, 120);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('game-canvas'),
    antialias: true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.00;
  renderer.shadowMap.enabled = true;

  // Sky Fog Dome
  _skyFogDome = createSkyFogDome(scene.fog.color.getHex(), 18000);
  scene.add(_skyFogDome);

  // Luci
  ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);

  sun = new THREE.DirectionalLight(0xffe6b3, 1.0);
  sun.position.set(60, 120, 80);
  sun.castShadow = true;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20000, 20000),
    new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1 })
  );
  ground.rotation.x = -Math.PI/2;
  ground.receiveShadow = true;
  scene.add(ground);

  // === PRE-RENDER “ANTI-NERO” ===
  // Applica la palette giorno base e dipingi subito un frame placeholder,
  // così l’utente vede già il cielo nebbioso mentre il resto carica.
  applyDayNight(false);
  updateDayNight(0);
  renderer.setClearColor(scene.fog.color.getHex(), 1);
  renderer.clear(true, true, true);
  renderer.render(scene, camera);

  // Da qui in poi può esserci attesa (await): nessun buco nero sul canvas.
  attachFogTo(_skyFogDome);
  attachFogTo(scene);

  // --- HUD ---
  hud = initHUD();
  hud.setDayNightIcon(_isNight);
  hud.setControlsHandlers({
    onConeMinus: ()=> beamSystem?.decHalfAngle?.(1),
    onConePlus:  ()=> beamSystem?.incHalfAngle?.(1),
    onBeamToggle:()=>{ _fireToggle = !_fireToggle; },
    onDayNightToggle:()=> { applyDayNight(!_isNight); },
    onDebugToggle:()=>{ _showDebug = !_showDebug; if (debugEl) debugEl.style.display = _showDebug ? 'block' : 'none'; }
  });

  // Reticolo
  _reticleEl = document.createElement('div');
  _reticleEl.id = 'reticle';
  _reticleEl.style.cssText = `
    position:fixed; left:-9999px; top:-9999px; z-index:9999;
    width:10px; height:10px; border:2px solid #cfe8ff; border-radius:50%;
    box-shadow:0 0 6px #b4d9ff; pointer-events:none; opacity:0.9; transform:translate(-50%,-50%);
  `;
  document.body.appendChild(_reticleEl);

  // Spotlight (solo estetica)
  const DEFAULT_BEAM_COLOR = 0xcff2ff;
  beam = new THREE.SpotLight(DEFAULT_BEAM_COLOR, 1.2, 60, THREE.MathUtils.degToRad(12), 0.35, 1.0);
  beam.visible = false;
  camera.add(beam);
  scene.add(camera);
  const beamTargetObj = new THREE.Object3D();
  scene.add(beamTargetObj);
  beam.target = beamTargetObj;

  // ===== INPUT =====
  addEventListener('mousedown', (e)=>{
    if (e.button === 2) { _aimHeld = true; beamSystem?.setAiming(true); }
  });
  addEventListener('mouseup', (e)=>{
    if (e.button === 2) { _aimHeld = false; beamSystem?.setAiming(false); }
  });
  renderer.domElement.addEventListener('contextmenu', (e)=> e.preventDefault());

  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => {
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  });
  addEventListener('mousemove', (e)=>{
    if (document.pointerLockElement === canvas) {
      playerCtl?.onMouseDelta(e.movementX, e.movementY);
      if (_aimHeld) beamSystem?.onAimMouseDelta(e.movementX, e.movementY);
    }
  });

  addEventListener('keydown',   (e)=>{
    const code = e.code;
    if (code === 'KeyF') { _fireToggle = !_fireToggle; e.preventDefault(); }
    if (code === 'KeyH'){ _showDebug = !_showDebug; if (debugEl) debugEl.style.display = _showDebug ? 'block' : 'none'; e.preventDefault(); }
    if (code === 'F3'){   _showDebug = !_showDebug; if (debugEl) debugEl.style.display = _showDebug ? 'block' : 'none'; e.preventDefault(); }

    if (code === 'KeyP') {
      if (!spawner?.params) return;

      const info     = spawner?.debugInfo?.();
      const alive    = info?.alive ?? (spawner?.active?.length ?? 0);
      const cap      = spawner.params.maxAlive ?? BASE.maxAlive;
      const poolMax  = spawner.params.poolSize ?? Infinity;

      // SE e SOLO SE sei al cap, aumenta temporaneamente il cap per debug
      if (alive >= cap) {
        _debugCapDelta = Math.min(_debugCapDelta + 1, 2); // (limita il +cap a +2)
        spawner.params.maxAlive = Math.min(poolMax, BASE.maxAlive + _debugCapDelta);
        console.log(`[P] cap pieno ${alive}/${cap} → cap temp = ${spawner.params.maxAlive} (base ${BASE.maxAlive}, delta ${_debugCapDelta})`);
      } else {
        console.log(`[P] cap NON pieno ${alive}/${cap} → niente aumento cap`);
      }

      // In ogni caso, prova a spawnare ora
      spawner?.forceSpawnNow?.();
      e.preventDefault();
    }



    if (code === 'KeyV') spawner?.toggleAntiPopIn?.();
    if (code === 'KeyC') spawner?.cleanseAll?.();
    if (code === 'KeyX') spawner?.cleanseNearest?.(camera.position);

    // Cono del beam
    if (!e.ctrlKey && (
          e.code === 'Comma' || e.key === ',' ||
          e.code === 'Minus' || e.key === '-' ||
          e.code === 'NumpadSubtract'
        )) { beamSystem?.decHalfAngle(1); e.preventDefault(); }

    if (!e.ctrlKey && (
          e.code === 'Period' || e.key === '.' ||
          e.code === 'Equal'  || e.key === '+' ||
          e.code === 'NumpadAdd'
        )) { beamSystem?.incHalfAngle(1); e.preventDefault(); }

    // Raggio del beam
    if (code === 'Digit9') { beamSystem?.decRange(10); e.preventDefault(); }
    if (code === 'Digit0') { beamSystem?.incRange(10); e.preventDefault(); }

    if (code === 'KeyQ') { const snap = e.shiftKey ? Math.PI : Math.PI/4; playerCtl?.addYaw(+snap); e.preventDefault(); }
    if (code === 'KeyE') { playerCtl?.addYaw(-Math.PI/4); e.preventDefault(); }

    if (code === 'KeyG' && ENABLE_TOTEM_EDGE) {
      _showTotemEdge = !_showTotemEdge;
      hud?.setTotemIndicator?.(null);
      e.preventDefault();
    }

    if (code === 'F9' || code === 'KeyB'){
      if (_isPaused) resumeGame(); else if (!_frozen) pauseGame();
      e.preventDefault();
    }

    // Fog density [ ] (Shift = step maggiore)
    if (e.key === '[' || e.key === '{') {
      const k = e.shiftKey ? 1/1.25 : 1/1.12;
      scene.fog.density = Math.max(0, scene.fog.density * k);
      recomputeFogComp();
      e.preventDefault();
    }
    if (e.key === ']' || e.key === '}') {
      const k = e.shiftKey ? 1.25 : 1.12;
      scene.fog.density = Math.min(1, scene.fog.density * k);
      recomputeFogComp();
      e.preventDefault();
    }

    // Toggle animazione fog
    if (code === 'KeyK'){ animateFog = !animateFog; console.log('[Fog] animate:', animateFog ? 'ON' : 'OFF'); e.preventDefault(); }

    // Day/Night
    if (code === 'KeyM'){ applyDayNight(!_isNight); e.preventDefault(); }
    if (code === 'KeyN'){ _autoCycle = !_autoCycle; _cycleTimer = 0; console.log('[Day/Night] auto-cycle', _autoCycle ? 'ON' : 'OFF'); e.preventDefault(); }
  });

  // Nebbia → materiali (aggiunge uniform alle mesh già presenti)
  attachFogTo(scene);

  // --- forest + altezza tipica pino (await pesante)
  const env = await setupForest(scene);
  attachFogTo(scene);

  // ---------- WASD Controller ----------
  const getGroundY = (x, z) => 0.0;
  playerCtl = new WASDController({
    camera,
    getGroundY,
    eyeHeight: 20,
    speed: 50,
    sprintMultiplier: 1.6,
    accel: 12,
    friction: 6,
    bounds: { minX:-9500, maxX:9500, minZ:-9500, maxZ:9500 },
    sensX: 0.0018,
    sensY: 0.0016
  });

  // ---------------- GHOST SPAWNER ----------------
  const getFocusPos = () => new THREE.Vector3().copy(camera.position);
  spawner = new GhostSpawner({
    scene, camera, getGroundY, getFocusPos,
    poolSize: 40, maxAlive: 7, spawnInterval: 1.2,
    minR: 140, maxR: 260, minPlayerDist: 60, minSeparation: 40,
    spawnMode: 'mix', sectorHalfAngleDeg: 90,
    mixWeights: { front: 0.25, behind: 0.25, left: 0.25, right: 0.25 },
    antiPopIn : true,
    ghostOpts: {
      url: '/assets/models/ghost/ghost.glb',
      targetHeight: env.pineTypicalHeight * 0.10,
      scaleJitter: 0.28,
      opacityBody: 0.78,
      speed: 14.0, burstMultiplier: 1.6,
      keepDistance: 0.0, arriveRadius: 1.2,
      yawRateDeg: 720,
      swoop: { far: 120, near: 55, hLow: 1.6, hHigh: 60.0, yLerp: 3.2 },
      weave: { amp: 0.9, omega: 0.9, fadeNear: 8, fadeFar: 90, enabled: true },
      hardLockDist: 60,
      idleWeaveAmp: 0.35, idleWeaveOmega: 1.5
    },
    protectSeconds: 1.0
  });

  spawner.onGhostCleansed = () => { _scoreFloat += 25; };

  let _baseMaxAlive = 0;
  let _baseSpawnInterval = 0;
  await spawner.init();
  // Cattura la baseline UNA volta
  if (!BASE.captured) {
    BASE.maxAlive      = spawner.params.maxAlive;
    BASE.spawnInterval = spawner.params.spawnInterval;
    BASE.captured      = true;
  }
  if (spawner.pauseAggro) spawner.pauseAggro(false);

  // ===== BEAM SYSTEM (GIMBAL) =====
  beamSystem = new BeamSystem({
    scene, camera,
    halfAngleDeg: 20,
    maxRange: spawner.params.maxR,
    exposureRate: 4.2,
    smoothTau: 0.12,
    yawLimitDeg: 35, pitchLimitDeg: 25,
    sensX: 0.0018, sensY: 0.0016,
    recenterTau: 0.22
  });
  window.beamSystem = beamSystem;

  // ===== WISPS =====
  wisps = new WispSystem({
    scene, camera, getGroundY,
    max: 700, windAmp: 1.2, windFreq: 0.06, windSpeed: 0.45, lift: 0.75, drag: 0.9
  });
  window.wisps = wisps;

  // ====== GRID per collisione camera & gap map ======
  _occGrid = buildOccluderGrid(forest.occluders, 120);
  buildFogGapMapFromOccGrid(_occGrid, 6000, FOG_GAPMAP_SIZE);

  // ===== SANCTUARIES =====
  const TOTEM_COUNT = 3;
  const items = makeSanctuarySpots(TOTEM_COUNT, {
    bands: [[1200,1500], [2000,2600], [3000,3800]],
    seed: 1337,
    occluders: forest.occluders,
    gridCellSize: _occGrid.cellSize,
    minSeparation: 360,
    totemRadius: 36,
    margin: 32,
    radius: 100,
    holdSeconds: 3.0,
    tries: 3000,
    expandStep: 260,
    maxExpansions: 6
  });

  _sanctuaryItems0 = items.map(s => ({ ...s }));  // snapshot per ricreare allo stesso modo al reset

  sanctuaries = new SanctuarySystem({
    scene, camera,
    beamSystem, spawner,
    modelUrl: '/assets/models/totem/new_totem.fbx',
    items,
    decayRate: 0.12, entryPad: 10.0, purifyGrace: 0.9, aimStick: 0.35,
    onBeamTint: (hexOrNull)=>{
      const target = (hexOrNull != null) ? hexOrNull : 0xcff2ff;
      if (beam) beam.color.setHex(target);
      if (_reticleEl){
        const hexStr = '#'+ (target >>> 0).toString(16).padStart(6,'0');
        _reticleEl.style.borderColor = hexStr;
        _reticleEl.style.boxShadow   = '0 0 6px ' + hexStr;
      }
    },
    onPurified: (idx, totalDone, totalCount)=>{
      _scoreFloat += 150;
      player.health = Math.min(1.0, player.health + 0.25);

      if (spawner?.params) {
        spawner.params.maxAlive      = BASE.maxAlive;
        spawner.params.spawnInterval = BASE.spawnInterval;
      }


      if (scene.fog) {
        scene.fog.density *= 1.07;
        recomputeFogComp();
      }

      _hudShowDoneUntil = performance.now() * 0.001 + 2.5;
      if (totalDone === totalCount) showWinOverlay();
    }
  });

  await sanctuaries.init();

  // aggiungi i totem alla griglia e rigenera gap map includendo i totem
  {
    const totemOccs = sanctuaries.getOccluders?.() || [];
    const allOccs = forest.occluders.concat(totemOccs);
    _occGrid = buildOccluderGrid(allOccs, _occGrid ? _occGrid.cellSize : 120);
    buildFogGapMapFromOccGrid(_occGrid, 6000, FOG_GAPMAP_SIZE);
  }

  setupDebug(beamTargetObj);
  addEventListener('resize', onResize);

  // Optional compila shader/materiali per il primo frame fluido
  renderer.compile(scene, camera);
}

async function setupForest(scene){
  const catalog = new TreeCatalog();
  const proto = await catalog.load('pine', '/assets/models/trees/pine.obj', PINE_OPTIONS);

  let protoHeight = 0;
  for (const { geometry } of proto.geometriesByMaterial) {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    protoHeight = Math.max(protoHeight, bb.max.y - bb.min.y);
  }
  const sMed = 0.5 * (0.9 + 1.35);
  const pineTypicalHeight = protoHeight * sMed;

  forest = new ForestSystem(scene, {
    seed: 2025,
    innerRadius: 200,
    outerRadius: 6000,
    minSpacing: 22,
    maxSpacing: 34,
    count: 4500,
    scale: [0.9, 1.35],
    clearings: [{ x:0, z:0, r:200 }],
    types: [{
      name: 'pine',
      url: '/assets/models/trees/pine.obj',
      options: PINE_OPTIONS,
      occluderHeight: 160,
      occluderRadiusScale: 0.9
    }]
  }, catalog);

  const result = await forest.generate();
  console.log('Forest ready:', result);
  window.forest = forest;

  return { forest, pineTypicalHeight };
}

/* --- loop --- */
function animate(){
  requestAnimationFrame(animate);

  const tNow = performance.now() * 0.001;
  const dt   = Math.min(0.05, Math.max(0, tNow - _tPrev));
  _tPrev = tNow;

  // fog uniforms update (tempo/parametri)
  _fogShaders.forEach(s => {
    s.uniforms.fogTime.value      = animateFog ? tNow : 0.0;
    if (s.uniforms.fogTimeSpeed)  s.uniforms.fogTimeSpeed.value = FOG_TIME_SPEED;
    if (s.uniforms.fogNoise)      s.uniforms.fogNoise.value     = FOG_NOISE_STRENGTH;

    // Boost coerenti con la densità corrente
    if (s.uniforms.fogNearBoost)    s.uniforms.fogNearBoost.value    = FOG_NEAR_BOOST    * _nearMul;
    if (s.uniforms.fogLateralBoost) s.uniforms.fogLateralBoost.value = FOG_LATERAL_BOOST * _latMul;
  });

  if (_frozen) {
    renderer.render(scene, camera);
    return;
  }

  // dome segue la camera
  if (_skyFogDome) _skyFogDome.position.copy(camera.position);
  updateDayNight(dt);

  // input/camera
  playerCtl?.update(dt);

  // soft collision camera–alberi
  resolveCameraCollision(camera.position, _occGrid, { camRadius: 8, maxIter: 2 });

  // stato BEAM: attivo se power ON e non overheated
  const activeBeam = _fireToggle && !player.overheated;

  // 1) ghost update
  spawner?.update(dt);

  // 2) beam update
  if (beamSystem) {
    beamSystem.setFiring(activeBeam);
    beamSystem.update(dt, spawner?.active || []);
    player.heat       = beamSystem.heat;
    player.overheated = beamSystem.overheated;
    if (beam) beam.angle = THREE.MathUtils.degToRad(Math.max(1, beamSystem.halfAngleDeg));
  }

  // 2.25) wisps update
  wisps?.update(dt);

  // 2.5) sanctuaries update
  sanctuaries?.update(dt, {
    beamOn: activeBeam,
    overheated: player.overheated,
    playerPos: camera.position
  });

  // === DEFENSE HOTSPOT ===
  if (sanctuaries && spawner?.setDefenseHotspot) {
    const ctxS = sanctuaries.getNearestIncomplete?.(camera.position);
    if (ctxS) {
      const insideRing = sanctuaries.isInsideRing?.(camera.position, ctxS);
      const APPROACH_OUTER = 700;
      const RING_BUFFER    = 80;
      const nearEdge = ctxS.dist <= (ctxS.radius + sanctuaries.entryPad + RING_BUFFER);

      if (ctxS.state === 'idle' && !insideRing && ctxS.dist <= APPROACH_OUTER && !nearEdge && !sanctuaries.isPurifySafe()) {
        spawner.setDefenseHotspot({
          pos: ctxS.pos,
          radius: APPROACH_OUTER,
          capBoost: 4,
          spawnIntervalMul: 0.30
        });
      } else {
        spawner.clearDefenseHotspot();
      }
    } else {
      spawner.clearDefenseHotspot();
    }
  }

  // === COMBAT: DPS se NON protetto ===
  const safe = sanctuaries?.isInsideProtectedRing?.(camera.position) || false;
  if (!safe) {
    let attackers = 0;
    for (const g of spawner?.active || []) {
      if (g.state !== 'active') continue;
      const dx = g.root.position.x - camera.position.x;
      const dz = g.root.position.z - camera.position.z;
      const d = Math.hypot(dx, dz);
      if (d <= ATTACK_RADIUS) attackers++;
    }
    if (attackers > 0) {
      const dmg = attackers * DPS_PER_GHOST * dt;
      player.health = Math.max(0, player.health - dmg);
      if (player.health <= 0) {
        showGameOverOverlay();
      }
    }
  }

  // === SCORE TICK: +2/sec mentre canalizzi ===
  const purifyingCount = sanctuaries?.getPurifyingCount?.() || 0;
  if (purifyingCount > 0) _scoreFloat += 2 * dt;

  // HUD base
  player.beamOn = _fireToggle;
  player.score = Math.floor(_scoreFloat);
  hud.set(
    player.health,
    player.heat,
    player.score,
    { overheated: player.overheated, beamOn: activeBeam }
  );

  // HUD Sanctuary (contestuale con “done” effimero)
  let hudInfo = sanctuaries?.getNearestInfo(camera.position) || null;
  if (hudInfo) {
    const near = hudInfo.dist <= (hudInfo.radius + sanctuaries.entryPad);
    let uiDim = !(near && (hudInfo.state === 'armed' || hudInfo.state === 'purifying'));

    if (hudInfo.state === 'done') {
      if (tNow <= _hudShowDoneUntil) {
        uiDim = false;
      } else {
        const inc = sanctuaries.getNearestIncomplete?.(camera.position);
        if (inc) {
          hudInfo = inc;
          const near2 = inc.dist <= (inc.radius + sanctuaries.entryPad);
          uiDim = !(near2 && (inc.state === 'armed' || inc.state === 'purifying'));
        } else {
          uiDim = true;
        }
      }
    }

    hudInfo = {
      ...hudInfo,
      uiDim,
      safe: sanctuaries.isInsideProtectedRing?.(camera.position) || false
    };
  }

  if (hud.setSanctuary) hud.setSanctuary(hudInfo);

  // Off-screen indicators (ghosts)
  if (hud.setIndicators) {
    const show = !(spawner?.isAggroPaused?.());
    hud.setIndicators( show ? buildOffscreenIndicators(camera, spawner, { max: 4, marginPx: 28 }) : [] );
  }

  // Totem edge indicator (kill-switch off)
  if (hud.setTotemIndicator) {
    if (ENABLE_TOTEM_EDGE && _showTotemEdge) {
      const item = buildTotemIndicator(camera, sanctuaries, { marginPx: 28 });
      hud.setTotemIndicator(item);
    } else {
      hud.setTotemIndicator(null);
    }
  }

  // debug info
  const g = spawner?.firstActive?.();
  const thr = (g && g._getThreshold) ? g._getThreshold() : (g?.uniformSets?.[0]?.uThreshold?.value ?? 1.0);
  const dist = g ? Math.hypot(g.root.position.x - camera.position.x, g.root.position.z - camera.position.z) : 0;
  const spStats = spawner?.debugInfo?.() || null;
  const focus = window.beamSystem?.getFocusInfo?.();
  const exposureForHUD = focus ? focus.exposure : (g?.exposure || 0);

  if (typeof hud.setDebug === 'function') {
    hud.setDebug({
      state: g?.state ?? 'inactive',
      threshold: thr,
      exposure: exposureForHUD,
      dist,
      spawner: spStats
    });
  }

  // reticolo
  updateReticle();

  renderer.render(scene, camera);

  updateDebug(spStats || {});
}

function onResize(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

/* -------- mini UI (debug) -------- */
function setupDebug(beamTargetObj){
  debugEl = document.createElement('div');
  debugEl.style.cssText = `
    position:fixed; left:8px; bottom:8px; z-index:9998;
    color:#dfe8f3; background:#0008; padding:6px 8px; border-radius:6px;
    font:12px/1.35 monospace; user-select:none; pointer-events:none; white-space:pre;`;
  debugEl.style.display = 'none';
  document.body.appendChild(debugEl);

  addEventListener('keydown', (e)=>{
    if (!e.ctrlKey) return;
    switch(e.code){
      case 'Minus':
        renderer.toneMappingExposure = Math.max(0.2, renderer.toneMappingExposure - 0.05);
        break;
      case 'Equal':
        renderer.toneMappingExposure = Math.min(3.0, renderer.toneMappingExposure + 0.05);
        break;
    }
  });

  // punta lo spotlight lungo la FORWARD del BEAM
  const fwd  = new THREE.Vector3();
  const apex = new THREE.Vector3();
  const updateBeamTarget = ()=>{
    if (window.beamSystem) {
      window.beamSystem.getBeamForward(fwd);
      window.beamSystem.getBeamApex(apex);
    } else {
      camera.getWorldDirection(fwd);
      apex.copy(camera.position);
    }
    beamTargetObj.position.copy(apex).addScaledVector(fwd, 60);
  };
  const _origRender = renderer.render.bind(renderer);
  renderer.render = (a,b)=>{ updateBeamTarget(); _origRender(a,b); };
}

/* --------- Reticolo --------- */
function updateReticle(){
  if (!_reticleEl || !window.beamSystem) return;
  if (!window.beamSystem.aiming || _frozen) {
    _reticleEl.style.left = '-9999px';
    _reticleEl.style.top  = '-9999px';
    return;
  }
  const fwd = window.beamSystem.getBeamForward(new THREE.Vector3());
  const p = new THREE.Vector3().copy(camera.position).addScaledVector(fwd, 60);
  p.project(camera);
  if (p.z < -1 || p.z > 1) {
    _reticleEl.style.left = '-9999px';
    _reticleEl.style.top  = '-9999px';
    return;
  }
  const x = (p.x * 0.5 + 0.5) * innerWidth;
  const y = (-p.y * 0.5 + 0.5) * innerHeight;
  _reticleEl.style.left = x + 'px';
  _reticleEl.style.top  = y + 'px';
}

/* --------- Off-screen indicators (ghosts) --------- */
function buildOffscreenIndicators(camera, spawner, { max = 4, marginPx = 28 } = {}){
  if (!spawner || !camera) return [];

  const items = [];
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq()>0) fwd.normalize();

  const camPos = camera.position.clone();
  const w = innerWidth, h = innerHeight;
  const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));

  for (const g of spawner.active || []){
    if (!g?.root?.visible) continue;
    if (g.state === 'cleansing' || g.state === 'inactive') continue;

    const gp = g.root.position.clone();
    const v = gp.clone().sub(camPos); v.y = 0;
    const dist = v.length();
    if (!isFinite(dist) || dist < 1e-3) continue;

    const p = gp.clone().project(camera);
    const behind = v.dot(fwd) < 0;
    let nx = p.x, ny = p.y;
    if (behind){ nx = -nx; ny = -ny; }

    const onScreen = !behind && nx >= -1 && nx <= 1 && ny >= -1 && ny <= 1;
    if (onScreen) continue;

    const mx = (marginPx / w) * 2;
    const my = (marginPx / h) * 2;
    nx = clamp(nx, -1 + mx, 1 - mx);
    ny = clamp(ny, -1 + my, 1 - my);

    const sx = (nx * 0.5 + 0.5) * w;
    const sy = (-ny * 0.5 + 0.5) * h;

    const ang = Math.atan2(ny, nx);
    let severity = 'info';
    if (dist < 80) severity = 'danger';
    else if (dist < 160) severity = 'warn';

    const alpha = clamp(1.0 - dist / 500, 0.35, 1.0) * (behind ? 1.0 : 0.95);
    const scale = clamp(1.2 - dist / 600, 0.75, 1.15);

    const stateMul = (g.state === 'active') ? 1.0 : 0.8;
    const threat = stateMul * (behind ? 1.3 : 1.0) * (1 / (dist + 20));

    items.push({ x:sx, y:sy, ang, severity, alpha, scale, threat });
  }

  items.sort((a,b)=> b.threat - a.threat);
  return items.slice(0, max);
}

/* --------- Edge indicator per il totem incompleto più vicino --------- */
function buildTotemIndicator(camera, sanctuaries, { marginPx = 28 } = {}){
  if (!sanctuaries || !camera) return null;
  const info = sanctuaries.getNearestIncomplete?.(camera.position);
  if (!info || !info.pos) return null;

  const gp = info.pos.clone();
  const camPos = camera.position.clone();

  const pNDC = gp.clone().project(camera);
  const onScreen = (pNDC.z >= -1 && pNDC.z <= 1 && pNDC.x >= -1 && pNDC.x <= 1 && pNDC.y >= -1 && pNDC.y <= 1);
  const v = gp.clone().sub(camPos); v.y = 0;
  const dist = v.length();
  if (onScreen) return null;

  const w = innerWidth, h = innerHeight;
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const mx = (marginPx / w) * 2;
  const my = (marginPx / h) * 2;

  let nx = pNDC.x, ny = pNDC.y;
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq()>0) fwd.normalize();
  const behind = v.dot(fwd) < 0;
  if (behind){ nx = -nx; ny = -ny; }

  nx = clamp(nx, -1 + mx, 1 - mx);
  ny = clamp(ny, -1 + my, 1 - my);

  const x = (nx * 0.5 + 0.5) * w;
  const y = (-ny * 0.5 + 0.5) * h;

  const ang   = Math.atan2(ny, nx);
  const alpha = clamp(1.0 - dist / 1200, 0.25, 1.0);
  const scale = clamp(1.15 - dist / 1600, 0.7, 1.0);

  return { x, y, ang, alpha, scale, severity:'totem' };
}

/* --------- Collisione camera–alberi (soft push-out) --------- */
function resolveCameraCollision(pos, grid, opt = {}){
  if (!grid) return;
  const camR = opt.camRadius ?? 8;
  const cell = grid.cellSize;
  const ci = Math.floor(pos.x / cell);
  const cj = Math.floor(pos.z / cell);

  const neigh = [
    [0,0], [1,0], [-1,0], [0,1], [0,-1],
    [1,1], [1,-1], [-1,1], [-1,-1]
  ];

  let iter = opt.maxIter ?? 1;
  while (iter-- > 0){
    let pushed = false;
    for (const [di,dj] of neigh){
      const k = (ci+di)+'|'+(cj+dj);
      const arr = grid.grid.get(k);
      if (!arr) continue;
      for (const idx of arr){
        const c = grid.occs[idx]; // {pos, radius, height}
        const dx = pos.x - c.pos.x;
        const dz = pos.z - c.pos.z;
        const d2 = dx*dx + dz*dz;
        const minR = (c.radius || 0) + camR;
        if (d2 < minR*minR){
          const d = Math.max(1e-4, Math.sqrt(d2));
          const nx = dx / d, nz = dz / d;
          const push = (minR - d);
          pos.x += nx * push;
          pos.z += nz * push;
          pushed = true;
        }
      }
    }
    if (!pushed) break;
  }
}

function updateDebug(spStats = {}){
  if(!debugEl) return;
  const alive = spStats.alive ?? 0;
  const maxA  = spStats.maxAlive ?? 0;
  const aggro = spStats.aggroPaused ? 'PAUSED' : 'ON';

  const cone  = window.beamSystem?.halfAngleDeg ?? '-';
  const range = window.beamSystem?.maxRange ?? '-';

  debugEl.innerHTML =
    `Spawner: ${alive}/${maxA} (aggro:${aggro})  |  ` +
    ` P:spawn (+cap se pieno, max +2), -/+ (or ,/.) cone, Q/E snap, Shift+Q 180°, [/] fog, M: day/night, K: fog anim, F9/B : Break)`;
}


async function resetGame(){
  hideOverlay();

  // Flag di stato
  _won       = false;
  _isPaused  = false;
  _frozen    = false;

  // --- Stop tutto mentre resettiamo
  try { spawner?.pauseAggro?.(true); } catch(e){}
  animateFog = true;

  // --- Player/UI ---
  player.health = 1.0;
  player.heat = 0.0;
  player.overheated = false;
  _scoreFloat = 0;
  player.score = 0;
  _fireToggle = false;
  _aimHeld = false;
  _hudShowDoneUntil = 0;
  _showTotemEdge = false;
  hud?.setTotemIndicator?.(null);

  // --- Camera/beam ---
  playerCtl?.resetPose({ x: 0, z: 120, y: null, yaw: 0, pitch: 0, zeroVel: true });
  beamSystem?.reset?.();

  // --- Ghost spawner: pulizia dura + baseline
  try { spawner?.clearDefenseHotspot?.(); } catch(e){}
  try { spawner?.cleanseAll?.(); } catch(e){}
  try { spawner?.reset?.(); } catch(e){}
  if (spawner?.params){
    spawner.params.maxAlive      = BASE.maxAlive;
    spawner.params.spawnInterval = BASE.spawnInterval;
  }
  _debugCapDelta = 0; // azzera il delta di debug

  // --- Wisps
  _wispsEnabled = true;
  wisps?.setEnabled(true);
  wisps?.clear?.();

  // --- Fog baseline + uniform coerenti
  if (scene?.fog) scene.fog.density = FOG_D0;
  _nearMul = 1.0;
  _latMul  = 1.0;
  recomputeFogComp();
  _fogShaders.forEach(s=>{
    if (s.uniforms?.fogHeightFactor) s.uniforms.fogHeightFactor.value = FOG_HEIGHT_FACTOR;
  });

  // --- Day/Night: riparti di giorno
  _autoCycle  = true;
  _cycleTimer = 0;
  _dnLerp     = 0;
  _dnTarget   = 0;
  _isNight    = false;
  applyDayNight(false);
  updateDayNight(0);
  hud?.setDayNightIcon?.(false);

  // --- Ricrea i Santuari da zero (garantito: niente "verde" residuo)
  // 1) rimuovi eventuale sistema esistente
  if (sanctuaries){
    try { sanctuaries.dispose?.(); } catch(e){}
    try {
      const grp = sanctuaries.group || sanctuaries.root || sanctuaries.object3D;
      if (grp) scene.remove(grp);
    } catch(e){}
    sanctuaries = null;
  }

  // 2) ricrea con gli stessi spot iniziali
  const items = (_sanctuaryItems0 ?? []).map(s => ({ ...s }));
  sanctuaries = new SanctuarySystem({
    scene, camera,
    beamSystem, spawner,
    modelUrl: '/assets/models/totem/new_totem.fbx',
    items,
    decayRate: 0.12, entryPad: 10.0, purifyGrace: 0.9, aimStick: 0.35,
    onBeamTint: (hexOrNull)=>{
      const target = (hexOrNull != null) ? hexOrNull : 0xcff2ff;
      if (beam) beam.color.setHex(target);
      if (_reticleEl){
        const hexStr = '#'+ (target >>> 0).toString(16).padStart(6,'0');
        _reticleEl.style.borderColor = hexStr;
        _reticleEl.style.boxShadow   = '0 0 6px ' + hexStr;
      }
    },
    onPurified: (idx, totalDone, totalCount)=>{
      _scoreFloat += 150;
      player.health = Math.min(1.0, player.health + 0.25);

      // Dopo ogni totem, NON alteriamo i cap: restano alla baseline
      if (spawner?.params) {
        spawner.params.maxAlive      = BASE.maxAlive;
        spawner.params.spawnInterval = BASE.spawnInterval;
      }

      if (scene.fog) {
        scene.fog.density *= 1.07;
        recomputeFogComp();
      }

      _hudShowDoneUntil = performance.now() * 0.001 + 2.5;
      if (totalDone === totalCount) showWinOverlay();
    }
  });

  await sanctuaries.init?.();

  // 3) ricostruisci la gap map includendo i nuovi totem
  {
    const totemOccs = sanctuaries.getOccluders?.() || [];
    const allOccs   = forest.occluders.concat(totemOccs);
    _occGrid = buildOccluderGrid(allOccs, _occGrid ? _occGrid.cellSize : 120);
    buildFogGapMapFromOccGrid(_occGrid, 6000, FOG_GAPMAP_SIZE);
  }

  // --- Riparti
  _tPrev = performance.now() * 0.001;
  setTimeout(()=>{ spawner?.pauseAggro?.(false); }, 50); // piccolo respiro per evitare respawn immediati
  renderer?.domElement?.requestPointerLock?.();
}


/* ---- Spots per i santuari ---- */
function makeSanctuarySpots(count, opt = {}) {
  const {
    bands = [[1200,1500], [2000,2600], [3000,3800]],
    seed  = 1337,
    occluders = [],
    gridCellSize = 120,
    totemRadius = 36,
    margin = 32,
    minSeparation = 360,
    radius = 100,
    holdSeconds = 3.0,
    tries = 3000,
    expandStep = 260,
    maxExpansions = 6
  } = opt;

  const rng     = mulberry32(seed);
  const occGrid = buildOccluderGrid(occluders, gridCellSize);
  const needClear = totemRadius + margin;

  const farEnoughFromOthers = (x,z,spots)=>{
    for (const s of spots){
      if (Math.hypot(s.x - x, s.z - z) < minSeparation) return false;
    }
    return true;
  };

  const spots = [];
  for (let i=0; i<count; i++){
    let [rMin, rMax] = bands[i % bands.length];
    let attempts = 0, expansions = 0, placed = false;

    while (!placed && attempts < tries) {
      attempts++;
      if (attempts % 800 === 0 && expansions < maxExpansions) {
        rMin += expandStep; rMax += expandStep; expansions++;
      }

      const t  = rng();
      const r  = THREE.MathUtils.lerp(rMin, rMax, t);
      const th = rng() * Math.PI * 2;
      const x  = Math.cos(th) * r;
      const z  = Math.sin(th) * r;

      const dTree = minDistToOccluders(x, z, occGrid);
      if (!isFinite(dTree) || dTree < needClear) continue;

      if (!farEnoughFromOthers(x,z,spots)) continue;

      spots.push({ x, z, radius, holdSeconds });
      placed = true;
    }

    if (!placed){
      const r  = THREE.MathUtils.lerp(3200, 4200, rng());
      const th = rng() * Math.PI * 2;
      const x  = Math.cos(th) * r;
      const z  = Math.sin(th) * r;
      spots.push({ x, z, radius, holdSeconds });
    }
  }

  console.log('[Sanctuaries seeded by bands]', { seed, bands, found: spots.length });
  return spots;
}







































































































































































































































































































































































































































































































































































































