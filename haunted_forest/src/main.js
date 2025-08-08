// Import Three.js core and OrbitControls
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let ambient, sun, hemi;
let ground;
let debugEl;

// === Palettes for quick mood switching ===
const PALETTE = {
  night: {
    fogColor: 0x0b1424,
    fogDensity: 0.022,
    ambientColor: 0xb9c4d9,
    ambientIntensity: 0.18,
    sunColor: 0xbfd6ff,       // cool “moonlight”
    sunIntensity: 1.1,
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
    sunColor: 0xffe6b3,       // warm sunlight
    sunIntensity: 1.6,
    hemiSky: 0xcfe4ff,
    hemiGround: 0xbac2b0,
    hemiIntensity: 0.15,
    groundColor: 0x3a4b2b,
    exposure: 1.25
  }
};

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

  sun = new THREE.DirectionalLight(0xffffff, 1.2);
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

  hemi = new THREE.HemisphereLight(0x223349, 0x1a2215, 0.08);
  scene.add(hemi);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x26331d,
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

  // Debug overlay (from Step 1D)
  setupLiveTuning();

  // === Apply initial mood (night) ===
  setLightingMood('night');
  updateDebugUI();

  // Key toggles: N = night, M = day
  addEventListener('keydown', (ev) => {
    if (ev.key === 'n' || ev.key === 'N') { setLightingMood('night'); updateDebugUI(); }
    if (ev.key === 'm' || ev.key === 'M') { setLightingMood('day');   updateDebugUI(); }
  });
}

function setLightingMood(mode) {
  const p = PALETTE[mode];
  if (!p) return;

  // Fog
  if (!scene.fog) scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
  scene.fog.color.setHex(p.fogColor);
  scene.fog.density = p.fogDensity;

  // Lights
  ambient.color.setHex(p.ambientColor);
  ambient.intensity = p.ambientIntensity;

  sun.color.setHex(p.sunColor);
  sun.intensity = p.sunIntensity;

  hemi.color.setHex(p.hemiSky);
  hemi.groundColor.setHex(p.hemiGround);
  hemi.intensity = p.hemiIntensity;

  // Renderer exposure
  renderer.toneMappingExposure = p.exposure;

  // Ground tint
  ground.material.color.setHex(p.groundColor);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/* ---------- Live tuning overlay (from Step 1D) ---------- */
function setupLiveTuning() {
  debugEl = document.createElement('div');
  debugEl.id = 'debug-look';
  debugEl.style.cssText = `
    position:fixed; left:8px; bottom:8px; z-index:9999;
    color:#9fb6d1; background:#0008; padding:6px 8px; border-radius:6px;
    font:12px/1.3 monospace; user-select:none; pointer-events:none;
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
    `[N]ight / [M]orning — use [ ] - = 1 2 3 4 to tweak`;
}


function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
