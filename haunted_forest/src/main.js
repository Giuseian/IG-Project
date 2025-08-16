// // // // Import Three.js core and OrbitControls
// // // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // // import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// // // let scene, camera, renderer, controls;
// // // let ambient, sun, moon, hemi;
// // // let ground;
// // // let debugEl;
// // // let skyDome, skyMat;

// // // // debug cache for overlay
// // // const _lastDebug = { sunUp: 0, wAmb: 0, wExp: 0, wFog: 0 };

// // // // === Palettes ===
// // // const PALETTE = {
// // //   night: {
// // //     fogColor: 0x0a1220, fogDensity: 0.025,
// // //     ambientColor: 0xb1c0d4, ambientIntensity: 0.14,
// // //     sunColor: 0xbfd6ff, sunIntensity: 1.0,
// // //     hemiSky: 0x1a2738, hemiGround: 0x141414, hemiIntensity: 0.06,
// // //     groundColor: 0x20261b, exposure: 1.00
// // //   },
// // //   day: {
// // //     fogColor: 0xd7dee6, fogDensity: 0.010,
// // //     ambientColor: 0xfff0d0, ambientIntensity: 0.38,
// // //     sunColor: 0xffe6b3, sunIntensity: 1.7,
// // //     hemiSky: 0xcfe4ff, hemiGround: 0xb0b6aa, hemiIntensity: 0.18,
// // //     groundColor: 0x4b5a39, exposure: 1.18
// // //   }
// // // };

// // // // Day–Night
// // // const DAY_LENGTH = 120;   // seconds
// // // const SKY_RADIUS = 120;

// // // // Time driver
// // // let startTime = performance.now();
// // // let timeScale = 1;      // 1 running, 0 paused
// // // let manualPhase = null; // if set (0..1), locks time

// // // // Sky gradient colors (for uniforms)
// // // const SKY_DAY_TOP    = new THREE.Color(0x89c7ff);
// // // const SKY_DAY_BOTTOM = new THREE.Color(0xcfe8ff);
// // // const SKY_NIGHT_TOP  = new THREE.Color(0x0a1330);
// // // const SKY_NIGHT_BOTTOM = new THREE.Color(0x081018);

// // // // ---- Sky shaders ----
// // // const SKY_VERT = /* glsl */`
// // //   varying vec3 vWorldDir;
// // //   void main(){
// // //     // world-space direction from dome center
// // //     vWorldDir = normalize((modelMatrix * vec4(position,1.0)).xyz);
// // //     gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
// // //   }
// // // `;

// // // const SKY_FRAG = /* glsl */`
// // //   precision highp float;
// // //   varying vec3 vWorldDir;

// // //   uniform vec3 topDay, bottomDay, topNight, bottomNight;
// // //   uniform vec3 sunDir, moonDir;
// // //   uniform float sunUp;
// // //   uniform float sunSize, sunSoftness, sunIntensity;
// // //   uniform float moonSize, moonSoftness, moonIntensity;

// // //   // soft circular disc blend
// // //   float softDisc(vec3 dir, vec3 centerDir, float size, float softness){
// // //     float cosAng = dot(normalize(dir), normalize(centerDir));
// // //     float inner = cos(size);
// // //     float outer = cos(size + softness);
// // //     float t = clamp((cosAng - outer) / max(1e-5, (inner - outer)), 0.0, 1.0);
// // //     return t;
// // //   }

// // //   void main(){
// // //     float h = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);
// // //     vec3 gradDay   = mix(bottomDay,  topDay,   h);
// // //     vec3 gradNight = mix(bottomNight, topNight, h);
// // //     vec3 baseCol   = mix(gradNight, gradDay, sunUp);

// // //     float sunMask  = softDisc(vWorldDir, sunDir,  sunSize,  sunSoftness);
// // //     vec3 sunCol    = vec3(1.0, 0.92, 0.75) * sunIntensity * sunMask;

// // //     float moonMask = softDisc(vWorldDir, moonDir, moonSize, moonSoftness);
// // //     vec3 moonCol   = vec3(0.8, 0.9, 1.0) * moonIntensity * moonMask;

// // //     gl_FragColor = vec4(baseCol + sunCol + moonCol, 1.0);
// // //   }
// // // `;

// // // // ---------- boot ----------
// // // init();
// // // animate();

// // // function init() {
// // //   scene = new THREE.Scene();

// // //   // Camera: far big enough to see the skydome
// // //   camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
// // //   camera.position.set(0, 6, 16);
// // //   camera.lookAt(0, 0, 0);
// // //   camera.updateProjectionMatrix();

// // //   // Renderer
// // //   renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
// // //   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// // //   renderer.setSize(innerWidth, innerHeight);
// // //   renderer.shadowMap.enabled = true;
// // //   renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// // //   renderer.outputColorSpace = THREE.SRGBColorSpace;
// // //   renderer.toneMapping = THREE.ACESFilmicToneMapping;
// // //   renderer.toneMappingExposure = 1.1;
// // //   renderer.setClearColor(0x000000, 1);

// // //   // Lights
// // //   ambient = new THREE.AmbientLight(0xffffff, 0.2);
// // //   scene.add(ambient);

// // //   sun = new THREE.DirectionalLight(PALETTE.day.sunColor, 1.2);
// // //   sun.castShadow = true;
// // //   sun.shadow.mapSize.set(1024, 1024);
// // //   sun.shadow.camera.near = 1;
// // //   sun.shadow.camera.far = 120;
// // //   sun.shadow.camera.left = -50;
// // //   sun.shadow.camera.right = 50;
// // //   sun.shadow.camera.top = 50;
// // //   sun.shadow.camera.bottom = -50;
// // //   scene.add(sun);

// // //   moon = new THREE.DirectionalLight(0xbfd6ff, 0.0);
// // //   scene.add(moon);

// // //   hemi = new THREE.HemisphereLight(PALETTE.night.hemiSky, PALETTE.night.hemiGround, PALETTE.night.hemiIntensity);
// // //   scene.add(hemi);

// // //   // Fog baseline (night)
// // //   scene.fog = new THREE.FogExp2(PALETTE.night.fogColor, PALETTE.night.fogDensity);

// // //   // Ground
// // //   const groundGeo = new THREE.PlaneGeometry(200, 200);
// // //   const groundMat = new THREE.MeshStandardMaterial({
// // //     color: PALETTE.night.groundColor, roughness: 1.0, metalness: 0.0
// // //   });
// // //   ground = new THREE.Mesh(groundGeo, groundMat);
// // //   ground.rotation.x = -Math.PI / 2;
// // //   ground.receiveShadow = true;
// // //   scene.add(ground);

// // //   // Test box
// // //   const testBox = new THREE.Mesh(
// // //     new THREE.BoxGeometry(2, 2, 2),
// // //     new THREE.MeshStandardMaterial({ color: 0x8aa37b })
// // //   );
// // //   testBox.position.set(0, 1, 0);
// // //   testBox.castShadow = true;
// // //   scene.add(testBox);

// // //   // Orbit controls
// // //   controls = new OrbitControls(camera, renderer.domElement);
// // //   controls.enableDamping = true;
// // //   controls.dampingFactor = 0.05;
// // //   controls.target.set(0, 1, 0);

// // //   // === Skydome ===
// // //   const skyGeo = new THREE.SphereGeometry(1000, 48, 32); // huge sphere
// // //   skyMat = new THREE.ShaderMaterial({
// // //     vertexShader: SKY_VERT,
// // //     fragmentShader: SKY_FRAG,
// // //     side: THREE.BackSide,
// // //     depthWrite: false,
// // //     fog: false,               // <- IMPORTANT: don't apply scene fog to sky
// // //     uniforms: {
// // //       topDay:       { value: SKY_DAY_TOP.clone() },
// // //       bottomDay:    { value: SKY_DAY_BOTTOM.clone() },
// // //       topNight:     { value: SKY_NIGHT_TOP.clone() },
// // //       bottomNight:  { value: SKY_NIGHT_BOTTOM.clone() },
// // //       sunDir:       { value: new THREE.Vector3(0,1,0) },
// // //       moonDir:      { value: new THREE.Vector3(0,-1,0) },
// // //       sunUp:        { value: 0.0 },
// // //       sunSize:      { value: 0.07 },
// // //       sunSoftness:  { value: 0.03 },
// // //       sunIntensity: { value: 1.5 },
// // //       moonSize:     { value: 0.05 },
// // //       moonSoftness: { value: 0.03 },
// // //       moonIntensity:{ value: 1.0 },
// // //     }
// // //   });
// // //   skyDome = new THREE.Mesh(skyGeo, skyMat);
// // //   scene.add(skyDome);

// // //   // Resize + UI
// // //   addEventListener('resize', onResize);
// // //   setupLiveTuning();
// // //   setLightingMood('night');
// // //   updateDebugUI();

// // //   // Quick palette keys
// // //   addEventListener('keydown', (ev) => {
// // //     if (ev.key === 'n' || ev.key === 'N') { setLightingMood('night'); updateDebugUI(); }
// // //     if (ev.key === 'm' || ev.key === 'M') { setLightingMood('day');   updateDebugUI(); }
// // //   });

// // //   // Time control keys
// // //   window.addEventListener('keydown', (e) => {
// // //     if (e.key === 'p' || e.key === 'P') timeScale = (timeScale === 0 ? 1 : 0);
// // //     if (e.key === 'u' || e.key === 'U') manualPhase = 0.00;
// // //     if (e.key === 'o' || e.key === 'O') manualPhase = 0.25;
// // //     if (e.key === 'y' || e.key === 'Y') manualPhase = 0.50;
// // //     if (e.key === 'i' || e.key === 'I') manualPhase = 0.75;
// // //     if (e.key === 'r' || e.key === 'R') manualPhase = null;
// // //     updateDebugUI();
// // //   });
// // // }

// // // function setLightingMood(mode) {
// // //   const p = PALETTE[mode];
// // //   if (!p) return;

// // //   if (!scene.fog) scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
// // //   scene.fog.color.setHex(p.fogColor);
// // //   scene.fog.density = p.fogDensity;

// // //   ambient.color.setHex(p.ambientColor);
// // //   ambient.intensity = p.ambientIntensity;

// // //   sun.color.setHex(p.sunColor);
// // //   sun.intensity = p.sunIntensity; // baseline

// // //   hemi.color.setHex(p.hemiSky);
// // //   hemi.groundColor.setHex(p.hemiGround);
// // //   hemi.intensity = p.hemiIntensity;

// // //   renderer.toneMappingExposure = p.exposure;
// // //   ground.material.color.setHex(p.groundColor);
// // // }

// // // // ---- Day–Night animation core ----
// // // function updateDayNight(timeSec) {
// // //   const phase = (timeSec % DAY_LENGTH) / DAY_LENGTH;
// // //   const ang   = phase * Math.PI * 2;

// // //   // move lights on a circle
// // //   sun.position.set(Math.cos(ang) * SKY_RADIUS,  Math.sin(ang) * SKY_RADIUS,  0);
// // //   moon.position.set(Math.cos(ang + Math.PI) * SKY_RADIUS, Math.sin(ang + Math.PI) * SKY_RADIUS, 0);

// // //   const sunUp  = Math.max(0, Math.sin(ang));
// // //   const moonUp = Math.max(0, Math.sin(ang + Math.PI));

// // //   // intensities
// // //   sun.intensity  = THREE.MathUtils.lerp(0.0, PALETTE.day.sunIntensity,   sunUp);
// // //   moon.intensity = THREE.MathUtils.lerp(0.0, PALETTE.night.sunIntensity, moonUp);

// // //   // smooth weights
// // //   const wAmb = THREE.MathUtils.smoothstep(sunUp, 0.05, 0.35);
// // //   const wExp = THREE.MathUtils.smoothstep(sunUp, 0.15, 0.70);
// // //   const wFog = THREE.MathUtils.smoothstep(sunUp, 0.20, 0.80);

// // //   // ambient + colors
// // //   ambient.intensity = THREE.MathUtils.lerp(PALETTE.night.ambientIntensity, PALETTE.day.ambientIntensity, wAmb);
// // //   ambient.color.lerpColors(new THREE.Color(PALETTE.night.ambientColor), new THREE.Color(PALETTE.day.ambientColor), wAmb);

// // //   // fog
// // //   scene.fog.color.lerpColors(new THREE.Color(PALETTE.night.fogColor), new THREE.Color(PALETTE.day.fogColor), wFog);
// // //   scene.fog.density = THREE.MathUtils.lerp(PALETTE.night.fogDensity, PALETTE.day.fogDensity, wFog);

// // //   // exposure
// // //   renderer.toneMappingExposure = THREE.MathUtils.lerp(PALETTE.night.exposure, PALETTE.day.exposure, wExp);

// // //   // hemisphere
// // //   hemi.intensity = THREE.MathUtils.lerp(PALETTE.night.hemiIntensity, PALETTE.day.hemiIntensity, wAmb);
// // //   hemi.color.lerpColors(new THREE.Color(PALETTE.night.hemiSky), new THREE.Color(PALETTE.day.hemiSky), wAmb);
// // //   hemi.groundColor.lerpColors(new THREE.Color(PALETTE.night.hemiGround), new THREE.Color(PALETTE.day.hemiGround), wAmb);

// // //   // ground color
// // //   ground.material.color.copy(new THREE.Color(PALETTE.night.groundColor)).lerp(new THREE.Color(PALETTE.day.groundColor), wAmb);

// // //   // --- Skydome uniforms ---
// // //   const sunDir  = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).normalize();
// // //   const moonDir = new THREE.Vector3(Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), 0).normalize();
// // //   if (skyMat) {
// // //     skyMat.uniforms.sunDir.value.copy(sunDir);
// // //     skyMat.uniforms.moonDir.value.copy(moonDir);
// // //     skyMat.uniforms.sunUp.value = sunUp;
// // //     skyMat.uniforms.sunIntensity.value  = THREE.MathUtils.lerp(0.0, 1.5, sunUp);
// // //     skyMat.uniforms.moonIntensity.value = THREE.MathUtils.lerp(1.0, 0.0, sunUp);
// // //   }

// // //   // debug
// // //   _lastDebug.sunUp = sunUp; _lastDebug.wAmb = wAmb; _lastDebug.wExp = wExp; _lastDebug.wFog = wFog;
// // // }

// // // // ---- Render loop ----
// // // function animate() {
// // //   requestAnimationFrame(animate);
// // //   const elapsed = (performance.now() - startTime) / 1000;
// // //   const t = (manualPhase !== null) ? manualPhase * DAY_LENGTH : elapsed * timeScale;

// // //   updateDayNight(t);

// // //   // keep dome centered on camera so it never clips
// // //   if (skyDome) skyDome.position.copy(camera.position);

// // //   updateDebugUI();
// // //   controls.update();
// // //   renderer.render(scene, camera);
// // // }

// // // function onResize() {
// // //   camera.aspect = innerWidth / innerHeight;
// // //   camera.updateProjectionMatrix();
// // //   renderer.setSize(innerWidth, innerHeight);
// // // }

// // // /* ---------- Debug overlay ---------- */
// // // function setupLiveTuning() {
// // //   debugEl = document.createElement('div');
// // //   debugEl.id = 'debug-look';
// // //   debugEl.style.cssText = `
// // //     position:fixed; left:8px; bottom:8px; z-index:9999;
// // //     color:#9fb6d1; background:#0008; padding:6px 8px; border-radius:6px;
// // //     font:12px/1.3 monospace; user-select:none; pointer-events:none;
// // //     white-space:pre;
// // //   `;
// // //   document.body.appendChild(debugEl);

// // //   addEventListener('keydown', (ev) => {
// // //     let changed = true;
// // //     switch (ev.key) {
// // //       case '[': scene.fog.density = clamp(scene.fog.density - 0.001, 0.005, 0.05); break;
// // //       case ']': scene.fog.density = clamp(scene.fog.density + 0.001, 0.005, 0.05); break;
// // //       case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.5, 2.0); break;
// // //       case '=': case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.5, 2.0); break;
// // //       case '1': ambient.intensity = clamp(ambient.intensity - 0.02, 0.0, 1.0); break;
// // //       case '2': ambient.intensity = clamp(ambient.intensity + 0.02, 0.0, 1.0); break;
// // //       case '3': sun.intensity = clamp(sun.intensity - 0.05, 0.0, 3.0); break;
// // //       case '4': sun.intensity = clamp(sun.intensity + 0.05, 0.0, 3.0); break;
// // //       default: changed = false;
// // //     }
// // //     if (changed) updateDebugUI();
// // //   });
// // // }

// // // function updateDebugUI() {
// // //   if (!debugEl) return;
// // //   const { sunUp, wAmb, wExp, wFog } = _lastDebug;
// // //   debugEl.textContent =
// // //     `fog: ${scene.fog.density.toFixed(3)}  |  exp: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
// // //     `amb: ${ambient.intensity.toFixed(2)}  |  sun: ${sun.intensity.toFixed(2)}\n` +
// // //     `sunUp: ${sunUp.toFixed(2)}  |  wAmb: ${wAmb.toFixed(2)}  |  wExp: ${wExp.toFixed(2)}  |  wFog: ${wFog.toFixed(2)}\n` +
// // //     `[N]ight / [M]orning — [ ]  - =  1 2 3 4  |  [P]ause  [U]Dawn  [O]Noon  [Y]Dusk  [I]Midnight  [R]eal-time`;
// // // }

// // // function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// // // Import Three.js core and OrbitControls
// // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// // let scene, camera, renderer, controls;
// // let ambient, sun, moon, hemi;
// // let ground;
// // let debugEl;
// // let skyDome, skyMat;

// // // debug cache for overlay (step 2.2.1)
// // const _lastDebug = { sunUp: 0, wAmb: 0, wExp: 0, wFog: 0 };

// // // === Palettes (step 2.2.1 tuned endpoints) ===
// // const PALETTE = {
// //   night: {
// //     fogColor: 0x0a1220, fogDensity: 0.025,
// //     ambientColor: 0xb1c0d4, ambientIntensity: 0.14,
// //     sunColor: 0xbfd6ff, sunIntensity: 1.0,
// //     hemiSky: 0x1a2738, hemiGround: 0x141414, hemiIntensity: 0.06,
// //     groundColor: 0x20261b, exposure: 1.00
// //   },
// //   day: {
// //     fogColor: 0xd7dee6, fogDensity: 0.010,
// //     ambientColor: 0xfff0d0, ambientIntensity: 0.38,
// //     sunColor: 0xffe6b3, sunIntensity: 1.7,
// //     hemiSky: 0xcfe4ff, hemiGround: 0xb0b6aa, hemiIntensity: 0.18,
// //     groundColor: 0x4b5a39, exposure: 1.18
// //   }
// // };

// // // ---- Day–Night constants ----
// // const DAY_LENGTH = 120;   // seconds for a full cycle
// // const SKY_RADIUS = 120;

// // // ---- Time driver ----
// // let startTime = performance.now();
// // let timeScale = 1;      // 1=running, 0=paused
// // let manualPhase = null; // if set (0..1), locks time to that phase

// // // === SkyDome gradient colors ===
// // const SKY_DAY_TOP    = new THREE.Color(0x89c7ff);
// // const SKY_DAY_BOTTOM = new THREE.Color(0xcfe8ff);
// // const SKY_NIGHT_TOP  = new THREE.Color(0x0a1330);
// // const SKY_NIGHT_BOTTOM = new THREE.Color(0x081018);

// // // ====== SkyDome Shaders (with height-fog + sun/moon discs) ======
// // const SKY_VERT = /* glsl */`
// //   varying vec3 vWorldPos;
// //   void main() {
// //     vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
// //     gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
// //   }
// // `;

// // const SKY_FRAG = /* glsl */`
// //   precision highp float;
// //   varying vec3 vWorldPos;

// //   uniform vec3 uCamPos;

// //   uniform vec3 topDay;
// //   uniform vec3 bottomDay;
// //   uniform vec3 topNight;
// //   uniform vec3 bottomNight;

// //   uniform vec3 sunDir;
// //   uniform vec3 moonDir;
// //   uniform float sunUp; // 0..1, used as day weight

// //   uniform float sunSize;
// //   uniform float sunSoftness;
// //   uniform float sunIntensity;

// //   uniform float moonSize;
// //   uniform float moonSoftness;
// //   uniform float moonIntensity;

// //   uniform vec3  uFogColor;
// //   uniform float uFogDensity; // sky fog density (scaled from scene fog)
// //   uniform float uFogHeight;  // how quickly it clears with altitude
// //   uniform float uGroundY;

// //   // soft circular disc with feathered edge
// //   float softDisc(vec3 dir, vec3 centerDir, float size, float softness){
// //     float cosAng = dot(normalize(dir), normalize(centerDir));
// //     float inner = cos(size);
// //     float outer = cos(size + softness);
// //     float t = clamp((cosAng - outer) / max(1e-5, (inner - outer)), 0.0, 1.0);
// //     return t;
// //   }

// //   void main() {
// //     // sky ray direction from camera
// //     vec3 dir = normalize(vWorldPos - uCamPos);

// //     // base gradient: lerp night<->day by sunUp
// //     float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
// //     vec3 gradDay   = mix(bottomDay,  topDay,   h);
// //     vec3 gradNight = mix(bottomNight, topNight, h);
// //     vec3 baseCol   = mix(gradNight, gradDay, sunUp);

// //     // sun & moon discs
// //     float sunMask  = softDisc(dir,  sunDir,  sunSize,  sunSoftness);
// //     vec3  sunCol   = vec3(1.0, 0.92, 0.75) * sunIntensity * sunMask;

// //     float moonMask = softDisc(dir, moonDir, moonSize, moonSoftness);
// //     vec3  moonCol  = vec3(0.8, 0.9, 1.0) * moonIntensity * moonMask;

// //     // simple height-fog in the sky: stronger near horizon (dir.y small)
// //     float viewY = max(0.0, dir.y);
// //     float fogFactor = exp(-uFogDensity * (viewY * uFogHeight));
// //     baseCol = mix(uFogColor, baseCol, fogFactor);

// //     gl_FragColor = vec4(baseCol + sunCol + moonCol, 1.0);
// //   }
// // `;

// // // ---------- boot ----------
// // init();
// // animate();

// // function init() {
// //   scene = new THREE.Scene();

// //   // Camera: far big enough to see the skydome
// //   camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
// //   camera.position.set(0, 6, 16);
// //   camera.lookAt(0, 0, 0);
// //   camera.updateProjectionMatrix();

// //   // Renderer
// //   renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
// //   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// //   renderer.setSize(innerWidth, innerHeight);
// //   renderer.shadowMap.enabled = true;
// //   renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// //   renderer.outputColorSpace = THREE.SRGBColorSpace;
// //   renderer.toneMapping = THREE.ACESFilmicToneMapping;
// //   renderer.toneMappingExposure = 1.1;
// //   renderer.setClearColor(0x000000, 1);

// //   // Lights
// //   ambient = new THREE.AmbientLight(0xffffff, 0.2);
// //   scene.add(ambient);

// //   sun = new THREE.DirectionalLight(PALETTE.day.sunColor, 1.2);
// //   sun.castShadow = true;
// //   sun.shadow.mapSize.set(1024, 1024);
// //   sun.shadow.camera.near = 1;
// //   sun.shadow.camera.far = 120;
// //   sun.shadow.camera.left = -50;
// //   sun.shadow.camera.right = 50;
// //   sun.shadow.camera.top = 50;
// //   sun.shadow.camera.bottom = -50;
// //   scene.add(sun);

// //   moon = new THREE.DirectionalLight(0xbfd6ff, 0.0);
// //   scene.add(moon);

// //   hemi = new THREE.HemisphereLight(PALETTE.night.hemiSky, PALETTE.night.hemiGround, PALETTE.night.hemiIntensity);
// //   scene.add(hemi);

// //   // Fog baseline (night)
// //   scene.fog = new THREE.FogExp2(PALETTE.night.fogColor, PALETTE.night.fogDensity);

// //   // Ground
// //   const groundGeo = new THREE.PlaneGeometry(200, 200);
// //   const groundMat = new THREE.MeshStandardMaterial({
// //     color: PALETTE.night.groundColor, roughness: 1.0, metalness: 0.0
// //   });
// //   ground = new THREE.Mesh(groundGeo, groundMat);
// //   ground.rotation.x = -Math.PI / 2;
// //   ground.receiveShadow = true;
// //   scene.add(ground);

// //   // Test box
// //   const testBox = new THREE.Mesh(
// //     new THREE.BoxGeometry(2, 2, 2),
// //     new THREE.MeshStandardMaterial({ color: 0x8aa37b })
// //   );
// //   testBox.position.set(0, 1, 0);
// //   testBox.castShadow = true;
// //   scene.add(testBox);

// //   // Orbit controls
// //   controls = new OrbitControls(camera, renderer.domElement);
// //   controls.enableDamping = true;
// //   controls.dampingFactor = 0.05;
// //   controls.target.set(0, 1, 0);

// //   // === Skydome ===
// //   const skyGeo = new THREE.SphereGeometry(1000, 48, 32); // huge sphere
// //   skyMat = new THREE.ShaderMaterial({
// //     vertexShader: SKY_VERT,
// //     fragmentShader: SKY_FRAG,
// //     side: THREE.BackSide,
// //     depthWrite: false,
// //     depthTest: false,   // always draw behind
// //     fog: false,         // IMPORTANT: don't apply scene fog to sky
// //     uniforms: {
// //       topDay:       { value: SKY_DAY_TOP.clone() },
// //       bottomDay:    { value: SKY_DAY_BOTTOM.clone() },
// //       topNight:     { value: SKY_NIGHT_TOP.clone() },
// //       bottomNight:  { value: SKY_NIGHT_BOTTOM.clone() },
// //       sunDir:       { value: new THREE.Vector3(0,1,0) },
// //       moonDir:      { value: new THREE.Vector3(0,-1,0) },
// //       sunUp:        { value: 0.0 },
// //       sunSize:      { value: 0.07 },
// //       sunSoftness:  { value: 0.03 },
// //       sunIntensity: { value: 1.5 },
// //       moonSize:     { value: 0.05 },
// //       moonSoftness: { value: 0.03 },
// //       moonIntensity:{ value: 1.0 },
// //       uFogColor:    { value: scene.fog.color.clone() },
// //       uFogDensity:  { value: scene.fog.density * 12.0 },
// //       uFogHeight:   { value: 40.0 },
// //       uGroundY:     { value: 0.0 },
// //       uCamPos:      { value: new THREE.Vector3() }
// //     }
// //   });
// //   skyDome = new THREE.Mesh(skyGeo, skyMat);
// //   skyDome.renderOrder = -9999;
// //   scene.add(skyDome);

// //   // Resize + UI
// //   addEventListener('resize', onResize);
// //   setupLiveTuning();
// //   setLightingMood('night');
// //   updateDebugUI();

// //   // Quick palette keys
// //   addEventListener('keydown', (ev) => {
// //     if (ev.key === 'n' || ev.key === 'N') { setLightingMood('night'); updateDebugUI(); }
// //     if (ev.key === 'm' || ev.key === 'M') { setLightingMood('day');   updateDebugUI(); }
// //   });

// //   // Time control keys
// //   window.addEventListener('keydown', (e) => {
// //     if (e.key === 'p' || e.key === 'P') timeScale = (timeScale === 0 ? 1 : 0);
// //     if (e.key === 'u' || e.key === 'U') manualPhase = 0.00;
// //     if (e.key === 'o' || e.key === 'O') manualPhase = 0.25;
// //     if (e.key === 'y' || e.key === 'Y') manualPhase = 0.50;
// //     if (e.key === 'i' || e.key === 'I') manualPhase = 0.75;
// //     if (e.key === 'r' || e.key === 'R') manualPhase = null;
// //     updateDebugUI();
// //   });
// // }

// // function setLightingMood(mode) {
// //   const p = PALETTE[mode];
// //   if (!p) return;

// //   if (!scene.fog) scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
// //   scene.fog.color.setHex(p.fogColor);
// //   scene.fog.density = p.fogDensity;

// //   ambient.color.setHex(p.ambientColor);
// //   ambient.intensity = p.ambientIntensity;

// //   sun.color.setHex(p.sunColor);
// //   sun.intensity = p.sunIntensity; // baseline (will be animated each frame)

// //   hemi.color.setHex(p.hemiSky);
// //   hemi.groundColor.setHex(p.hemiGround);
// //   hemi.intensity = p.hemiIntensity;

// //   renderer.toneMappingExposure = p.exposure;
// //   ground.material.color.setHex(p.groundColor);
// // }

// // // ---- Day–Night animation core (2.2.1 smoothstep + 2.2.2 sky uniforms) ----
// // function updateDayNight(timeSec) {
// //   const phase = (timeSec % DAY_LENGTH) / DAY_LENGTH;
// //   const ang   = phase * Math.PI * 2;

// //   // move lights on a circle
// //   sun.position.set(Math.cos(ang) * SKY_RADIUS,  Math.sin(ang) * SKY_RADIUS,  0);
// //   moon.position.set(Math.cos(ang + Math.PI) * SKY_RADIUS, Math.sin(ang + Math.PI) * SKY_RADIUS, 0);

// //   const sunUp  = Math.max(0, Math.sin(ang));
// //   const moonUp = Math.max(0, Math.sin(ang + Math.PI));

// //   // intensities
// //   sun.intensity  = THREE.MathUtils.lerp(0.0, PALETTE.day.sunIntensity,   sunUp);
// //   moon.intensity = THREE.MathUtils.lerp(0.0, PALETTE.night.sunIntensity, moonUp);

// //   // smooth weights (so each channel changes in its own window)
// //   const wAmb = THREE.MathUtils.smoothstep(sunUp, 0.05, 0.35);
// //   const wExp = THREE.MathUtils.smoothstep(sunUp, 0.15, 0.70);
// //   const wFog = THREE.MathUtils.smoothstep(sunUp, 0.20, 0.80);

// //   // ambient + colors
// //   ambient.intensity = THREE.MathUtils.lerp(PALETTE.night.ambientIntensity, PALETTE.day.ambientIntensity, wAmb);
// //   ambient.color.lerpColors(new THREE.Color(PALETTE.night.ambientColor), new THREE.Color(PALETTE.day.ambientColor), wAmb);

// //   // fog
// //   scene.fog.color.lerpColors(new THREE.Color(PALETTE.night.fogColor), new THREE.Color(PALETTE.day.fogColor), wFog);
// //   scene.fog.density = THREE.MathUtils.lerp(PALETTE.night.fogDensity, PALETTE.day.fogDensity, wFog);

// //   // exposure
// //   renderer.toneMappingExposure = THREE.MathUtils.lerp(PALETTE.night.exposure, PALETTE.day.exposure, wExp);

// //   // hemisphere
// //   hemi.intensity = THREE.MathUtils.lerp(PALETTE.night.hemiIntensity, PALETTE.day.hemiIntensity, wAmb);
// //   hemi.color.lerpColors(new THREE.Color(PALETTE.night.hemiSky), new THREE.Color(PALETTE.day.hemiSky), wAmb);
// //   hemi.groundColor.lerpColors(new THREE.Color(PALETTE.night.hemiGround), new THREE.Color(PALETTE.day.hemiGround), wAmb);

// //   // ground color
// //   ground.material.color.copy(new THREE.Color(PALETTE.night.groundColor)).lerp(new THREE.Color(PALETTE.day.groundColor), wAmb);

// //   // --- Skydome uniforms (sun/moon discs + sky height-fog) ---
// //   const sunDir  = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).normalize();
// //   const moonDir = new THREE.Vector3(Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), 0).normalize();
// //   if (skyMat) {
// //     skyMat.uniforms.sunDir.value.copy(sunDir);
// //     skyMat.uniforms.moonDir.value.copy(moonDir);
// //     skyMat.uniforms.sunUp.value = sunUp;
// //     skyMat.uniforms.sunIntensity.value  = THREE.MathUtils.lerp(0.0, 1.5, sunUp);
// //     skyMat.uniforms.moonIntensity.value = THREE.MathUtils.lerp(1.0, 0.0, sunUp);

// //     // tie sky-fog to scene fog, denser near night, lower at night for thicker near-ground layer
// //     skyMat.uniforms.uFogColor.value.copy(scene.fog.color);
// //     skyMat.uniforms.uFogDensity.value = scene.fog.density * 12.0;
// //     skyMat.uniforms.uFogHeight.value  = THREE.MathUtils.lerp(55.0, 35.0, wAmb); // higher by day, lower at night
// //   }

// //   // debug numbers for overlay
// //   _lastDebug.sunUp = sunUp; _lastDebug.wAmb = wAmb; _lastDebug.wExp = wExp; _lastDebug.wFog = wFog;
// // }

// // // ---- Render loop ----
// // function animate() {
// //   requestAnimationFrame(animate);

// //   // keep dome centered on camera so it never clips
// //   if (skyDome) skyDome.position.copy(camera.position);
// //   if (skyMat)  skyMat.uniforms.uCamPos.value.copy(camera.position);

// //   const elapsed = (performance.now() - startTime) / 1000;
// //   const t = (manualPhase !== null) ? manualPhase * DAY_LENGTH : elapsed * timeScale;

// //   updateDayNight(t);
// //   updateDebugUI();
// //   controls.update();
// //   renderer.render(scene, camera);
// // }

// // function onResize() {
// //   camera.aspect = innerWidth / innerHeight;
// //   camera.updateProjectionMatrix();
// //   renderer.setSize(innerWidth, innerHeight);
// // }

// // /* ---------- Debug overlay + hotkeys (from 2.2.1) ---------- */
// // function setupLiveTuning() {
// //   debugEl = document.createElement('div');
// //   debugEl.id = 'debug-look';
// //   debugEl.style.cssText = `
// //     position:fixed; left:8px; bottom:8px; z-index:9999;
// //     color:#9fb6d1; background:#0008; padding:6px 8px; border-radius:6px;
// //     font:12px/1.3 monospace; user-select:none; pointer-events:none;
// //     white-space:pre;
// //   `;
// //   document.body.appendChild(debugEl);

// //   addEventListener('keydown', (ev) => {
// //     let changed = true;
// //     switch (ev.key) {
// //       case '[': scene.fog.density = clamp(scene.fog.density - 0.001, 0.005, 0.05); break;
// //       case ']': scene.fog.density = clamp(scene.fog.density + 0.001, 0.005, 0.05); break;
// //       case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.5, 2.0); break;
// //       case '=':
// //       case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.5, 2.0); break;
// //       case '1': ambient.intensity = clamp(ambient.intensity - 0.02, 0.0, 1.0); break;
// //       case '2': ambient.intensity = clamp(ambient.intensity + 0.02, 0.0, 1.0); break;
// //       case '3': sun.intensity = clamp(sun.intensity - 0.05, 0.0, 3.0); break;
// //       case '4': sun.intensity = clamp(sun.intensity + 0.05, 0.0, 3.0); break;
// //       default: changed = false;
// //     }
// //     if (changed) updateDebugUI();
// //   });
// // }

// // function updateDebugUI() {
// //   if (!debugEl) return;
// //   const { sunUp, wAmb, wExp, wFog } = _lastDebug;
// //   debugEl.textContent =
// //     `fog: ${scene.fog.density.toFixed(3)}  |  exp: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
// //     `amb: ${ambient.intensity.toFixed(2)}  |  sun: ${sun.intensity.toFixed(2)}\n` +
// //     `sunUp: ${sunUp.toFixed(2)}  |  wAmb: ${wAmb.toFixed(2)}  |  wExp: ${wExp.toFixed(2)}  |  wFog: ${wFog.toFixed(2)}\n` +
// //     `[N]ight / [M]orning — [ ]  - =  1 2 3 4  |  [P]ause  [U]Dawn  [O]Noon  [Y]Dusk  [I]Midnight  [R]eal-time`;
// // }

// // function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }


// // Import Three.js core and OrbitControls
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// let scene, camera, renderer, controls;
// let ambient, sun, moon, hemi;
// let ground;
// let debugEl;
// let skyDome, skyMat;

// // Debug cache for overlay
// const _dbg = { sunUp:0, wAmb:0, wExp:0, wFog:0, uFogH:0, uFogD:0 };

// // === Palettes (night/day endpoints) ===
// const PALETTE = {
//   night: {
//     fogColor: 0x0a1220, fogDensity: 0.025,
//     ambientColor: 0xb1c0d4, ambientIntensity: 0.14,
//     sunColor: 0xbfd6ff, sunIntensity: 1.0,
//     hemiSky: 0x1a2738, hemiGround: 0x141414, hemiIntensity: 0.06,
//     groundColor: 0x20261b, exposure: 1.00
//   },
//   day: {
//     fogColor: 0xd7dee6, fogDensity: 0.010,
//     ambientColor: 0xfff0d0, ambientIntensity: 0.38,
//     sunColor: 0xffe6b3, sunIntensity: 1.7,
//     hemiSky: 0xcfe4ff, hemiGround: 0xb0b6aa, hemiIntensity: 0.18,
//     groundColor: 0x4b5a39, exposure: 1.18
//   }
// };

// // ---- Day–Night constants ----
// const DAY_LENGTH = 120;   // seconds for a full cycle
// const SKY_RADIUS = 120;

// // ---- Time driver ----
// let startTime = performance.now();
// let timeScale = 1;
// let manualPhase = null;

// // === SkyDome gradient colors ===
// const SKY_DAY_TOP    = new THREE.Color(0x89c7ff);
// const SKY_DAY_BOTTOM = new THREE.Color(0xcfe8ff);
// const SKY_NIGHT_TOP  = new THREE.Color(0x0a1330);
// const SKY_NIGHT_BOTTOM = new THREE.Color(0x081018);

// // === Fog preset controller (keys F1/F2/F3) ===
// const FogPreset = {
//   multiplier: 1.0,     // scala globale densità cielo
//   heightDay:  55.0,    // altezza foschia a mezzogiorno
//   heightNight:35.0,    // altezza foschia a mezzanotte
//   densityBoost: 12.0   // fattore che mappa sceneFogDensity -> skyFogDensity
// };

// // GLSL Shaders (sky with discs + height-fog)
// const SKY_VERT = /* glsl */`
//   varying vec3 vWorldPos;
//   void main() {
//     vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
//     gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
//   }
// `;

// const SKY_FRAG = /* glsl */`
//   precision highp float;
//   varying vec3 vWorldPos;

//   uniform vec3 uCamPos;

//   uniform vec3 topDay;
//   uniform vec3 bottomDay;
//   uniform vec3 topNight;
//   uniform vec3 bottomNight;

//   uniform vec3 sunDir;
//   uniform vec3 moonDir;
//   uniform float sunUp;

//   uniform float sunSize;
//   uniform float sunSoftness;
//   uniform float sunIntensity;

//   uniform float moonSize;
//   uniform float moonSoftness;
//   uniform float moonIntensity;

//   uniform vec3  uFogColor;
//   uniform float uFogDensity;
//   uniform float uFogHeight;
//   uniform float uGroundY;

//   // soft circular disc blend
//   float softDisc(vec3 dir, vec3 centerDir, float size, float softness){
//     float cosAng = dot(normalize(dir), normalize(centerDir));
//     float inner = cos(size);
//     float outer = cos(size + softness);
//     float t = clamp((cosAng - outer) / max(1e-5, (inner - outer)), 0.0, 1.0);
//     return t;
//   }

//   void main() {
//     vec3 dir = normalize(vWorldPos - uCamPos);

//     // gradiente base
//     float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
//     vec3 gradDay   = mix(bottomDay,  topDay,   h);
//     vec3 gradNight = mix(bottomNight, topNight, h);
//     vec3 baseCol   = mix(gradNight, gradDay, sunUp);

//     // dischi (sole/luna)
//     float sunMask  = softDisc(dir, sunDir,  sunSize,  sunSoftness);
//     vec3  sunCol   = vec3(1.0, 0.92, 0.75) * sunIntensity * sunMask;

//     float moonMask = softDisc(dir, moonDir, moonSize, moonSoftness);
//     vec3  moonCol  = vec3(0.8, 0.9, 1.0)   * moonIntensity * moonMask;

//     // Height-fog nel cielo: più guardi verso l’orizzonte (dir.y basso),
//     // più la foschia “copre” il gradiente.
//     float viewUp = max(0.0, dir.y);                   // 0 all’orizzonte, 1 verso lo zenit
//     float fogFactor = exp(-uFogDensity * (viewUp * uFogHeight));
//     vec3 fogged = mix(uFogColor, baseCol, fogFactor);

//     gl_FragColor = vec4(fogged + sunCol + moonCol, 1.0);
//   }
// `;

// init();
// animate();

// function init() {
//   scene = new THREE.Scene();

//   camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
//   camera.position.set(0, 6, 16);
//   camera.lookAt(0, 0, 0);

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
//   renderer.setClearColor(0x000000, 1);

//   // Lights
//   ambient = new THREE.AmbientLight(0xffffff, 0.2);
//   scene.add(ambient);

//   sun = new THREE.DirectionalLight(PALETTE.day.sunColor, 1.2);
//   sun.castShadow = true;
//   sun.shadow.mapSize.set(1024, 1024);
//   sun.shadow.camera.near = 1;
//   sun.shadow.camera.far = 120;
//   sun.shadow.camera.left = -50;
//   sun.shadow.camera.right = 50;
//   sun.shadow.camera.top = 50;
//   sun.shadow.camera.bottom = -50;
//   scene.add(sun);

//   moon = new THREE.DirectionalLight(0xbfd6ff, 0.0);
//   scene.add(moon);

//   hemi = new THREE.HemisphereLight(PALETTE.night.hemiSky, PALETTE.night.hemiGround, PALETTE.night.hemiIntensity);
//   scene.add(hemi);

//   // Fog baseline (night)
//   scene.fog = new THREE.FogExp2(PALETTE.night.fogColor, PALETTE.night.fogDensity);

//   // Ground
//   const groundGeo = new THREE.PlaneGeometry(200, 200);
//   const groundMat = new THREE.MeshStandardMaterial({
//     color: PALETTE.night.groundColor, roughness: 1.0, metalness: 0.0
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

//   // Orbit controls
//   controls = new OrbitControls(camera, renderer.domElement);
//   controls.enableDamping = true;
//   controls.dampingFactor = 0.05;
//   controls.target.set(0, 1, 0);

//   // === Skydome ===
//   const skyGeo = new THREE.SphereGeometry(1000, 48, 32); // huge sphere, always around camera
//   skyMat = new THREE.ShaderMaterial({
//     vertexShader: SKY_VERT,
//     fragmentShader: SKY_FRAG,
//     side: THREE.BackSide,
//     depthWrite: false,
//     depthTest: false,
//     fog: false, // non applicare la scene fog allo sky
//     uniforms: {
//       topDay:       { value: SKY_DAY_TOP.clone() },
//       bottomDay:    { value: SKY_DAY_BOTTOM.clone() },
//       topNight:     { value: SKY_NIGHT_TOP.clone() },
//       bottomNight:  { value: SKY_NIGHT_BOTTOM.clone() },
//       sunDir:       { value: new THREE.Vector3(0,1,0) },
//       moonDir:      { value: new THREE.Vector3(0,-1,0) },
//       sunUp:        { value: 0.0 },
//       sunSize:      { value: 0.07 },
//       sunSoftness:  { value: 0.03 },
//       sunIntensity: { value: 1.5 },
//       moonSize:     { value: 0.05 },
//       moonSoftness: { value: 0.03 },
//       moonIntensity:{ value: 1.0 },
//       uFogColor:    { value: new THREE.Color(scene.fog.color) },
//       uFogDensity:  { value: scene.fog.density * FogPreset.densityBoost * FogPreset.multiplier },
//       uFogHeight:   { value: FogPreset.heightNight },
//       uGroundY:     { value: 0.0 },
//       uCamPos:      { value: new THREE.Vector3() }
//     }
//   });
//   skyDome = new THREE.Mesh(skyGeo, skyMat);
//   skyDome.renderOrder = -9999;
//   scene.add(skyDome);

//   // Resize + UI
//   addEventListener('resize', onResize);
//   setupLiveTuning();
//   setLightingMood('night');
//   setupPresetKeys();
//   updateDebugUI();
// }

// // Apply palette instantly (for N/M toggles only)
// function setLightingMood(mode) {
//   const p = PALETTE[mode];
//   if (!p) return;

//   if (!scene.fog) scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
//   scene.fog.color.setHex(p.fogColor);
//   scene.fog.density = p.fogDensity;

//   ambient.color.setHex(p.ambientColor);
//   ambient.intensity = p.ambientIntensity;

//   sun.color.setHex(p.sunColor);
//   sun.intensity = p.sunIntensity; // baseline, poi animata

//   hemi.color.setHex(p.hemiSky);
//   hemi.groundColor.setHex(p.hemiGround);
//   hemi.intensity = p.hemiIntensity;

//   renderer.toneMappingExposure = p.exposure;
//   ground.material.color.setHex(p.groundColor);
// }

// // ---- Helpers ----
// function smooth01(x, a, b){ // smoothstep clamped
//   const t = THREE.MathUtils.clamp((x - a) / Math.max(1e-5, (b - a)), 0, 1);
//   return t * t * (3 - 2 * t);
// }

// // ---- Day–Night animation core ----
// function updateDayNight(timeSec) {
//   const phase = (timeSec % DAY_LENGTH) / DAY_LENGTH;
//   const ang   = phase * Math.PI * 2;

//   // move lights on a circle
//   sun.position.set(Math.cos(ang) * SKY_RADIUS,  Math.sin(ang) * SKY_RADIUS,  0);
//   moon.position.set(Math.cos(ang + Math.PI) * SKY_RADIUS, Math.sin(ang + Math.PI) * SKY_RADIUS, 0);

//   const sunUp  = Math.max(0, Math.sin(ang));
//   const moonUp = Math.max(0, Math.sin(ang + Math.PI));

//   // intensities
//   sun.intensity  = THREE.MathUtils.lerp(0.0, PALETTE.day.sunIntensity,   sunUp);
//   moon.intensity = THREE.MathUtils.lerp(0.0, PALETTE.night.sunIntensity, moonUp);

//   // smooth weights (tunable edges)
//   const wAmb = smooth01(sunUp, 0.05, 0.35);
//   const wExp = smooth01(sunUp, 0.15, 0.70);
//   const wFog = smooth01(sunUp, 0.20, 0.80); // foschia cala lentamente verso il mezzogiorno

//   // ambient + colors
//   ambient.intensity = THREE.MathUtils.lerp(PALETTE.night.ambientIntensity, PALETTE.day.ambientIntensity, wAmb);
//   ambient.color.lerpColors(new THREE.Color(PALETTE.night.ambientColor), new THREE.Color(PALETTE.day.ambientColor), wAmb);

//   // fog scene (color + density)
//   const fogColNight = new THREE.Color(PALETTE.night.fogColor);
//   const fogColDay   = new THREE.Color(PALETTE.day.fogColor);
//   scene.fog.color.lerpColors(fogColNight, fogColDay, wFog);
//   scene.fog.density = THREE.MathUtils.lerp(PALETTE.night.fogDensity, PALETTE.day.fogDensity, wFog);

//   // exposure
//   renderer.toneMappingExposure = THREE.MathUtils.lerp(PALETTE.night.exposure, PALETTE.day.exposure, wExp);

//   // hemisphere
//   hemi.intensity = THREE.MathUtils.lerp(PALETTE.night.hemiIntensity, PALETTE.day.hemiIntensity, wAmb);
//   hemi.color.lerpColors(new THREE.Color(PALETTE.night.hemiSky), new THREE.Color(PALETTE.day.hemiSky), wAmb);
//   hemi.groundColor.lerpColors(new THREE.Color(PALETTE.night.hemiGround), new THREE.Color(PALETTE.day.hemiGround), wAmb);

//   // ground color
//   ground.material.color.copy(new THREE.Color(PALETTE.night.groundColor)).lerp(new THREE.Color(PALETTE.day.groundColor), wAmb);

//   // --- Skydome uniforms (coerenti con scene fog) ---
//   const sunDir  = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).normalize();
//   const moonDir = new THREE.Vector3(Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), 0).normalize();

//   if (skyMat) {
//     skyMat.uniforms.sunDir.value.copy(sunDir);
//     skyMat.uniforms.moonDir.value.copy(moonDir);
//     skyMat.uniforms.sunUp.value = sunUp;
//     skyMat.uniforms.sunIntensity.value  = THREE.MathUtils.lerp(0.0, 1.5, sunUp);
//     skyMat.uniforms.moonIntensity.value = THREE.MathUtils.lerp(1.0, 0.0, sunUp);

//     // fog cielo derivata da fog scena + preset
//     skyMat.uniforms.uFogColor.value.copy(scene.fog.color);
//     const skyDensity = scene.fog.density * FogPreset.densityBoost * FogPreset.multiplier;
//     const skyHeight  = THREE.MathUtils.lerp(FogPreset.heightNight, FogPreset.heightDay, wFog);
//     skyMat.uniforms.uFogDensity.value = skyDensity;
//     skyMat.uniforms.uFogHeight.value  = skyHeight;
//     _dbg.uFogD = skyDensity;
//     _dbg.uFogH = skyHeight;
//   }

//   // debug cache
//   _dbg.sunUp = sunUp; _dbg.wAmb = wAmb; _dbg.wExp = wExp; _dbg.wFog = wFog;
// }

// // ---- Preset keys ----
// function setupPresetKeys(){
//   window.addEventListener('keydown', (e) => {
//     if (e.key === 'F1') { // Clear Day
//       FogPreset.multiplier = 0.8;
//       FogPreset.densityBoost = 10.0;
//       FogPreset.heightDay = 60.0; FogPreset.heightNight = 40.0;
//     }
//     if (e.key === 'F2') { // Misty Dawn
//       FogPreset.multiplier = 1.2;
//       FogPreset.densityBoost = 12.0;
//       FogPreset.heightDay = 55.0; FogPreset.heightNight = 35.0;
//     }
//     if (e.key === 'F3') { // Heavy Night
//       FogPreset.multiplier = 1.6;
//       FogPreset.densityBoost = 14.0;
//       FogPreset.heightDay = 50.0; FogPreset.heightNight = 30.0;
//     }
//   });
// }

// // ---- Render loop ----
// function animate() {
//   requestAnimationFrame(animate);

//   // keep sky dome centered on camera & pass cam pos to shader
//   if (skyDome) skyDome.position.copy(camera.position);
//   if (skyMat)  skyMat.uniforms.uCamPos.value.copy(camera.position);

//   const elapsed = (performance.now() - startTime) / 1000;
//   const t = (manualPhase !== null) ? manualPhase * DAY_LENGTH : elapsed * timeScale;

//   updateDayNight(t);
//   updateDebugUI();
//   controls.update();
//   renderer.render(scene, camera);
// }

// function onResize() {
//   camera.aspect = innerWidth / innerHeight;
//   camera.updateProjectionMatrix();
//   renderer.setSize(innerWidth, innerHeight);
// }

// /* ---------- Debug overlay ---------- */
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
//     `fog: ${scene.fog.density.toFixed(3)} | exp: ${renderer.toneMappingExposure.toFixed(2)} | ` +
//     `amb: ${ambient.intensity.toFixed(2)} | sun: ${sun.intensity.toFixed(2)}\n` +
//     `sunUp: ${_dbg.sunUp.toFixed(2)} | wAmb: ${_dbg.wAmb.toFixed(2)} | wExp: ${_dbg.wExp.toFixed(2)} | wFog: ${_dbg.wFog.toFixed(2)}\n` +
//     `sky uFogDensity: ${_dbg.uFogD.toFixed(4)} | sky uFogHeight: ${_dbg.uFogH.toFixed(1)}\n` +
//     `[N]/[M] palette  |  [ ] - = 1 2 3 4 tweaks  |  [P]ause  [U]/[O]/[Y]/[I]/[R] time  |  Preset: F1/F2/F3`;
// }

// function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// Import Three.js core and OrbitControls
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let ambient, sun, moon, hemi;
let ground;
let debugEl;
let skyDome, skyMat;

// Debug cache for overlay
const _dbg = { sunUp:0, wAmb:0, wExp:0, wFog:0, uFogH:0, uFogD:0 };

// === Palettes (night/day endpoints) ===
const PALETTE = {
  night: {
    fogColor: 0x0a1220, fogDensity: 0.025,
    ambientColor: 0xb1c0d4, ambientIntensity: 0.14,
    sunColor: 0xbfd6ff, sunIntensity: 1.0,
    hemiSky: 0x1a2738, hemiGround: 0x141414, hemiIntensity: 0.06,
    groundColor: 0x20261b, exposure: 1.00
  },
  day: {
    fogColor: 0xd7dee6, fogDensity: 0.010,
    ambientColor: 0xfff0d0, ambientIntensity: 0.38,
    sunColor: 0xffe6b3, sunIntensity: 1.7,
    hemiSky: 0xcfe4ff, hemiGround: 0xb0b6aa, hemiIntensity: 0.18,
    groundColor: 0x4b5a39, exposure: 1.18
  }
};

// ---- Day–Night constants ----
const DAY_LENGTH = 120;   // seconds for a full cycle
const SKY_RADIUS  = 120;

// ---- Time driver ----
let startTime = performance.now();
let timeScale = 1;
let manualPhase = null;

// === SkyDome gradient colors ===
// bottom uguale al fog → nessuna banda sull’orizzonte
const FOG_DAY   = new THREE.Color(PALETTE.day.fogColor);
const FOG_NIGHT = new THREE.Color(PALETTE.night.fogColor);

const SKY_DAY_TOP    = new THREE.Color(0x89c7ff);
const SKY_DAY_BOTTOM = FOG_DAY.clone();
const SKY_NIGHT_TOP  = new THREE.Color(0x0a1330);
const SKY_NIGHT_BOTTOM = FOG_NIGHT.clone();

// === Fog preset controller (tasti F1/F2/F3) ===
const FogPreset = {
  multiplier: 1.0,     // scala globale densità cielo
  heightDay:  55.0,    // altezza foschia a mezzogiorno
  heightNight:35.0,    // altezza foschia a mezzanotte
  densityBoost: 12.0,  // mappa sceneFogDensity -> skyFogDensity
  horizonWidth: 0.32,  // larghezza fascia orizzonte nello shader
  horizonPower: 1.4    // concentrazione foschia all’orizzonte
};

// GLSL Shaders (sky with discs + height-fog)
const SKY_VERT = /* glsl */`
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorldPos;

  uniform vec3 uCamPos;

  uniform vec3 topDay;
  uniform vec3 bottomDay;
  uniform vec3 topNight;
  uniform vec3 bottomNight;

  uniform vec3 sunDir;
  uniform vec3 moonDir;
  uniform float sunUp;

  uniform float sunSize;
  uniform float sunSoftness;
  uniform float sunIntensity;

  uniform float moonSize;
  uniform float moonSoftness;
  uniform float moonIntensity;

  uniform vec3  uFogColor;
  uniform float uFogDensity;
  uniform float uFogHeight;

  uniform float uHorizonWidth;
  uniform float uHorizonPower;

  float softDisc(vec3 dir, vec3 centerDir, float size, float softness){
    float cosAng = dot(normalize(dir), normalize(centerDir));
    float inner = cos(size);
    float outer = cos(size + softness);
    float t = clamp((cosAng - outer) / max(1e-5, (inner - outer)), 0.0, 1.0);
    return t;
  }

  void main() {
    vec3 dir = normalize(vWorldPos - uCamPos);

    // gradiente base
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 gradDay   = mix(bottomDay,  topDay,   h);
    vec3 gradNight = mix(bottomNight, topNight, h);
    vec3 baseCol   = mix(gradNight, gradDay, sunUp);

    // dischi (sole/luna)
    float sunMask  = softDisc(dir, sunDir,  sunSize,  sunSoftness);
    vec3  sunCol   = vec3(1.0, 0.92, 0.75) * sunIntensity * sunMask;

    float moonMask = softDisc(dir, moonDir, moonSize, moonSoftness);
    vec3  moonCol  = vec3(0.8, 0.9, 1.0)   * moonIntensity * moonMask;

    // foschia che “riempie” l’orizzonte (senza banda)
    float t = 1.0 - smoothstep(0.0, uHorizonWidth, max(dir.y, 0.0));
    float dens = uFogDensity * (uFogHeight * 0.02);
    float fogAmt = 1.0 - exp(-t * dens * 4.0);
    fogAmt = clamp(fogAmt, 0.0, 1.0);
    vec3 fogged = mix(uFogColor, baseCol, 1.0 - fogAmt);

    gl_FragColor = vec4(fogged + sunCol + moonCol, 1.0);
  }
`;

// ---------- boot ----------
init();
animate();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
  camera.position.set(0, 6, 16);
  camera.lookAt(0, 0, 0);

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

  hemi = new THREE.HemisphereLight(PALETTE.night.hemiSky, PALETTE.night.hemiGround, PALETTE.night.hemiIntensity);
  scene.add(hemi);

  // Fog baseline (night)
  scene.fog = new THREE.FogExp2(PALETTE.night.fogColor, PALETTE.night.fogDensity);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: PALETTE.night.groundColor, roughness: 1.0, metalness: 0.0
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

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1, 0);

  // === Skydome ===
  const skyGeo = new THREE.SphereGeometry(1000, 48, 32);
  skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      topDay:       { value: SKY_DAY_TOP.clone() },
      bottomDay:    { value: SKY_DAY_BOTTOM.clone() },
      topNight:     { value: SKY_NIGHT_TOP.clone() },
      bottomNight:  { value: SKY_NIGHT_BOTTOM.clone() },
      sunDir:       { value: new THREE.Vector3(0,1,0) },
      moonDir:      { value: new THREE.Vector3(0,-1,0) },
      sunUp:        { value: 0.0 },
      sunSize:      { value: 0.07 },
      sunSoftness:  { value: 0.03 },
      sunIntensity: { value: 1.5 },
      moonSize:     { value: 0.05 },
      moonSoftness: { value: 0.03 },
      moonIntensity:{ value: 1.0 },
      uFogColor:    { value: new THREE.Color(scene.fog.color) },
      uFogDensity:  { value: scene.fog.density * FogPreset.densityBoost * FogPreset.multiplier },
      uFogHeight:   { value: FogPreset.heightNight },
      uCamPos:      { value: new THREE.Vector3() },
      uHorizonWidth:{ value: FogPreset.horizonWidth },
      uHorizonPower:{ value: FogPreset.horizonPower }
    }
  });
  skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.renderOrder = -9999;
  scene.add(skyDome);

  // Resize + Key UI
  addEventListener('resize', onResize);
  setupKeyControls();               // <— unico gestore tasti
  setLightingMood('night');
  updateDebugUI();
}

// Apply palette instantly (for N/M toggles only)
function setLightingMood(mode) {
  const p = PALETTE[mode];
  if (!p) return;

  if (!scene.fog) scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
  scene.fog.color.setHex(p.fogColor);
  scene.fog.density = p.fogDensity;

  ambient.color.setHex(p.ambientColor);
  ambient.intensity = p.ambientIntensity;

  sun.color.setHex(p.sunColor);
  sun.intensity = p.sunIntensity; // baseline, poi animata

  hemi.color.setHex(p.hemiSky);
  hemi.groundColor.setHex(p.hemiGround);
  hemi.intensity = p.hemiIntensity;

  renderer.toneMappingExposure = p.exposure;
  ground.material.color.setHex(p.groundColor);
}

// Helpers
function smooth01(x, a, b){
  const t = THREE.MathUtils.clamp((x - a) / Math.max(1e-5, (b - a)), 0, 1);
  return t * t * (3 - 2 * t);
}

// Day–Night animation
function updateDayNight(timeSec) {
  const phase = (timeSec % DAY_LENGTH) / DAY_LENGTH;
  const ang   = phase * Math.PI * 2;

  sun.position.set(Math.cos(ang) * SKY_RADIUS,  Math.sin(ang) * SKY_RADIUS,  0);
  moon.position.set(Math.cos(ang + Math.PI) * SKY_RADIUS, Math.sin(ang + Math.PI) * SKY_RADIUS, 0);

  const sunUp  = Math.max(0, Math.sin(ang));
  const moonUp = Math.max(0, Math.sin(ang + Math.PI));

  sun.intensity  = THREE.MathUtils.lerp(0.0, PALETTE.day.sunIntensity,   sunUp);
  moon.intensity = THREE.MathUtils.lerp(0.0, PALETTE.night.sunIntensity, moonUp);

  const wAmb = smooth01(sunUp, 0.05, 0.35);
  const wExp = smooth01(sunUp, 0.15, 0.70);
  const wFog = smooth01(sunUp, 0.20, 0.80);

  ambient.intensity = THREE.MathUtils.lerp(PALETTE.night.ambientIntensity, PALETTE.day.ambientIntensity, wAmb);
  ambient.color.lerpColors(new THREE.Color(PALETTE.night.ambientColor), new THREE.Color(PALETTE.day.ambientColor), wAmb);

  const fogColNight = new THREE.Color(PALETTE.night.fogColor);
  const fogColDay   = new THREE.Color(PALETTE.day.fogColor);
  scene.fog.color.lerpColors(fogColNight, fogColDay, wFog);
  scene.fog.density = THREE.MathUtils.lerp(PALETTE.night.fogDensity, PALETTE.day.fogDensity, wFog);

  renderer.toneMappingExposure = THREE.MathUtils.lerp(PALETTE.night.exposure, PALETTE.day.exposure, wExp);

  hemi.intensity = THREE.MathUtils.lerp(PALETTE.night.hemiIntensity, PALETTE.day.hemiIntensity, wAmb);
  hemi.color.lerpColors(new THREE.Color(PALETTE.night.hemiSky), new THREE.Color(PALETTE.day.hemiSky), wAmb);
  hemi.groundColor.lerpColors(new THREE.Color(PALETTE.night.hemiGround), new THREE.Color(PALETTE.day.hemiGround), wAmb);

  ground.material.color.copy(new THREE.Color(PALETTE.night.groundColor)).lerp(new THREE.Color(PALETTE.day.groundColor), wAmb);

  // Skydome uniforms
  const sunDir  = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0).normalize();
  const moonDir = new THREE.Vector3(Math.cos(ang + Math.PI), Math.sin(ang + Math.PI), 0).normalize();

  if (skyMat) {
    skyMat.uniforms.sunDir.value.copy(sunDir);
    skyMat.uniforms.moonDir.value.copy(moonDir);
    skyMat.uniforms.sunUp.value = sunUp;
    skyMat.uniforms.sunIntensity.value  = THREE.MathUtils.lerp(0.0, 1.5, sunUp);
    skyMat.uniforms.moonIntensity.value = THREE.MathUtils.lerp(1.0, 0.0, sunUp);

    skyMat.uniforms.uFogColor.value.copy(scene.fog.color);
    const skyDensity = scene.fog.density * FogPreset.densityBoost * FogPreset.multiplier;
    const skyHeight  = THREE.MathUtils.lerp(FogPreset.heightNight, FogPreset.heightDay, wFog);
    skyMat.uniforms.uFogDensity.value = skyDensity;
    skyMat.uniforms.uFogHeight.value  = skyHeight;

    skyMat.uniforms.uHorizonWidth.value = FogPreset.horizonWidth;
    skyMat.uniforms.uHorizonPower.value = FogPreset.horizonPower;

    _dbg.uFogD = skyDensity;
    _dbg.uFogH = skyHeight;
  }

  _dbg.sunUp = sunUp; _dbg.wAmb = wAmb; _dbg.wExp = wExp; _dbg.wFog = wFog;
}

// Unico gestore tasti + overlay
function setupKeyControls() {
  debugEl = document.createElement('div');
  debugEl.id = 'debug-look';
  debugEl.style.cssText = `
    position:fixed; left:8px; bottom:8px; z-index:9999;
    color:#9fb6d1; background:#0008; padding:6px 8px; border-radius:6px;
    font:12px/1.3 monospace; user-select:none; pointer-events:none;
    white-space:pre;
  `;
  document.body.appendChild(debugEl);

  window.addEventListener('keydown', (e) => {
    let changed = true;

    switch (e.key) {
      // Palette toggle
      case 'n': case 'N': setLightingMood('night'); break;
      case 'm': case 'M': setLightingMood('day');   break;

      // Fog presets
      case 'F1': // Clear Day
        FogPreset.multiplier = 0.8;
        FogPreset.densityBoost = 10.0;
        FogPreset.heightDay = 60.0; FogPreset.heightNight = 40.0;
        FogPreset.horizonWidth = 0.28; FogPreset.horizonPower = 1.2;
        break;
      case 'F2': // Misty Dawn
        FogPreset.multiplier = 1.2;
        FogPreset.densityBoost = 12.0;
        FogPreset.heightDay = 55.0; FogPreset.heightNight = 35.0;
        FogPreset.horizonWidth = 0.32; FogPreset.horizonPower = 1.4;
        break;
      case 'F3': // Heavy Night
        FogPreset.multiplier = 1.6;
        FogPreset.densityBoost = 14.0;
        FogPreset.heightDay = 50.0; FogPreset.heightNight = 30.0;
        FogPreset.horizonWidth = 0.36; FogPreset.horizonPower = 1.6;
        break;

      // Debug tweaks
      case '[': scene.fog.density = clamp(scene.fog.density - 0.001, 0.005, 0.05); break;
      case ']': scene.fog.density = clamp(scene.fog.density + 0.001, 0.005, 0.05); break;
      case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.5, 2.0); break;
      case '=':
      case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.5, 2.0); break;
      case '1': ambient.intensity = clamp(ambient.intensity - 0.02, 0.0, 1.0); break;
      case '2': ambient.intensity = clamp(ambient.intensity + 0.02, 0.0, 1.0); break;
      case '3': sun.intensity = clamp(sun.intensity - 0.05, 0.0, 3.0); break;
      case '4': sun.intensity = clamp(sun.intensity + 0.05, 0.0, 3.0); break;

      // Time control
      case 'P': case 'p': // pausa/continua
        if (manualPhase === null) {
          const elapsed = (performance.now() - startTime) / 1000;
          manualPhase = (elapsed % DAY_LENGTH) / DAY_LENGTH; // blocca la fase corrente
        } else {
          manualPhase = null; // torna a tempo reale
        }
        break;
      case 'U': case 'u': manualPhase = 0.25; break; // alba
      case 'O': case 'o': manualPhase = 0.50; break; // mezzogiorno
      case 'Y': case 'y': manualPhase = 0.75; break; // tramonto
      case 'I': case 'i': manualPhase = 0.00; break; // mezzanotte
      case 'R': case 'r': manualPhase = null; startTime = performance.now(); break; // reset
      default: changed = false;
    }

    if (changed) updateDebugUI();
  });
}

// Render loop
function animate() {
  requestAnimationFrame(animate);

  if (skyDome) skyDome.position.copy(camera.position);
  if (skyMat)  skyMat.uniforms.uCamPos.value.copy(camera.position);

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

function updateDebugUI() {
  if (!debugEl) return;
  debugEl.textContent =
    `fog: ${scene.fog.density.toFixed(3)} | exp: ${renderer.toneMappingExposure.toFixed(2)} | ` +
    `amb: ${ambient.intensity.toFixed(2)} | sun: ${sun.intensity.toFixed(2)}\n` +
    `sunUp: ${_dbg.sunUp.toFixed(2)} | wAmb: ${_dbg.wAmb.toFixed(2)} | wExp: ${_dbg.wExp.toFixed(2)} | wFog: ${_dbg.wFog.toFixed(2)}\n` +
    `sky uFogDensity: ${_dbg.uFogD.toFixed(4)} | sky uFogHeight: ${_dbg.uFogH.toFixed(1)}\n` +
    `[N]/[M] palette  |  [ ] - = 1 2 3 4 tweaks  |  [P]ause  [U]/[O]/[Y]/[I]/[R] time  |  Preset: F1/F2/F3`;
}

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
