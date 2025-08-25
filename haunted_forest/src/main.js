// POSSIBILE INTEGRAZIONE DI CHAT 
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

/* ================== FOG: parametri globali ================== */
const INIT_FOG_DENSITY   = 4.0e-4;
const FOG_DENSITY_MULT   = 1.5;
const FOG_TIME_SPEED     = 0.12;
const FOG_NOISE_STRENGTH = 0.35;
const FOG_NEAR_BOOST     = 0.18;

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

// <<< Aggiunte uniform: fogTimeSpeed, fogNoise, fogNearBoost
THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
#ifdef USE_FOG
  uniform float fogTime;
  uniform float fogTimeSpeed;
  uniform float fogNoise;
  uniform float fogNearBoost;
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

// <<< Più denso, meno movimento, più “near”
THREE.ShaderChunk.fog_fragment = `
#ifdef USE_FOG
  vec3 fogOrigin = cameraPosition;
  vec3 dir = normalize(vFogWorldPos - fogOrigin);
  float dist = distance(vFogWorldPos, fogOrigin);

  vec3 sampleP = vFogWorldPos * 0.00025 + vec3(0.0, 0.0, fogTime * fogTimeSpeed * 0.025);
  float n = FBM(sampleP + FBM(sampleP)); n = n*0.5 + 0.5;
  n = mix(1.0, n, clamp(fogNoise, 0.0, 1.0));

  float dcurve = pow(dist, 1.2);
  float baseExp = 1.0 - exp(-dcurve * fogDensity * (0.85 + fogNearBoost));

  float y = dir.y; if(abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0)*1e-4;
  float heightFactor = 0.14;
  float heightFog = heightFactor * exp(-fogOrigin.y * fogDensity) *
                    (1.0 - exp(-dcurve * y * fogDensity)) / y;

  float fogFactor = clamp( mix(heightFog, heightFog + baseExp*0.85, 0.8) * n, 0.0, 1.0 );
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
`;

/* --- utility per applicare uniforms fogTime (e nuove uniform) a tutti i materiali --- */
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
        _fogShaders.add(shader);
      };
      m.needsUpdate = true;
    });
  });
}

/* ---- Day/Night smooth + auto-cycle ---- */
const DN_FADE_SECS   = 2.5;   // durata transizione day<->night
let _dnLerp   = 0;            // 0=giorno, 1=notte (blend corrente)
let _dnTarget = 0;            // 0/1 verso cui andiamo

const HALF_CYCLE_SECS = 45;   // ogni quanti secondi invertire (se auto)
let _cycleTimer = 0;
let _autoCycle  = true;      // attivalo con KeyN (vedi sotto)


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
const ENABLE_TOTEM_EDGE = false; // <<< kill-switch globale: lasciare false
let _showTotemEdge = false;

// reticolo
let _reticleEl = null;

// game freeze (GO/Win)
let _frozen = false;

let _tPrev = performance.now() * 0.001;

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

function applyDayNight(night){
  _dnTarget = night ? 1 : 0;   // non applica subito: imposta solo il target
}


function updateDayNight(dt){
  if (!sun || !ambient || !scene || !_skyFogDome || !renderer) return;

  // avanza verso il target
  if (_dnLerp !== _dnTarget){
    const step = dt / DN_FADE_SECS;
    _dnLerp = (_dnTarget > _dnLerp)
      ? Math.min(1, _dnLerp + step)
      : Math.max(0, _dnLerp - step);
  }

  // easing (smoothstep)
  const k0 = _dnLerp;                 // 0=day -> 1=night
  const k  = k0*k0*(3 - 2*k0);

  // colori giorno/notte
  const COL_DAY   = new THREE.Color(0xDFE9F3);
  const COL_NIGHT = new THREE.Color(0x0a1220);
  const fogCol    = COL_DAY.clone().lerp(COL_NIGHT, k);

  // fog + dome sempre coerenti
  scene.fog.color.copy(fogCol);
  const m = _skyFogDome.material;
  m.color.copy(fogCol);
  m.depthWrite = false;
  m.depthTest  = false;
  _skyFogDome.renderOrder = -1000;

  // luci
  ambient.intensity = THREE.MathUtils.lerp(0.35, 0.18, k);
  sun.intensity     = THREE.MathUtils.lerp(1.00, 0.35, k);
  // sole caldo di giorno, freddo di notte
  sun.color.set(0xffe6b3).lerp(new THREE.Color(0x9fbfff), k);

  // esposizione + clear color (in caso tu usi il clear)
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.00, 0.90, k);
  renderer.setClearColor(fogCol.getHex(), 1);

  // piccola orbita del sole (solo estetica)
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

  // aggiorna icona HUD quando superi metà
  const nowNight = (k >= 0.5);
  if (nowNight !== _isNight){
    _isNight = nowNight;
    hud?.setDayNightIcon?.(_isNight);
  }

  // auto-cycle opzionale
  if (_autoCycle){
    _cycleTimer += dt;
    if (_cycleTimer >= HALF_CYCLE_SECS){
      _cycleTimer = 0;
      applyDayNight(_dnTarget < 0.5 ? true : false); // flip
    }
  }
}





init();
animate();

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


function showWinOverlay(){
  _frozen = true;
  showOverlay({
    title: 'All Totems Purified!',
    text:  'The forest grows quiet. Play again?',
    primary:  { label:'Replay', onClick: ()=>{ resetGame(); } }
  });
}


window.showWinOverlay = showWinOverlay;

/* ---------------- init ---------------- */
async function init(){
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0x87a0c0);
  scene.background = null; // DOME

  scene.fog = new THREE.FogExp2(0xDFE9F3, INIT_FOG_DENSITY * FOG_DENSITY_MULT);

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
  attachFogTo(_skyFogDome);

  // Luci (mutabili per day/night)
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

  // --- HUD ---
  hud = initHUD();
  // icona corretta all’avvio
  hud.setDayNightIcon(_isNight);

  // Controlla i tastierini 
  hud.setControlsHandlers({
  onConeMinus: ()=> beamSystem?.decHalfAngle?.(1),
  onConePlus:  ()=> beamSystem?.incHalfAngle?.(1),
  onBeamToggle:()=>{ _fireToggle = !_fireToggle; },
  onDayNightToggle:()=> { applyDayNight(!_isNight); }, // << rimuovi la setDayNightIcon qui
  onDebugToggle:()=>{ _showDebug = !_showDebug; if (debugEl) debugEl.style.display = _showDebug ? 'block' : 'none'; }
  });


  // Reticolo (mirino)
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
    if (code === 'KeyH'){                    
      _showDebug = !_showDebug;
      if (debugEl) debugEl.style.display = _showDebug ? 'block' : 'none';
      e.preventDefault();
    }
    if (code === 'F3'){                      // alias
      _showDebug = !_showDebug;
      if (debugEl) debugEl.style.display = _showDebug ? 'block' : 'none';
      e.preventDefault();
    }

    if (code === 'KeyP') spawner?.forceSpawnNow?.();
    if (code === 'KeyV') spawner?.toggleAntiPopIn?.();
    if (code === 'KeyC') spawner?.cleanseAll?.();
    if (code === 'KeyX') spawner?.cleanseNearest?.(camera.position);

    if (code === 'Comma')  { beamSystem?.decHalfAngle(1); e.preventDefault(); }
    if (code === 'Period') { beamSystem?.incHalfAngle(1); e.preventDefault(); }
    if (code === 'Digit9') { beamSystem?.decRange(10);    e.preventDefault(); }
    if (code === 'Digit0') { beamSystem?.incRange(10);    e.preventDefault(); }

    if (code === 'KeyQ') { const snap = e.shiftKey ? Math.PI : Math.PI/4; playerCtl?.addYaw(+snap); e.preventDefault(); }
    if (code === 'KeyE') { playerCtl?.addYaw(-Math.PI/4); e.preventDefault(); }

    if (code === 'KeyW') {
      _wispsEnabled = !_wispsEnabled;
      wisps?.setEnabled(_wispsEnabled);
    }
    if (code === 'KeyG' && ENABLE_TOTEM_EDGE) {
      _showTotemEdge = !_showTotemEdge;
      hud?.setTotemIndicator?.(null);
      e.preventDefault();
    }
    // Fog density ([ / ])
    if (code === 'BracketLeft')  {
      const k = e.shiftKey ? 1/1.25 : 1/1.12;
      scene.fog.density = Math.max(0, scene.fog.density * k);
      e.preventDefault();
    }
    if (code === 'BracketRight') {
      const k = e.shiftKey ? 1.25 : 1.12;
      scene.fog.density = Math.min(1, scene.fog.density * k);
      e.preventDefault();
    }
    // Manteniamo M per animazione fog (come prima)
    if (code === 'KeyM'){                    // M: notte/giorno (optional)
      applyDayNight(!_isNight);
      // hud.setDayNightIcon(_isNight);
      e.preventDefault();
    }
    
    // Se vuoi anche un tasto per notte/giorno, puoi usare ad es. KeyN:
    if (code === 'KeyN') {             // N = auto day/night ON/OFF
      _autoCycle = !_autoCycle;
      _cycleTimer = 0;                 // riparti da zero
      console.log('[Day/Night] auto-cycle', _autoCycle ? 'ON' : 'OFF');
      e.preventDefault();
    }

  });

  // Nebbia → materiali (aggiunge uniform)
  attachFogTo(scene);

  // --- forest + altezza tipica pino
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
    scene,
    camera,
    getGroundY,
    getFocusPos,

    poolSize: 40,
    maxAlive: 7,
    spawnInterval: 1.2,

    minR: 140,
    maxR: 260,
    minPlayerDist: 60,
    minSeparation: 40,

    spawnMode: 'mix',
    sectorHalfAngleDeg: 90,
    mixWeights: { front: 0.25, behind: 0.25, left: 0.25, right: 0.25 },
    antiPopIn : true,

    ghostOpts: {
      url: '/assets/models/ghost/ghost.glb',

      targetHeight: env.pineTypicalHeight * 0.10,
      scaleJitter: 0.28,
      opacityBody: 0.78,

      speed: 14.0,
      burstMultiplier: 1.6,

      keepDistance: 0.0,
      arriveRadius: 1.2,

      yawRateDeg: 720,

      swoop: { far: 120, near: 55, hLow: 1.6, hHigh: 60.0, yLerp: 3.2 },

      weave: { amp: 0.9, omega: 0.9, fadeNear: 8, fadeFar: 90, enabled: true },

      hardLockDist: 60,

      idleWeaveAmp: 0.35,
      idleWeaveOmega: 1.5
    },

    protectSeconds: 1.0
  });

  spawner.onGhostCleansed = () => { _scoreFloat += 25; };

  await spawner.init();
  if (spawner.pauseAggro) spawner.pauseAggro(false);

  // ===== BEAM SYSTEM (GIMBAL) =====
  beamSystem = new BeamSystem({
    scene,
    camera,
    halfAngleDeg: 20,
    maxRange: spawner.params.maxR,
    exposureRate: 4.2,
    smoothTau: 0.12,
    yawLimitDeg: 35,
    pitchLimitDeg: 25,
    sensX: 0.0018,
    sensY: 0.0016,
    recenterTau: 0.22
  });
  window.beamSystem = beamSystem;

  // ===== WISPS =====
  wisps = new WispSystem({
    scene,
    camera,
    getGroundY,
    max: 700,
    windAmp: 1.2,
    windFreq: 0.06,
    windSpeed: 0.45,
    lift: 0.75,
    drag: 0.9
  });
  window.wisps = wisps;

  // ====== GRID per collisione camera & generazione totem ======
  _occGrid = buildOccluderGrid(forest.occluders, 120);

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

  sanctuaries = new SanctuarySystem({
    scene, camera,
    beamSystem,
    spawner,
    modelUrl: '/assets/models/totem/new_totem.fbx',
    items,
    decayRate: 0.12,
    entryPad: 10.0,
    purifyGrace: 0.9,
    aimStick: 0.35,

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
        spawner.params.maxAlive += 1;
        spawner.params.spawnInterval *= 0.9;
      }
      if (scene.fog) scene.fog.density *= 1.07;

      // <<< NEW: mostra "done" forte per ~2.5s
      _hudShowDoneUntil = performance.now() * 0.001 + 2.5;

      if (totalDone === totalCount) showWinOverlay();
    }
  });

  await sanctuaries.init();
  // --- aggiungi i totem alla griglia collisione camera
  {
    const totemOccs = sanctuaries.getOccluders?.() || [];
    const allOccs = forest.occluders.concat(totemOccs);
    _occGrid = buildOccluderGrid(allOccs, _occGrid ? _occGrid.cellSize : 120);
  }

  setupDebug(beamTargetObj);
  addEventListener('resize', onResize);

  // Assicura preset Day/Night iniziale
  applyDayNight(false);  // target: giorno
  updateDayNight(0);     // applica subito lo stato iniziale
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
    if (s.uniforms.fogNearBoost)  s.uniforms.fogNearBoost.value = FOG_NEAR_BOOST;
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

  // HUD Sanctuary
  // HUD Sanctuary (contestuale, effimero su "done", poi dim e preferisci incompleto)
  let hudInfo = sanctuaries?.getNearestInfo(camera.position) || null;
  if (hudInfo) {
    const near = hudInfo.dist <= (hudInfo.radius + sanctuaries.entryPad);
    let uiDim = !(near && (hudInfo.state === 'armed' || hudInfo.state === 'purifying'));

    // se il più vicino è "done": mostra per 2.5s, poi sposta il focus su un incompleto (se c'è)
    if (hudInfo.state === 'done') {
      if (tNow <= _hudShowDoneUntil) {
        uiDim = false; // celebra a piena intensità
      } else {
        const inc = sanctuaries.getNearestIncomplete?.(camera.position);
        if (inc) {
          hudInfo = inc;
          const near2 = inc.dist <= (inc.radius + sanctuaries.entryPad);
          uiDim = !(near2 && (inc.state === 'armed' || inc.state === 'purifying'));
        } else {
          uiDim = true; // tutto done → pannello dim
        }
      }
    }

    // passiamo anche "safe" (opzionale) per il badge SAFE
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

  // Totem edge indicator (disabilitato via kill-switch)
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
  debugEl.style.display = 'none'; // nascosto di default
  document.body.appendChild(debugEl);

  addEventListener('keydown', (e)=>{
    switch(e.code){
      case 'Minus':        renderer.toneMappingExposure = Math.max(0.2, renderer.toneMappingExposure - 0.05); break;
      case 'Equal':        renderer.toneMappingExposure = Math.min(3.0, renderer.toneMappingExposure + 0.05); break;
      default: break;
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
  const heatPct = Math.round(player.heat*100);
  const beamState = player.overheated ? 'OVERHEATED' : (_fireToggle ? 'ON' : 'OFF');

  const alive = spStats.alive ?? 0;
  const maxA  = spStats.maxAlive ?? 0;
  const aggro = spStats.aggroPaused ? 'PAUSED' : 'ON';

  const cone  = window.beamSystem?.halfAngleDeg ?? '-';
  const range = window.beamSystem?.maxRange ?? '-';

//   debugEl.innerHTML =
//     `Fog: ${scene.fog?.density.toExponential?.(2)}  |  ` +
//     `Exposure: ${renderer.toneMappingExposure.toFixed?.(2)}  |  ` +
//     `Spawner: ${alive}/${maxA} (aggro:${aggro})  |  ` +
//     `Beam: ${beamState}  cone:${cone}°  range:${range}  |  ` +
//     `Wisps:${_wispsEnabled?'ON':'OFF'}`;
// }

debugEl.innerHTML =
    `Spawner: ${alive}/${maxA} (aggro:${aggro})  |  ` +
    ` P:spawn, V:antiPopIn, ,/. angle, 9/0 range, Q/E snap, Shift+Q 180°, W: wisps, [/] fog, M: fog anim)`;
} 

//   debugEl.innerHTML =
//       `Fog: ${scene.fog?.density}  |  ` +
//       `Animate Fog ${animateFog?'ON':'OFF'}${spLine}${beamInfo}  |  ` +
//       `Spawner: ${alive}/${maxA} (aggro:${aggro})  |  ` +
//       `Beam: ${beamState}  cone:${cone}°  range:${range}  |  ` +
//       `Wisps:${_wispsEnabled?'ON':'OFF'}` +
//       `P:spawn, V:antiPopIn, ,/. angle, 9/0 range, Q/E snap, Shift+Q 180°, W: wisps, [/] fog, M: fog anim)`
// }


// Previous Update Debug 
// function updateDebug(spStats = {}){
//   if(!debugEl) return;
//   const heatPct = Math.round(player.heat*100);
//   const beamState = player.overheated ? 'OVERHEATED' : (_fireToggle ? 'ON' : 'OFF');

//   const spLine =
//     ` | spawner: alive=${spStats.alive ?? 0}/${spStats.maxAlive ?? 0}` +
//     ` pool=${spStats.pool ?? 0} next=${(spStats.nextIn ?? 0).toFixed?.(2) ?? '0.00'}` +
//     ` mode=${spStats.mode ?? '-'} anti=${spStats.antiPopIn ? 'on' : 'off'}` +
//     ` aggro:${spStats.aggroPaused ? 'PAUSED' : 'on'}`;

//   const beamInfo = window.beamSystem
//     ? ` | cone:${window.beamSystem.halfAngleDeg}° range:${window.beamSystem.maxRange} hits:${window.beamSystem.hitsThisFrame}`
//     : '';

//   debugEl.innerHTML =
//     `FogExp2+FBM density: ${scene.fog?.density.toExponential(2)}  |  ` +
//     `Exposure: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
//     `shaders:${_fogShaders.size}  |  anim:${animateFog?'ON':'OFF'}${spLine}${beamInfo} | Wisps:${_wispsEnabled?'ON':'OFF'}\n` +
//     `Heat: ${player.overheated?'<span style="color:#ff6b6b">'+heatPct+'%</span>':heatPct+'%'}  ` +
//     `| Beam: ${beamState}  (H: help, F3: debug | RMB: AIM | F: power | P:spawn, V:antiPopIn, C:cleanse all, X:nearest, ,/. angle, 9/0 range, Q/E snap, Shift+Q 180°, W: wisps, [/] fog, M: fog anim)`;
// }

/* --------- Reset (Retry/Replay) --------- */
function resetGame(){
  hideOverlay();
  _frozen = false;

  player.health = 1.0;
  player.heat = 0.0;
  player.overheated = false;
  _scoreFloat = 0;
  player.score = 0;
  _fireToggle = false;
  _aimHeld = false;

  _showTotemEdge = false;

  playerCtl?.resetPose({ x: 0, z: 120, y: null, yaw: 0, pitch: 0, zeroVel: true });
  beamSystem?.reset?.();

  spawner?.reset?.();
  sanctuaries?.resetAll?.();

  _wispsEnabled = true;
  wisps?.setEnabled(true);
  wisps?.clear?.();

  if (scene?.fog) scene.fog.density = INIT_FOG_DENSITY;
  hud?.setTotemIndicator?.(null);
} 



























































































































































