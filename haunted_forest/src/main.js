// Import Three.js core and OrbitControls
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let ambient, sun, moon, hemi;
let ground;
let debugEl;
let skyDome, skyMat;

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

// ---- Time driver ----
let startTime = performance.now();
let timeScale = 1;      // 1=running, 0=paused
let manualPhase = null; // if set (0..1), locks time to that phase

// === SkyDome gradient colors ===
const SKY_DAY_TOP     = new THREE.Color(0x89c7ff);
const SKY_DAY_BOTTOM  = new THREE.Color(0xcfe8ff);
const SKY_NIGHT_TOP   = new THREE.Color(0x0a1330);
const SKY_NIGHT_BOTTOM= new THREE.Color(0x081018);

// === GLSL Shaders ===
const SKY_VERT = /* glsl */`
  varying vec3 vWorldDir;
  void main() {
    vWorldDir = normalize((modelMatrix * vec4(position,1.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorldDir;

  uniform vec3 topDay;
  uniform vec3 bottomDay;
  uniform vec3 topNight;
  uniform vec3 bottomNight;

  uniform vec3  sunDir;
  uniform vec3  moonDir;
  uniform float sunUp;

  uniform float sunSize;       // radians
  uniform float sunSoftness;   // radians
  uniform float sunIntensity;

  uniform float moonSize;      // radians
  uniform float moonSoftness;  // radians
  uniform float moonIntensity;

  float angBetween(vec3 a, vec3 b){
    float d = clamp(dot(normalize(a), normalize(b)), -1.0, 1.0);
    return acos(d);
  }
  // 1.0 at center, fades to 0 from radius..radius+softness
  float softDisc(vec3 dir, vec3 centerDir, float radius, float softness){
    float ang = angBetween(dir, centerDir);
    return smoothstep(radius + softness, radius, ang);
  }

  void main() {
    float h = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);

    vec3 gradDay    = mix(bottomDay,   topDay,   h);
    vec3 gradNight  = mix(bottomNight, topNight, h);
    vec3 baseCol    = mix(gradNight, gradDay, sunUp);

    float sunMask   = softDisc(vWorldDir, sunDir,  sunSize,  sunSoftness);
    vec3  sunCol    = vec3(1.0, 0.92, 0.75) * sunIntensity * sunMask;

    float moonMask  = softDisc(vWorldDir, moonDir, moonSize, moonSoftness);
    vec3  moonCol   = vec3(0.82, 0.9, 1.0) * moonIntensity * moonMask;

    gl_FragColor = vec4(baseCol + sunCol + moonCol, 1.0);
  }
`;

init();
animate();

function init() {
  scene = new THREE.Scene();

  // Camera — FAR bumped so the sky sphere (radius 1000) never clips
  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
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
  renderer.setClearColor(0x000000, 1);

  // Lights
  ambient = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambient);

  sun = new THREE.DirectionalLight(PALETTE.day.sunColor, 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);

  moon = new THREE.DirectionalLight(0xbfd6ff, 0.0);
  scene.add(moon);

  hemi = new THREE.HemisphereLight(0x223349, 0x1a2215, 0.08);
  scene.add(hemi);

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

  // Skydome
  const skyGeo = new THREE.SphereGeometry(1000, 48, 32);
  skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      topDay:       { value: SKY_DAY_TOP.clone() },
      bottomDay:    { value: SKY_DAY_BOTTOM.clone() },
      topNight:     { value: SKY_NIGHT_TOP.clone() },
      bottomNight:  { value: SKY_NIGHT_BOTTOM.clone() },
      sunDir:       { value: new THREE.Vector3(0,1,0) },
      moonDir:      { value: new THREE.Vector3(0,-1,0) },
      sunUp:        { value: 0.0 },
      // Big enough to be obvious
      sunSize:      { value: 0.18 },
      sunSoftness:  { value: 0.12 },
      sunIntensity: { value: 1.4 },
      moonSize:     { value: 0.10 },
      moonSoftness: { value: 0.10 },
      moonIntensity:{ value: 0.9 },
    }
  });
  skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder   = -1;
  scene.add(skyDome);

  // Resize
  addEventListener('resize', onResize);

  setupLiveTuning();
  setLightingMood('night');
  updateDebugUI();

  // Palette toggles
  addEventListener('keydown', (ev) => {
    if (ev.key === 'n' || ev.key === 'N') { setLightingMood('night'); updateDebugUI(); }
    if (ev.key === 'm' || ev.key === 'M') { setLightingMood('day');   updateDebugUI(); }
  });

  // Time control keys
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
  sun.intensity = p.sunIntensity;

  hemi.color.setHex(p.hemiSky);
  hemi.groundColor.setHex(p.hemiGround);
  hemi.intensity = p.hemiIntensity;

  renderer.toneMappingExposure = p.exposure;
  ground.material.color.setHex(p.groundColor);
}

// ---- Day–Night animation core ----
function updateDayNight(timeSec) {
  const phase = (timeSec % DAY_LENGTH) / DAY_LENGTH;
  const ang   = phase * Math.PI * 2;

  sun.position.set(Math.cos(ang) * SKY_RADIUS,  Math.sin(ang) * SKY_RADIUS,  0);
  moon.position.set(Math.cos(ang + Math.PI) * SKY_RADIUS, Math.sin(ang + Math.PI) * SKY_RADIUS, 0);

  const sunUp  = Math.max(0, Math.sin(ang));
  const moonUp = Math.max(0, Math.sin(ang + Math.PI));

  // Cross-fade light intensities
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

  // Hemisphere intensity  (FIXED TYPO)
  hemi.intensity = THREE.MathUtils.lerp(
    PALETTE.night.hemiIntensity,
    PALETTE.day.hemiIntensity,
    sunUp
  );

  // --- Skydome uniforms ---
  const sunDir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).normalize();
  const moonDir = new THREE.Vector3(Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), 0).normalize();

  if (skyMat) {
    skyMat.uniforms.sunDir.value.copy(sunDir);
    skyMat.uniforms.moonDir.value.copy(moonDir);
    skyMat.uniforms.sunUp.value = sunUp;

    // Make discs brighten/dim with day/night
    skyMat.uniforms.sunIntensity.value  = THREE.MathUtils.lerp(0.0, 1.4, sunUp);
    skyMat.uniforms.moonIntensity.value = THREE.MathUtils.lerp(0.9, 0.0, sunUp);
  }
}

// ---- Render loop ----
function animate() {
  requestAnimationFrame(animate);

  // Keep the dome centered on camera (works fine with OrbitControls)
  if (skyDome) skyDome.position.copy(camera.position);

  const elapsed = (performance.now() - startTime) / 1000;
  const t = (manualPhase !== null) ? manualPhase * DAY_LENGTH : elapsed * timeScale;

  updateDayNight(t);
  updateDebugUI();
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

/* ---------- Debug overlay ---------- */
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

