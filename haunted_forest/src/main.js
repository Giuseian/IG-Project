// // Import Three.js core and OrbitControls
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// let scene, camera, renderer, controls;
// let ambient, sun, moon, hemi;
// let ground;
// let debugEl;

// // === Palettes (Step 1.E) ===
// const PALETTE = {
//   night: {
//     fogColor: 0x0b1424,
//     fogDensity: 0.022,
//     ambientColor: 0xb9c4d9,
//     ambientIntensity: 0.18,
//     sunColor: 0xbfd6ff,   // reused as moon color
//     sunIntensity: 1.1,    // reused as moon max intensity
//     hemiSky: 0x223349,
//     hemiGround: 0x1a2215,
//     hemiIntensity: 0.08,
//     groundColor: 0x26331d,
//     exposure: 1.05
//   },
//   day: {
//     fogColor: 0xcfd1d0,
//     fogDensity: 0.008,
//     ambientColor: 0xfff2d6,
//     ambientIntensity: 0.35,
//     sunColor: 0xffe6b3,
//     sunIntensity: 1.6,
//     hemiSky: 0xcfe4ff,
//     hemiGround: 0xbac2b0,
//     hemiIntensity: 0.15,
//     groundColor: 0x3a4b2b,
//     exposure: 1.25
//   }
// };

// // ---- Day–Night constants ----
// const DAY_LENGTH = 120;   // seconds for a full cycle
// const SKY_RADIUS = 120;

// // ---- Time driver (declare BEFORE animate() is called) ----
// let startTime = performance.now();
// let timeScale = 1;      // 1=running, 0=paused
// let manualPhase = null; // if set (0..1), locks time to that phase

// init();
// animate();

// function init() {
//   // Scene
//   scene = new THREE.Scene();

//   // Camera
//   camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
//   camera.position.set(0, 6, 16);
//   camera.lookAt(0, 0, 0);

//   // Renderer
//   renderer = new THREE.WebGLRenderer({
//     canvas: document.getElementById('game-canvas'),
//     antialias: true
//   });
//   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
//   renderer.setSize(innerWidth, innerHeight);
//   renderer.shadowMap.enabled = true;
//   renderer.shadowMap.type = THREE.PCFSoftShadowMap;
//   renderer.outputColorSpace = THREE.SRGBColorSpace;
//   renderer.toneMapping = THREE.ACESFilmicToneMapping;
//   renderer.toneMappingExposure = 1.1;

//   // Lights
//   ambient = new THREE.AmbientLight(0xffffff, 0.2);
//   scene.add(ambient);

//   sun = new THREE.DirectionalLight(PALETTE.day.sunColor, 1.2);
//   sun.position.set(18, 30, 12);
//   sun.castShadow = true;
//   sun.shadow.mapSize.set(1024, 1024);
//   sun.shadow.camera.near = 1;
//   sun.shadow.camera.far = 120;
//   sun.shadow.camera.left = -50;
//   sun.shadow.camera.right = 50;
//   sun.shadow.camera.top = 50;
//   sun.shadow.camera.bottom = -50;
//   scene.add(sun);

//   // Moon (no shadows to avoid double shadows)
//   moon = new THREE.DirectionalLight(0xbfd6ff, 0.0);
//   moon.position.set(-18, -30, -12);
//   scene.add(moon);

//   // Soft fill
//   hemi = new THREE.HemisphereLight(0x223349, 0x1a2215, 0.08);
//   scene.add(hemi);

//   // Fog baseline (night)
//   scene.fog = new THREE.FogExp2(PALETTE.night.fogColor, PALETTE.night.fogDensity);

//   // Ground
//   const groundGeo = new THREE.PlaneGeometry(200, 200);
//   const groundMat = new THREE.MeshStandardMaterial({
//     color: PALETTE.night.groundColor,
//     roughness: 1.0,
//     metalness: 0.0
//   });
//   ground = new THREE.Mesh(groundGeo, groundMat);
//   ground.rotation.x = -Math.PI / 2;
//   ground.receiveShadow = true;
//   scene.add(ground);

//   // Test box
//   const testBox = new THREE.Mesh(
//     new THREE.BoxGeometry(2, 2, 2),
//     new THREE.MeshStandardMaterial({ color: 0x8aa37b })
//   );
//   testBox.position.set(0, 1, 0);
//   testBox.castShadow = true;
//   scene.add(testBox);

//   // Controls
//   controls = new OrbitControls(camera, renderer.domElement);
//   controls.enableDamping = true;
//   controls.dampingFactor = 0.05;
//   controls.target.set(0, 1, 0);

//   // Resize
//   addEventListener('resize', onResize);

//   // Live tuning overlay + hotkeys (Step 1.D)
//   setupLiveTuning();
//   setLightingMood('night');
//   updateDebugUI();

//   // Palette toggles (Step 1.E)
//   addEventListener('keydown', (ev) => {
//     if (ev.key === 'n' || ev.key === 'N') { setLightingMood('night'); updateDebugUI(); }
//     if (ev.key === 'm' || ev.key === 'M') { setLightingMood('day');   updateDebugUI(); }
//   });

//   // Time control keys (pause + jump phases)
//   window.addEventListener('keydown', (e) => {
//     if (e.key === 'p' || e.key === 'P') timeScale = (timeScale === 0 ? 1 : 0);
//     if (e.key === 'u' || e.key === 'U') manualPhase = 0.00; // dawn
//     if (e.key === 'o' || e.key === 'O') manualPhase = 0.25; // noon
//     if (e.key === 'y' || e.key === 'Y') manualPhase = 0.50; // dusk
//     if (e.key === 'i' || e.key === 'I') manualPhase = 0.75; // midnight
//     if (e.key === 'r' || e.key === 'R') manualPhase = null; // realtime
//     updateDebugUI();
//   });
// }

// function setLightingMood(mode) {
//   const p = PALETTE[mode];
//   if (!p) return;

//   if (!scene.fog) scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
//   scene.fog.color.setHex(p.fogColor);
//   scene.fog.density = p.fogDensity;

//   ambient.color.setHex(p.ambientColor);
//   ambient.intensity = p.ambientIntensity;

//   sun.color.setHex(p.sunColor);
//   // This initial intensity is just a baseline; updateDayNight() will animate it
//   sun.intensity = (mode === 'day') ? p.sunIntensity : 0.2;

//   hemi.color.setHex(p.hemiSky);
//   hemi.groundColor.setHex(p.hemiGround);
//   hemi.intensity = p.hemiIntensity;

//   renderer.toneMappingExposure = p.exposure;
//   ground.material.color.setHex(p.groundColor);
// }

// // ---- Day–Night animation core ----
// function updateDayNight(timeSec) {
//   const phase = (timeSec % DAY_LENGTH) / DAY_LENGTH; // 0..1
//   const ang   = phase * Math.PI * 2;                  // 0..2π

//   // Move sun & moon on opposite halves of a sky circle
//   sun.position.set(Math.cos(ang) * SKY_RADIUS,  Math.sin(ang) * SKY_RADIUS,  0);
//   moon.position.set(Math.cos(ang + Math.PI) * SKY_RADIUS, Math.sin(ang + Math.PI) * SKY_RADIUS, 0);

//   // Above-horizon factors
//   const sunUp  = Math.max(0, Math.sin(ang));
//   const moonUp = Math.max(0, Math.sin(ang + Math.PI));

//   // Cross-fade intensities using palette endpoints
//   sun.intensity  = THREE.MathUtils.lerp(0.0, PALETTE.day.sunIntensity,   sunUp);
//   moon.intensity = THREE.MathUtils.lerp(0.0, PALETTE.night.sunIntensity, moonUp);

//   // Ambient
//   ambient.intensity = THREE.MathUtils.lerp(
//     PALETTE.night.ambientIntensity,
//     PALETTE.day.ambientIntensity,
//     sunUp
//   );

//   // Fog color & density
//   const nightFog = new THREE.Color(PALETTE.night.fogColor);
//   const dayFog   = new THREE.Color(PALETTE.day.fogColor);
//   scene.fog.color.lerpColors(nightFog, dayFog, sunUp);
//   scene.fog.density = THREE.MathUtils.lerp(
//     PALETTE.night.fogDensity,
//     PALETTE.day.fogDensity,
//     sunUp
//   );

//   // Exposure
//   renderer.toneMappingExposure = THREE.MathUtils.lerp(
//     PALETTE.night.exposure,
//     PALETTE.day.exposure,
//     sunUp
//   );

//   // Hemisphere intensity
//   hemi.intensity = THREE.MathUtils.lerp(
//     PALETTE.night.hemiIntensity,
//     PALETTE.day.hemiIntensity,
//     sunUp
//   );
// }

// // ---- Render loop + time driver ----
// function animate() {
//   requestAnimationFrame(animate);

//   const elapsed = (performance.now() - startTime) / 1000; // seconds
//   const t = (manualPhase !== null) ? manualPhase * DAY_LENGTH : elapsed * timeScale;

//   updateDayNight(t);
//   controls.update();
//   renderer.render(scene, camera);
// }

// function onResize() {
//   camera.aspect = innerWidth / innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(innerWidth, innerHeight);
// }

// /* ---------- Live tuning overlay (Step 1.D) ---------- */
// function setupLiveTuning() {
//   debugEl = document.createElement('div');
//   debugEl.id = 'debug-look';
//   debugEl.style.cssText = `
//     position:fixed; left:8px; bottom:8px; z-index:9999;
//     color:#9fb6d1; background:#0008; padding:6px 8px; border-radius:6px;
//     font:12px/1.3 monospace; user-select:none; pointer-events:none;
//     white-space:pre;
//   `;
//   document.body.appendChild(debugEl);

//   addEventListener('keydown', (ev) => {
//     let changed = true;
//     switch (ev.key) {
//       case '[': scene.fog.density = clamp(scene.fog.density - 0.001, 0.005, 0.05); break;
//       case ']': scene.fog.density = clamp(scene.fog.density + 0.001, 0.005, 0.05); break;
//       case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.5, 2.0); break;
//       case '=':
//       case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.5, 2.0); break;
//       case '1': ambient.intensity = clamp(ambient.intensity - 0.02, 0.0, 1.0); break;
//       case '2': ambient.intensity = clamp(ambient.intensity + 0.02, 0.0, 1.0); break;
//       case '3': sun.intensity = clamp(sun.intensity - 0.05, 0.0, 3.0); break;
//       case '4': sun.intensity = clamp(sun.intensity + 0.05, 0.0, 3.0); break;
//       default: changed = false;
//     }
//     if (changed) updateDebugUI();
//   });
// }

// function updateDebugUI() {
//   if (!debugEl) return;
//   debugEl.textContent =
//     `fog: ${scene.fog.density.toFixed(3)}  |  exp: ${renderer.toneMappingExposure.toFixed(2)}  |  amb: ${ambient.intensity.toFixed(2)}  |  sun: ${sun.intensity.toFixed(2)}\n` +
//     `[N]ight / [M]orning — [ ]  - =  1 2 3 4  |  [P]ause  [U]Dawn  [O]Noon  [Y]Dusk  [I]Midnight  [R]eal-time`;
// }

// function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }


// Import Three.js core and OrbitControls
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let ambient, sun, moon, hemi;
let ground;
let debugEl;

// === Palettes (Step 1.E) ===
const PALETTE = {
  night: {
    fogColor: 0x0b1424,
    fogDensity: 0.022,
    ambientColor: 0xb9c4d9,
    ambientIntensity: 0.18,
    sunColor: 0xbfd6ff,   // reused as moon color
    sunIntensity: 1.1,    // reused as moon max intensity
    hemiSky: 0x223349,
    hemiGround: 0x1a2215,
    hemiIntensity: 0.08,
    groundColor: 0x26331d,
    exposure: 1.05
  },
  day: {
    fogColor: 0xcfd1d0,
    fogDensity: 0.008,
    ambientColor: 0xfff2d6,
    ambientIntensity: 0.35,
    sunColor: 0xffe6b3,
    sunIntensity: 1.6,
    hemiSky: 0xcfe4ff,
    hemiGround: 0xbac2b0,
    hemiIntensity: 0.15,
    groundColor: 0x3a4b2b,
    exposure: 1.25
  }
};

// ---- Day–Night constants ----
const DAY_LENGTH = 120;   // seconds for a full cycle
const SKY_RADIUS = 120;

// ---- Time driver (declare BEFORE animate() is called) ----
let startTime = performance.now();
let timeScale = 1;      // 1=running, 0=paused
let manualPhase = null; // if set (0..1), locks time to that phase

init();
animate();

function init() {
  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 500);
  camera.position.set(0, 6, 16);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('game-canvas'),
    antialias: true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Lights
  ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  sun = new THREE.DirectionalLight(PALETTE.day.sunColor, 1.2);
  sun.position.set(18, 30, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  // Moon (no shadows to avoid double shadows)
  moon = new THREE.DirectionalLight(0xbfd6ff, 0.0);
  moon.position.set(-18, -30, -12);
  scene.add(moon);

  // Soft fill
  hemi = new THREE.HemisphereLight(0x223349, 0x1a2215, 0.08);
  scene.add(hemi);

  // Fog baseline (night)
  scene.fog = new THREE.FogExp2(PALETTE.night.fogColor, PALETTE.night.fogDensity);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: PALETTE.night.groundColor,
    roughness: 1.0,
    metalness: 0.0
  });
  ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Test box
  const testBox = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial({ color: 0x8aa37b })
  );
  testBox.position.set(0, 1, 0);
  testBox.castShadow = true;
  scene.add(testBox);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1, 0);

  // Resize
  addEventListener('resize', onResize);

  // Live tuning overlay + hotkeys (Step 1.D)
  setupLiveTuning();
  setLightingMood('night');
  updateDebugUI();

  // Palette toggles (Step 1.E)
  addEventListener('keydown', (ev) => {
    if (ev.key === 'n' || ev.key === 'N') { setLightingMood('night'); updateDebugUI(); }
    if (ev.key === 'm' || ev.key === 'M') { setLightingMood('day');   updateDebugUI(); }
  });

  // Time control keys (pause + jump phases)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P') timeScale = (timeScale === 0 ? 1 : 0);
    if (e.key === 'u' || e.key === 'U') manualPhase = 0.00; // dawn
    if (e.key === 'o' || e.key === 'O') manualPhase = 0.25; // noon
    if (e.key === 'y' || e.key === 'Y') manualPhase = 0.50; // dusk
    if (e.key === 'i' || e.key === 'I') manualPhase = 0.75; // midnight
    if (e.key === 'r' || e.key === 'R') manualPhase = null; // realtime
    updateDebugUI();
  });
}

function setLightingMood(mode) {
  const p = PALETTE[mode];
  if (!p) return;

  if (!scene.fog) scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
  scene.fog.color.setHex(p.fogColor);
  scene.fog.density = p.fogDensity;

  ambient.color.setHex(p.ambientColor);
  ambient.intensity = p.ambientIntensity;

  sun.color.setHex(p.sunColor);
  // This initial intensity is just a baseline; updateDayNight() will animate it
  sun.intensity = (mode === 'day') ? p.sunIntensity : 0.2;

  hemi.color.setHex(p.hemiSky);
  hemi.groundColor.setHex(p.hemiGround);
  hemi.intensity = p.hemiIntensity;

  renderer.toneMappingExposure = p.exposure;
  ground.material.color.setHex(p.groundColor);
}

// ---- Day–Night animation core ----
function updateDayNight(timeSec) {
  const phase = (timeSec % DAY_LENGTH) / DAY_LENGTH; // 0..1
  const ang   = phase * Math.PI * 2;                  // 0..2π

  // Move sun & moon on opposite halves of a sky circle
  sun.position.set(Math.cos(ang) * SKY_RADIUS,  Math.sin(ang) * SKY_RADIUS,  0);
  moon.position.set(Math.cos(ang + Math.PI) * SKY_RADIUS, Math.sin(ang + Math.PI) * SKY_RADIUS, 0);

  // Above-horizon factors
  const sunUp  = Math.max(0, Math.sin(ang));
  const moonUp = Math.max(0, Math.sin(ang + Math.PI));

  // Cross-fade intensities using palette endpoints
  sun.intensity  = THREE.MathUtils.lerp(0.0, PALETTE.day.sunIntensity,   sunUp);
  moon.intensity = THREE.MathUtils.lerp(0.0, PALETTE.night.sunIntensity, moonUp);

  // Ambient
  ambient.intensity = THREE.MathUtils.lerp(
    PALETTE.night.ambientIntensity,
    PALETTE.day.ambientIntensity,
    sunUp
  );

  // Fog color & density
  const nightFog = new THREE.Color(PALETTE.night.fogColor);
  const dayFog   = new THREE.Color(PALETTE.day.fogColor);
  scene.fog.color.lerpColors(nightFog, dayFog, sunUp);
  scene.fog.density = THREE.MathUtils.lerp(
    PALETTE.night.fogDensity,
    PALETTE.day.fogDensity,
    sunUp
  );

  // Exposure
  renderer.toneMappingExposure = THREE.MathUtils.lerp(
    PALETTE.night.exposure,
    PALETTE.day.exposure,
    sunUp
  );

  // Hemisphere intensity
  hemi.intensity = THREE.MathUtils.lerp(
    PALETTE.night.hemiIntensity,
    PALETTE.day.hemiIntensity,
    sunUp
  );
}

// ---- Render loop + time driver ----
function animate() {
  requestAnimationFrame(animate);

  const elapsed = (performance.now() - startTime) / 1000; // seconds
  const t = (manualPhase !== null) ? manualPhase * DAY_LENGTH : elapsed * timeScale;

  updateDayNight(t);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

/* ---------- Live tuning overlay (Step 1.D) ---------- */
function setupLiveTuning() {
  debugEl = document.createElement('div');
  debugEl.id = 'debug-look';
  debugEl.style.cssText = `
    position:fixed; left:8px; bottom:8px; z-index:9999;
    color:#9fb6d1; background:#0008; padding:6px 8px; border-radius:6px;
    font:12px/1.3 monospace; user-select:none; pointer-events:none;
    white-space:pre;
  `;
  document.body.appendChild(debugEl);

  addEventListener('keydown', (ev) => {
    let changed = true;
    switch (ev.key) {
      case '[': scene.fog.density = clamp(scene.fog.density - 0.001, 0.005, 0.05); break;
      case ']': scene.fog.density = clamp(scene.fog.density + 0.001, 0.005, 0.05); break;
      case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.5, 2.0); break;
      case '=':
      case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.5, 2.0); break;
      case '1': ambient.intensity = clamp(ambient.intensity - 0.02, 0.0, 1.0); break;
      case '2': ambient.intensity = clamp(ambient.intensity + 0.02, 0.0, 1.0); break;
      case '3': sun.intensity = clamp(sun.intensity - 0.05, 0.0, 3.0); break;
      case '4': sun.intensity = clamp(sun.intensity + 0.05, 0.0, 3.0); break;
      default: changed = false;
    }
    if (changed) updateDebugUI();
  });
}

function updateDebugUI() {
  if (!debugEl) return;
  debugEl.textContent =
    `fog: ${scene.fog.density.toFixed(3)}  |  exp: ${renderer.toneMappingExposure.toFixed(2)}  |  amb: ${ambient.intensity.toFixed(2)}  |  sun: ${sun.intensity.toFixed(2)}\n` +
    `[N]ight / [M]orning — [ ]  - =  1 2 3 4  |  [P]ause  [U]Dawn  [O]Noon  [Y]Dusk  [I]Midnight  [R]eal-time`;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
