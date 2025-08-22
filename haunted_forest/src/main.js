// // // // main.js — Pines + FBM Fog + HUD + Beam Heat placeholder// main.js — Pines + FBM Fog + HUD + Beam Heat placeholder
// // // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // // import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// // // import { TreeCatalog } from './assets/TreeCatalog.js';
// // // import { ForestSystem } from './systems/ForestSystem.js';
// // // import { initHUD } from './ui/hud.js';

// // // /* ---------- REGOLE COLORI PINO ---------- */
// // // const PINE_RULES = [
// // //   { // CHIOMA / AGHI
// // //     name: 'leaves',
// // //     matchMat: ['材质.001'],
// // //     matchObj: ['leaves','leaf','ico','pine'],
// // //     color: '#7FA36B',
// // //     roughness: 0.95, metalness: 0.0,
// // //     emissiveScale: 0.5, emissiveIntensity: 0.08,
// // //     flatShading: true
// // //   },
// // //   { // TRONCO
// // //     name: 'trunk',
// // //     matchMat: ['材质'],
// // //     matchObj: ['trunk','cylinder'],
// // //     color: '#B28C72',
// // //     roughness: 0.95, metalness: 0.0,
// // //     emissiveScale: 0.5, emissiveIntensity: 0.08,
// // //     flatShading: true
// // //   },
// // //   { // FALLBACK
// // //     name: 'other',
// // //     color: '#BFBFBF',
// // //     roughness: 0.95, metalness: 0.0,
// // //     emissiveScale: 0.4, emissiveIntensity: 0.04,
// // //     flatShading: true
// // //   }
// // // ];

// // // const PINE_OPTIONS = {
// // //   mtlUrl: '/assets/models/trees/pine.mtl',
// // //   keepSourceMaps: false,
// // //   scale: 18,
// // //   rules: PINE_RULES
// // // };

// // // /* ---------------- Fog FBM (patch ai chunk) ---------------- */
// // // const NOISE_GLSL = `
// // // vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
// // // vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
// // // float snoise(vec3 v){
// // //   const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
// // //   vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
// // //   vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
// // //   vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
// // //   vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
// // //   float n_=0.142857142857; vec3 ns=n_*D.wyz - D.xzx;
// // //   vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
// // //   vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
// // //   vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
// // //   vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
// // //   vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
// // //   vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
// // //   p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
// // //   vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
// // //   return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
// // // }
// // // float FBM(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
// // // `;
// // // THREE.ShaderChunk.fog_pars_vertex = `
// // // #ifdef USE_FOG
// // //   varying vec3 vWorldPosition;
// // // #endif
// // // `;
// // // THREE.ShaderChunk.fog_vertex = `
// // // #ifdef USE_FOG
// // //   vWorldPosition = worldPosition.xyz;
// // // #endif
// // // `;
// // // THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
// // // #ifdef USE_FOG
// // //   uniform float fogTime;
// // //   uniform vec3 fogColor;
// // //   varying vec3 vWorldPosition;
// // //   #ifdef FOG_EXP2
// // //     uniform float fogDensity;
// // //   #else
// // //     uniform float fogNear;
// // //     uniform float fogFar;
// // //   #endif
// // // #endif
// // // `;
// // // THREE.ShaderChunk.fog_fragment = `
// // // #ifdef USE_FOG
// // //   vec3 fogOrigin = cameraPosition;
// // //   vec3 dir = normalize(vWorldPosition - fogOrigin);
// // //   float dist = distance(vWorldPosition, fogOrigin);

// // //   vec3 sampleP = vWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
// // //   float n = FBM(sampleP + FBM(sampleP)); n = n*0.5 + 0.5;

// // //   dist *= mix(n, 1.0, clamp((dist - 5000.0)/5000.0, 0.0, 1.0));
// // //   dist *= dist;

// // //   float y = dir.y; if(abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0)*1e-4;
// // //   float heightFactor = 0.05;
// // //   float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) *
// // //                     (1.0 - exp(-dist * y * fogDensity)) / y;

// // //   fogFactor = clamp(fogFactor, 0.0, 1.0);
// // //   gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
// // // #endif
// // // `;

// // // /* uniform fogTime per tutti i materiali */
// // // const _fogShaders = new Set();
// // // function attachFogTo(root){
// // //   root.traverse?.(child=>{
// // //     const mat = child.material; if(!mat) return;
// // //     const mats = Array.isArray(mat) ? mat : [mat];
// // //     mats.forEach(m=>{
// // //       m.fog = true;
// // //       const prev = m.onBeforeCompile;
// // //       m.onBeforeCompile = (shader)=>{
// // //         prev?.(shader);
// // //         shader.uniforms.fogTime = { value: 0.0 };
// // //         _fogShaders.add(shader);
// // //       };
// // //       m.needsUpdate = true;
// // //     });
// // //   });
// // // }

// // // /* ---------------- App & Game State ---------------- */
// // // let scene, camera, renderer, controls;
// // // let animateFog = true;
// // // let debugEl;

// // // // Player + beam heat
// // // const player = {
// // //   health: 1.0,
// // //   heat: 0.0,
// // //   score: 0,
// // //   beamOn: false,
// // //   overheated: false,
// // // };
// // // const HEAT_RATE    = 0.35; // /s quando ON
// // // const COOL_RATE    = 0.50; // /s quando OFF
// // // const OVERHEAT_ON  = 1.00; // blocco
// // // const OVERHEAT_OFF = 0.60; // sblocco (isteresi)

// // // let hud;              // HUD handle
// // // let beam, beamTarget; // spotlight indicatore
// // // let _tPrev = performance.now() * 0.001;

// // // init();
// // // animate();

// // // async function init(){
// // //   scene = new THREE.Scene();
// // //   scene.background = new THREE.Color(0x87a0c0);
// // //   scene.fog = new THREE.FogExp2(0xDFE9F3, 5e-6);

// // //   camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 20000);
// // //   camera.position.set(0, 20, 120);

// // //   renderer = new THREE.WebGLRenderer({
// // //     canvas: document.getElementById('game-canvas'),
// // //     antialias: true
// // //   });
// // //   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// // //   renderer.setSize(innerWidth, innerHeight);
// // //   renderer.outputColorSpace = THREE.SRGBColorSpace;
// // //   renderer.toneMapping = THREE.ACESFilmicToneMapping;
// // //   renderer.toneMappingExposure = 1.05;
// // //   renderer.shadowMap.enabled = true;

// // //   scene.add(new THREE.AmbientLight(0xffffff, 0.35));
// // //   const sun = new THREE.DirectionalLight(0xffe6b3, 1.0);
// // //   sun.position.set(60, 120, 80);
// // //   sun.castShadow = true;
// // //   scene.add(sun);

// // //   const ground = new THREE.Mesh(
// // //     new THREE.PlaneGeometry(20000, 20000),
// // //     new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1 })
// // //   );
// // //   ground.rotation.x = -Math.PI/2;
// // //   ground.receiveShadow = true;
// // //   scene.add(ground);

// // //   controls = new OrbitControls(camera, renderer.domElement);
// // //   controls.enableDamping = true;
// // //   controls.dampingFactor = 0.05;
// // //   controls.target.set(0, 60, -600);

// // //   // HUD
// // //   hud = initHUD();

// // //   // Beam (SpotLight) agganciato alla camera
// // //   beam = new THREE.SpotLight(0xcff2ff, 0, 60, THREE.MathUtils.degToRad(12), 0.35, 1.0);
// // //   beam.visible = false;
// // //   camera.add(beam);
// // //   scene.add(camera); // fa sì che i figli della camera siano nel grafo
// // //   beamTarget = new THREE.Object3D();
// // //   scene.add(beamTarget);
// // //   beam.target = beamTarget;

// // //   // Input beam: mouse sinistro hold, 'F' toggle
// // //   addEventListener('mousedown', (e)=>{ if (e.button === 0 && !player.overheated) player.beamOn = true; });
// // //   addEventListener('mouseup',   (e)=>{ if (e.button === 0) player.beamOn = false; });
// // //   addEventListener('keydown',   (e)=>{
// // //     if (e.key.toLowerCase() === 'f') {
// // //       if (!player.overheated) player.beamOn = !player.beamOn;
// // //     }
// // //   });

// // //   attachFogTo(scene);
// // //   await setupForest(scene);
// // //   attachFogTo(scene);

// // //   setupDebug();
// // //   addEventListener('resize', onResize);
// // // }

// // // async function setupForest(scene){
// // //   const catalog = new TreeCatalog();
// // //   await catalog.load('pine', '/assets/models/trees/pine.obj', PINE_OPTIONS);

// // //   const forest = new ForestSystem(scene, {
// // //     seed: 2025,
// // //     innerRadius: 200,
// // //     outerRadius: 6000,
// // //     minSpacing: 22,
// // //     maxSpacing: 34,
// // //     count: 4500,
// // //     scale: [0.9, 1.35],
// // //     clearings: [{ x:0, z:0, r:200 }],
// // //     types: [{
// // //       name: 'pine',
// // //       url: '/assets/models/trees/pine.obj',
// // //       options: PINE_OPTIONS,
// // //       occluderHeight: 160,
// // //       occluderRadiusScale: 0.9
// // //     }]
// // //   }, catalog);

// // //   const result = await forest.generate();
// // //   console.log('Forest ready:', result);
// // //   window.forest = forest;
// // // }

// // // function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// // // function updateBeamHeat(dt){
// // //   if (player.beamOn && !player.overheated) player.heat += HEAT_RATE * dt;
// // //   else                                     player.heat -= COOL_RATE * dt;
// // //   player.heat = clamp01(player.heat);

// // //   if (!player.overheated && player.heat >= OVERHEAT_ON) {
// // //     player.overheated = true;
// // //     player.beamOn = false;
// // //   } else if (player.overheated && player.heat <= OVERHEAT_OFF) {
// // //     player.overheated = false;
// // //   }
// // // }

// // // function animate(){
// // //   requestAnimationFrame(animate);

// // //   const tNow = performance.now() * 0.001;
// // //   const dt   = Math.min(0.05, Math.max(0, tNow - _tPrev));
// // //   _tPrev = tNow;

// // //   // Fog anim
// // //   _fogShaders.forEach(s => { s.uniforms.fogTime.value = animateFog ? tNow : 0.0; });

// // //   // Beam heat + spotlight
// // //   updateBeamHeat(dt);
// // //   const active = player.beamOn && !player.overheated;
// // //   beam.visible   = active;
// // //   beam.intensity = active ? 3.5 : 0.0;
// // //   const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
// // //   beamTarget.position.copy(camera.position).addScaledVector(fwd, 60);

// // //   // HUD
// // //   hud.set(player.health, player.heat, player.score, { overheated: player.overheated, beamOn: active });

// // //   controls.update();
// // //   renderer.render(scene, camera);
// // //   updateDebug();
// // // }

// // // function onResize(){
// // //   camera.aspect = innerWidth/innerHeight;
// // //   camera.updateProjectionMatrix();
// // //   renderer.setSize(innerWidth, innerHeight);
// // // }

// // // /* -------- mini UI (debug) -------- */
// // // function setupDebug(){
// // //   debugEl = document.createElement('div');
// // //   debugEl.style.cssText = `
// // //     position:fixed; left:8px; bottom:8px; z-index:9999;
// // //     color:#dfe8f3; background:#0008; padding:6px 8px; border-radius:6px;
// // //     font:12px/1.35 monospace; user-select:none; pointer-events:none; white-space:pre;`;
// // //   document.body.appendChild(debugEl);

// // //   addEventListener('keydown', (e)=>{
// // //     switch(e.key){
// // //       case '[': scene.fog.density = clamp01(scene.fog.density - 1e-6); break;
// // //       case ']': scene.fog.density = clamp01(scene.fog.density + 1e-6); break;
// // //       case '-': renderer.toneMappingExposure = Math.max(0.2, renderer.toneMappingExposure - 0.05); break;
// // //       case '=':
// // //       case '+': renderer.toneMappingExposure = Math.min(3.0, renderer.toneMappingExposure + 0.05); break;
// // //       case 'a':
// // //       case 'A': animateFog = !animateFog; break;
// // //       default: break;
// // //     }
// // //   });
// // // }
// // // function updateDebug(){
// // //   if(!debugEl) return;
// // //   const heatPct = Math.round(player.heat*100);
// // //   const beamState = player.overheated ? 'OVERHEATED' : (player.beamOn ? 'ON' : 'OFF');

// // //   debugEl.innerHTML =
// // //     `FogExp2+FBM density: ${scene.fog?.density.toExponential(2)}  |  ` +
// // //     `Exposure: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
// // //     `shaders:${_fogShaders.size}  |  anim:${animateFog?'ON':'OFF'}<br>` +
// // //     `Heat: <span style="color:${player.overheated?'#ff6b6b':'#dfe8f3'}">${heatPct}%</span>  ` +
// // //     `| Beam: <b>${beamState}</b>  (Mouse L o F)`;
// // // }



// // // // // // main.js — Pines + FBM Fog + HUD + Beam Heat placeholder  - con il ghost, non funziona
// // // // // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // // // // import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// // // // // import { TreeCatalog } from './assets/TreeCatalog.js';
// // // // // import { ForestSystem } from './systems/ForestSystem.js';
// // // // // import { initHUD } from './ui/hud.js';
// // // // // // NEW: import Ghost entity
// // // // // import { Ghost } from './entities/Ghost.js';

// // // // // /* ---------- REGOLE COLORI PINO ---------- */
// // // // // const PINE_RULES = [
// // // // //   { // CHIOMA / AGHI
// // // // //     name: 'leaves',
// // // // //     matchMat: ['材质.001'],
// // // // //     matchObj: ['leaves','leaf','ico','pine'],
// // // // //     color: '#7FA36B',
// // // // //     roughness: 0.95, metalness: 0.0,
// // // // //     emissiveScale: 0.5, emissiveIntensity: 0.08,
// // // // //     flatShading: true
// // // // //   },
// // // // //   { // TRONCO
// // // // //     name: 'trunk',
// // // // //     matchMat: ['材质'],
// // // // //     matchObj: ['trunk','cylinder'],
// // // // //     color: '#B28C72',
// // // // //     roughness: 0.95, metalness: 0.0,
// // // // //     emissiveScale: 0.5, emissiveIntensity: 0.08,
// // // // //     flatShading: true
// // // // //   },
// // // // //   { // FALLBACK
// // // // //     name: 'other',
// // // // //     color: '#BFBFBF',
// // // // //     roughness: 0.95, metalness: 0.0,
// // // // //     emissiveScale: 0.4, emissiveIntensity: 0.04,
// // // // //     flatShading: true
// // // // //   }
// // // // // ];

// // // // // const PINE_OPTIONS = {
// // // // //   mtlUrl: '/assets/models/trees/pine.mtl',
// // // // //   keepSourceMaps: false,
// // // // //   scale: 18,
// // // // //   rules: PINE_RULES
// // // // // };

// // // // // /* ---------------- Fog FBM (patch ai chunk) ---------------- */
// // // // // const NOISE_GLSL = `
// // // // // vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // // // vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // // // vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
// // // // // vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
// // // // // float snoise(vec3 v){
// // // // //   const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
// // // // //   vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
// // // // //   vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
// // // // //   vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
// // // // //   vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
// // // // //   float n_=0.142857142857; vec3 ns=n_*D.wyz - D.xzx;
// // // // //   vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
// // // // //   vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
// // // // //   vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
// // // // //   vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
// // // // //   vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
// // // // //   vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
// // // // //   p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
// // // // //   vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
// // // // //   return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
// // // // // }
// // // // // float FBM(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
// // // // // `;
// // // // // THREE.ShaderChunk.fog_pars_vertex = `
// // // // // #ifdef USE_FOG
// // // // //   varying vec3 vWorldPosition;
// // // // // #endif
// // // // // `;
// // // // // THREE.ShaderChunk.fog_vertex = `
// // // // // #ifdef USE_FOG
// // // // //   vWorldPosition = worldPosition.xyz;
// // // // // #endif
// // // // // `;
// // // // // THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
// // // // // #ifdef USE_FOG
// // // // //   uniform float fogTime;
// // // // //   uniform vec3 fogColor;
// // // // //   varying vec3 vWorldPosition;
// // // // //   #ifdef FOG_EXP2
// // // // //     uniform float fogDensity;
// // // // //   #else
// // // // //     uniform float fogNear;
// // // // //     uniform float fogFar;
// // // // //   #endif
// // // // // #endif
// // // // // `;
// // // // // THREE.ShaderChunk.fog_fragment = `
// // // // // #ifdef USE_FOG
// // // // //   vec3 fogOrigin = cameraPosition;
// // // // //   vec3 dir = normalize(vWorldPosition - fogOrigin);
// // // // //   float dist = distance(vWorldPosition, fogOrigin);

// // // // //   vec3 sampleP = vWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
// // // // //   float n = FBM(sampleP + FBM(sampleP)); n = n*0.5 + 0.5;

// // // // //   dist *= mix(n, 1.0, clamp((dist - 5000.0)/5000.0, 0.0, 1.0));
// // // // //   dist *= dist;

// // // // //   float y = dir.y; if(abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0)*1e-4;
// // // // //   float heightFactor = 0.05;
// // // // //   float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) *
// // // // //                     (1.0 - exp(-dist * y * fogDensity)) / y;

// // // // //   fogFactor = clamp(fogFactor, 0.0, 1.0);
// // // // //   gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
// // // // // #endif
// // // // // `;

// // // // // /* uniform fogTime per tutti i materiali */
// // // // // const _fogShaders = new Set();
// // // // // function attachFogTo(root){
// // // // //   root.traverse?.(child=>{
// // // // //     const mat = child.material; if(!mat) return;
// // // // //     const mats = Array.isArray(mat) ? mat : [mat];
// // // // //     mats.forEach(m=>{
// // // // //       m.fog = true;
// // // // //       const prev = m.onBeforeCompile;
// // // // //       m.onBeforeCompile = (shader)=>{
// // // // //         prev?.(shader);
// // // // //         shader.uniforms.fogTime = { value: 0.0 };
// // // // //         _fogShaders.add(shader);
// // // // //       };
// // // // //       m.needsUpdate = true;
// // // // //     });
// // // // //   });
// // // // // }

// // // // // /* ---------------- App & Game State ---------------- */
// // // // // let scene, camera, renderer, controls;
// // // // // let animateFog = true;
// // // // // let debugEl;

// // // // // // Player + beam heat
// // // // // const player = {
// // // // //   health: 1.0,
// // // // //   heat: 0.0,
// // // // //   score: 0,
// // // // //   beamOn: false,
// // // // //   overheated: false,
// // // // // };
// // // // // const HEAT_RATE    = 0.35; // /s quando ON
// // // // // const COOL_RATE    = 0.50; // /s quando OFF
// // // // // const OVERHEAT_ON  = 1.00; // blocco
// // // // // const OVERHEAT_OFF = 0.60; // sblocco (isteresi)

// // // // // let hud;              // HUD handle
// // // // // let beam, beamTarget; // spotlight indicatore
// // // // // let _tPrev = performance.now() * 0.001;
// // // // // // NEW: ghost handle
// // // // // let ghost;

// // // // // init();
// // // // // animate();

// // // // // async function init(){
// // // // //   scene = new THREE.Scene();
// // // // //   scene.background = new THREE.Color(0x87a0c0);
// // // // //   scene.fog = new THREE.FogExp2(0xDFE9F3, 5e-6);

// // // // //   camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 20000);
// // // // //   camera.position.set(0, 20, 120);

// // // // //   renderer = new THREE.WebGLRenderer({
// // // // //     canvas: document.getElementById('game-canvas'),
// // // // //     antialias: true
// // // // //   });
// // // // //   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// // // // //   renderer.setSize(innerWidth, innerHeight);
// // // // //   renderer.outputColorSpace = THREE.SRGBColorSpace;
// // // // //   renderer.toneMapping = THREE.ACESFilmicToneMapping;
// // // // //   renderer.toneMappingExposure = 1.05;
// // // // //   renderer.shadowMap.enabled = true;

// // // // //   scene.add(new THREE.AmbientLight(0xffffff, 0.35));
// // // // //   const sun = new THREE.DirectionalLight(0xffe6b3, 1.0);
// // // // //   sun.position.set(60, 120, 80);
// // // // //   sun.castShadow = true;
// // // // //   scene.add(sun);

// // // // //   const ground = new THREE.Mesh(
// // // // //     new THREE.PlaneGeometry(20000, 20000),
// // // // //     new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1 })
// // // // //   );
// // // // //   ground.rotation.x = -Math.PI/2;
// // // // //   ground.receiveShadow = true;
// // // // //   scene.add(ground);

// // // // //   controls = new OrbitControls(camera, renderer.domElement);
// // // // //   controls.enableDamping = true;
// // // // //   controls.dampingFactor = 0.05;
// // // // //   controls.target.set(0, 60, -600);

// // // // //   // HUD
// // // // //   hud = initHUD();

// // // // //   // Beam (SpotLight) agganciato alla camera
// // // // //   beam = new THREE.SpotLight(0xcff2ff, 0, 60, THREE.MathUtils.degToRad(12), 0.35, 1.0);
// // // // //   beam.visible = false;
// // // // //   camera.add(beam);
// // // // //   scene.add(camera); // fa sì che i figli della camera siano nel grafo
// // // // //   beamTarget = new THREE.Object3D();
// // // // //   scene.add(beamTarget);
// // // // //   beam.target = beamTarget;

// // // // //   // Input beam: mouse sinistro hold, 'F' toggle
// // // // //   addEventListener('mousedown', (e)=>{ if (e.button === 0 && !player.overheated) player.beamOn = true; });
// // // // //   addEventListener('mouseup',   (e)=>{ if (e.button === 0) player.beamOn = false; });
// // // // //   addEventListener('keydown',   (e)=>{
// // // // //     if (e.key.toLowerCase() === 'f') {
// // // // //       if (!player.overheated) player.beamOn = !player.beamOn;
// // // // //     }
// // // // //   });

// // // // //   attachFogTo(scene);
// // // // //   await setupForest(scene);
// // // // //   attachFogTo(scene);

// // // // //   // NEW: create & place one ghost (GLB recommended)
// // // // //   ghost = await new Ghost({
// // // // //     url: '/assets/models/ghost/ghost.glb',     // update if you placed it elsewhere
// // // // //     targetHeight: 2.2,
// // // // //     bodyNameHints: ['ghost_body','body'] // match your Blender material name
// // // // //   }).load();

// // // // //   ghost.addTo(scene);
// // // // //   ghost.setPosition(0, 0, -240); // just outside your clearing (r=200)
// // // // //   attachFogTo(ghost.root);       // give it FBM fog uniforms too
// // // // //   window.ghost = ghost;          // console debug

// // // // //   setupDebug();
// // // // //   addEventListener('resize', onResize);
// // // // // }

// // // // // async function setupForest(scene){
// // // // //   const catalog = new TreeCatalog();
// // // // //   await catalog.load('pine', '/assets/models/trees/pine.obj', PINE_OPTIONS);

// // // // //   const forest = new ForestSystem(scene, {
// // // // //     seed: 2025,
// // // // //     innerRadius: 200,
// // // // //     outerRadius: 6000,
// // // // //     minSpacing: 22,
// // // // //     maxSpacing: 34,
// // // // //     count: 4500,
// // // // //     scale: [0.9, 1.35],
// // // // //     clearings: [{ x:0, z:0, r:200 }],
// // // // //     types: [{
// // // // //       name: 'pine',
// // // // //       url: '/assets/models/trees/pine.obj',
// // // // //       options: PINE_OPTIONS,
// // // // //       occluderHeight: 160,
// // // // //       occluderRadiusScale: 0.9
// // // // //     }]
// // // // //   }, catalog);

// // // // //   const result = await forest.generate();
// // // // //   console.log('Forest ready:', result);
// // // // //   window.forest = forest;
// // // // // }

// // // // // function clamp01(x){ return Math.max(0, Math.min(1, x)); }

// // // // // function updateBeamHeat(dt){
// // // // //   if (player.beamOn && !player.overheated) player.heat += HEAT_RATE * dt;
// // // // //   else                                     player.heat -= COOL_RATE * dt;
// // // // //   player.heat = clamp01(player.heat);

// // // // //   if (!player.overheated && player.heat >= OVERHEAT_ON) {
// // // // //     player.overheated = true;
// // // // //     player.beamOn = false;
// // // // //   } else if (player.overheated && player.heat <= OVERHEAT_OFF) {
// // // // //     player.overheated = false;
// // // // //   }
// // // // // }

// // // // // function animate(){
// // // // //   requestAnimationFrame(animate);

// // // // //   const tNow = performance.now() * 0.001;
// // // // //   const dt   = Math.min(0.05, Math.max(0, tNow - _tPrev));
// // // // //   _tPrev = tNow;

// // // // //   // Fog anim
// // // // //   _fogShaders.forEach(s => { s.uniforms.fogTime.value = animateFog ? tNow : 0.0; });

// // // // //   // Beam heat + spotlight
// // // // //   updateBeamHeat(dt);
// // // // //   const active = player.beamOn && !player.overheated;
// // // // //   beam.visible   = active;
// // // // //   beam.intensity = active ? 3.5 : 0.0;
// // // // //   const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
// // // // //   beamTarget.position.copy(camera.position).addScaledVector(fwd, 60);

// // // // //   // HUD
// // // // //   hud.set(player.health, player.heat, player.score, { overheated: player.overheated, beamOn: active });

// // // // //   // NEW: tick ghost (advances shader pulse time)
// // // // //   if (ghost) ghost.update(dt);

// // // // //   controls.update();
// // // // //   renderer.render(scene, camera);
// // // // //   updateDebug();
// // // // // }

// // // // // function onResize(){
// // // // //   camera.aspect = innerWidth/innerHeight;
// // // // //   camera.updateProjectionMatrix();
// // // // //   renderer.setSize(innerWidth, innerHeight);
// // // // // }

// // // // // /* -------- mini UI (debug) -------- */
// // // // // function setupDebug(){
// // // // //   debugEl = document.createElement('div');
// // // // //   debugEl.style.cssText = `
// // // // //     position:fixed; left:8px; bottom:8px; z-index:9999;
// // // // //     color:#dfe8f3; background:#0008; padding:6px 8px; border-radius:6px;
// // // // //     font:12px/1.35 monospace; user-select:none; pointer-events:none; white-space:pre;`;
// // // // //   document.body.appendChild(debugEl);

// // // // //   addEventListener('keydown', (e)=>{
// // // // //     switch(e.key){
// // // // //       case '[': scene.fog.density = clamp01(scene.fog.density - 1e-6); break;
// // // // //       case ']': scene.fog.density = clamp01(scene.fog.density + 1e-6); break;
// // // // //       case '-': renderer.toneMappingExposure = Math.max(0.2, renderer.toneMappingExposure - 0.05); break;
// // // // //       case '=':
// // // // //       case '+': renderer.toneMappingExposure = Math.min(3.0, renderer.toneMappingExposure + 0.05); break;
// // // // //       case 'a':
// // // // //       case 'A': animateFog = !animateFog; break;
// // // // //       default: break;
// // // // //     }
// // // // //   });
// // // // // }
// // // // // function updateDebug(){
// // // // //   if(!debugEl) return;
// // // // //   const heatPct = Math.round(player.heat*100);
// // // // //   const beamState = player.overheated ? 'OVERHEATED' : (player.beamOn ? 'ON' : 'OFF');

// // // // //   debugEl.innerHTML =
// // // // //     `FogExp2+FBM density: ${scene.fog?.density.toExponential(2)}  |  ` +
// // // // //     `Exposure: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
// // // // //     `shaders:${_fogShaders.size}  |  anim:${animateFog?'ON':'OFF'}<br>` +
// // // // //     `Heat: <span style="color:${player.overheated?'#ff6b6b':'#dfe8f3'}">${heatPct}%</span>  ` +
// // // // //     `| Beam: <b>${beamState}</b>  (Mouse L o F)`;
// // // // // }




// // // WORKING SINGLE GHOST WITH DYNAMIC TARGET + SHADING 
// // // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // // import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
// // // import { Ghost } from './entities/Ghost.js';
// // // import { initHUD } from './ui/hud.js';

// // // // ---- master switch per log rumorosi ----
// // // window.DEBUG = false;

// // // let scene, camera, renderer, controls, ghost, hud;
// // // let ground, targetMarker, targetRing, targetBeacon;
// // // let ghostArrow, seekLine, seekLineGeom, seekStrip, seekStripGeom;
// // // let labelGhost, labelTarget;
// // // let _t = performance.now() * 0.001;

// // // const raycaster = new THREE.Raycaster();
// // // const ndc = new THREE.Vector2();

// // // // TARGET LOCK
// // // const LOCK_TARGET = false;
// // // const FIX_X = 4.0;
// // // const FIX_Z = -4.0;
// // // let isLocked = LOCK_TARGET;

// // // let targetPoint = null;

// // // const fmt = (v)=> v ? `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})` : 'null';
// // // function snapshot(tag='snap') {
// // //   const gp = ghost?.root?.position ?? null;
// // //   const mp = targetMarker?.position ?? null;
// // //   const tp = targetPoint ?? null;
// // //   const dx = (mp?.x ?? 0) - (gp?.x ?? 0);
// // //   const dz = (mp?.z ?? 0) - (gp?.z ?? 0);
// // //   const d  = Math.hypot(dx,dz);
// // //   if (window.DEBUG) console.log(`[${tag}] ghost=${fmt(gp)} marker=${fmt(mp)} targetAI=${fmt(tp)} sameRef=${mp===tp} dXZ=${d.toFixed(3)}`);
// // // }

// // // function makeLabel(){
// // //   const canvas = document.createElement('canvas');
// // //   canvas.width = 512; canvas.height = 128;
// // //   const ctx = canvas.getContext('2d');
// // //   const tex = new THREE.CanvasTexture(canvas);
// // //   tex.minFilter = THREE.LinearFilter;
// // //   const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, depthTest:false });
// // //   const spr = new THREE.Sprite(mat);
// // //   spr.scale.set(2.6, 0.65, 1);
// // //   spr.userData.update = (text)=>{
// // //     ctx.clearRect(0,0,canvas.width,canvas.height);
// // //     ctx.font = '48px ui-sans-serif,system-ui,Arial';
// // //     ctx.fillStyle = '#00000088';
// // //     ctx.fillRect(0,0,canvas.width,canvas.height);
// // //     ctx.fillStyle = '#ffe7b3';
// // //     ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
// // //     ctx.fillText(text, canvas.width/2, canvas.height/2);
// // //     tex.needsUpdate = true;
// // //   };
// // //   spr.userData.update('');
// // //   return spr;
// // // }

// // // (async function start(){ await init(); animate(); })();

// // // async function init() {
// // //   // Renderer
// // //   renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
// // //   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// // //   renderer.setSize(innerWidth, innerHeight);
// // //   renderer.outputColorSpace = THREE.SRGBColorSpace;
// // //   renderer.toneMapping = THREE.ACESFilmicToneMapping;
// // //   renderer.toneMappingExposure = 1.0;

// // //   // Scene
// // //   scene = new THREE.Scene();
// // //   scene.background = new THREE.Color(0x8fb3d9);
// // //   scene.fog = new THREE.FogExp2(0xDFE9F3, 0.00015);

// // //   // Camera + Controls
// // //   camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
// // //   camera.position.set(0, 1.8, 3.2);
// // //   controls = new OrbitControls(camera, renderer.domElement);
// // //   controls.enableDamping = true;
// // //   controls.enablePan = false;
// // //   controls.minDistance = 1.2;
// // //   controls.maxDistance = 20.0;
// // //   controls.target.set(0, 1.2, 0);
// // //   controls.update();

// // //   // Luci
// // //   scene.add(new THREE.AmbientLight(0xffffff, 0.35));
// // //   const sun = new THREE.DirectionalLight(0xfff1c1, 1.2); sun.position.set(5,10,4);
// // //   scene.add(sun);

// // //   // Ground
// // //   ground = new THREE.Mesh(
// // //     new THREE.PlaneGeometry(200, 200),
// // //     new THREE.MeshStandardMaterial({ color: 0x6b5b53, roughness: 1 })
// // //   );
// // //   ground.rotation.x = -Math.PI/2;
// // //   ground.position.y = -0.10;
// // //   scene.add(ground);

// // //   // Target marker & ring
// // //   const markerR = 0.6, ringR = 0.75;
// // //   targetMarker = new THREE.Mesh(
// // //     new THREE.CircleGeometry(markerR, 64),
// // //     new THREE.MeshBasicMaterial({ color: 0xff8c00, depthTest:false, depthWrite:false })
// // //   );
// // //   targetMarker.rotation.x = -Math.PI/2; targetMarker.renderOrder = 999;

// // //   targetRing = new THREE.Mesh(
// // //     new THREE.RingGeometry(markerR*0.7, ringR, 64),
// // //     new THREE.MeshBasicMaterial({ color: 0x111111, depthTest:false, depthWrite:false })
// // //   );
// // //   targetRing.rotation.x = -Math.PI/2; targetRing.renderOrder = 999;

// // //   scene.add(targetMarker, targetRing);

// // //   targetPoint = targetMarker.position;

// // //   // Beacon
// // //   targetBeacon = new THREE.Mesh(
// // //     new THREE.CylinderGeometry(0.055, 0.055, 2.0, 22),
// // //     new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent:true, opacity:0.95, depthTest:false })
// // //   );
// // //   targetBeacon.frustumCulled = false; targetBeacon.renderOrder = 998;
// // //   scene.add(targetBeacon);

// // //   // Arrow
// // //   ghostArrow = new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(), 1.5, 0x18c08f);
// // //   ghostArrow.frustumCulled = false; ghostArrow.renderOrder = 997;
// // //   scene.add(ghostArrow);

// // //   // Line + strip
// // //   seekLineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
// // //   seekLine = new THREE.Line(seekLineGeom, new THREE.LineBasicMaterial({ color: 0xff8c00 }));
// // //   seekLine.frustumCulled = false; seekLine.renderOrder = 996;
// // //   scene.add(seekLine);

// // //   seekStripGeom = new THREE.PlaneGeometry(1, 0.10);
// // //   seekStrip = new THREE.Mesh(seekStripGeom, new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent:true, opacity:0.6, side:THREE.DoubleSide }));
// // //   seekStrip.rotation.x = -Math.PI/2; seekStrip.frustumCulled = false; seekStrip.renderOrder = 995;
// // //   scene.add(seekStrip);

// // //   // Labels
// // //   labelGhost = makeLabel(); scene.add(labelGhost);
// // //   labelTarget = makeLabel(); scene.add(labelTarget);

// // //   // Target iniziale
// // //   setTarget(FIX_X, FIX_Z);
// // //   snapshot('lock');

// // //   // Ghost
// // //   const getGroundY = () => ground.position.y;
// // //   ghost = new Ghost({
// // //     url: '/assets/models/ghost/ghost.glb',
// // //     targetHeight: 2.2,
// // //     opacityBody: 0.75,
// // //     getGroundY,
// // //     clearance: 0.06,
// // //     getTargetPos: () => targetPoint,
// // //     speed: 1.2,
// // //     keepDistance: 0.0,
// // //     arriveRadius: 0.03,
// // //   });
// // //   await ghost.load();
// // //   ghost.setPosition(0, 1.40, 0).addTo(scene);

// // //   ghost.setDebugMode(0);   // 0 = NORMAL, spegne ogni vista di debug

// // //   // forza compilazione shader
// // //   renderer.compile(scene, camera);
// // //   if (window.DEBUG) console.log('uniformSets at init:', ghost.uniformSets?.length, ghost.uniformSets);

// // //   // Idle
// // //   ghost.setIdleParams({
// // //     baseY: 0.45,
// // //     ampBob: 0.06,
// // //     omegaBob: 1.2,
// // //     swayAmpX: THREE.MathUtils.degToRad(4),
// // //     swayAmpZ: THREE.MathUtils.degToRad(4),
// // //     swayOmega: 1.05,
// // //     minY: 0.35,
// // //     maxY: 0.60,
// // //   });

// // //   ghost.appear();

// // //   hud = initHUD();
// // //   focusOnGhost(4.5);

// // //   renderer.domElement.addEventListener('pointerdown', onPointerDown);

// // //   // Debug / controls
// // //   addEventListener('keydown', (e) => {
// // //     const k = e.key.toLowerCase();
// // //     if (k==='f') focusOnGhost(2.0);
// // //     if (k==='t') { ghost.root.position.set(targetPoint.x, ghost.root.position.y, targetPoint.z); if (window.DEBUG) console.log('teleport ghost to target'); }
// // //     if (k==='p') snapshot('manual');
// // //     if (k==='o') toggleTopDown();

// // //     if (k==='a') ghost.appear();
// // //     if (k==='x') ghost.cleanse();
// // //     if (k==='z') ghost.deactivate();

// // //     if (k==='l') setLocked(!isLocked);

// // //     // thresholds
// // //     if (k==='1') { ghost?._setThreshold(1.0);  console.log('thr=1.0'); }
// // //     if (k==='2') { ghost?._setThreshold(0.5);  console.log('thr=0.5'); }
// // //     if (k==='3') { ghost?._setThreshold(0.25); console.log('thr=0.25'); }

// // //     // diagnostica shader
// // //     if (k==='9') {
// // //       animate._dbgMode = ((animate._dbgMode ?? 0) + 1) % 4; // 0..3
// // //       ghost.setDebugMode(animate._dbgMode);
// // //       const labels = ['NORMAL','NOISE','MASK','EDGE'];
// // //       console.log('[DEBUG MODE]', animate._dbgMode, labels[animate._dbgMode]);
// // //     }
// // //     if (k==='m') ghost.logMaterialsDebug();
// // //     if (k==='r') { renderer.compile(scene, camera); console.log('[renderer] compile() called'); }

// // //     // toggle log rumorosi
// // //     if (k==='k') { window.DEBUG = !window.DEBUG; console.log('DEBUG =', window.DEBUG); }
// // //   });

// // //   setLocked(isLocked);

// // //   addEventListener('resize', onResize);
// // //   window.ghost = ghost; window.targetPoint = targetPoint; window.renderer = renderer; window.scene = scene; window.camera = camera;
// // // }

// // // function setLocked(v){
// // //   isLocked = !!v;
// // //   renderer.domElement.style.cursor = isLocked ? 'default' : 'crosshair';
// // //   if (targetBeacon?.material) {
// // //     targetBeacon.material.color.set(isLocked ? 0xff8c00 : 0x22cc88);
// // //     targetBeacon.material.needsUpdate = true;
// // //   }
// // //   if (window.DEBUG) console.log(`[target] ${isLocked ? 'LOCKED' : 'UNLOCKED'}  (press L to toggle)`);
// // // }

// // // function setTarget(x, z){
// // //   const gy = ground.position.y + 0.02;
// // //   targetMarker.position.set(x, gy, z);
// // //   targetRing.position.set(x, gy + 0.001, z);
// // //   targetBeacon.position.set(x, gy + 1.0, z);
// // // }

// // // function onPointerDown(e){
// // //   if (isLocked) return;
// // //   if (e.button !== 0) return;
// // //   ndc.x =  (e.clientX / innerWidth)  * 2 - 1;
// // //   ndc.y = -(e.clientY / innerHeight) * 2 + 1;
// // //   raycaster.setFromCamera(ndc, camera);
// // //   const hit = raycaster.intersectObject(ground, false)[0];
// // //   if (hit) setTarget(hit.point.x, hit.point.z);
// // // }

// // // function focusOnGhost(offset = 2.0) {
// // //   const box = new THREE.Box3().setFromObject(ghost.root);
// // //   const size = new THREE.Vector3(); box.getSize(size);
// // //   const center = new THREE.Vector3(); box.getCenter(center);
// // //   const radius = 0.5 * Math.max(size.x, size.y, size.z);
// // //   const dist = (radius / Math.sin(THREE.MathUtils.degToRad(camera.fov) * 0.5)) * offset;
// // //   camera.position.set(center.x, center.y + radius * 0.6, center.z + dist);
// // //   controls.target.set(center.x, center.y + radius * 0.5, center.z);
// // //   controls.update();
// // // }

// // // // Toggle vista dall’alto (O)
// // // let _savedCam = null;
// // // function toggleTopDown(){
// // //   if (_savedCam){
// // //     camera.position.copy(_savedCam.pos);
// // //     controls.target.copy(_savedCam.target);
// // //     controls.enableRotate = _savedCam.rotate;
// // //     controls.update();
// // //     _savedCam = null;
// // //     return;
// // //   }
// // //   _savedCam = { pos: camera.position.clone(), target: controls.target.clone(), rotate: controls.enableRotate };
// // //   const gp = ghost.root.position, tp = targetPoint;
// // //   const mid = new THREE.Vector3( (gp.x+tp.x)/2, 0, (gp.z+tp.z)/2 );
// // //   camera.position.set(mid.x, 20, mid.z);
// // //   controls.target.set(mid.x, 0, mid.z);
// // //   controls.enableRotate = false;
// // //   controls.update();
// // // }

// // // function animate() {
// // //   requestAnimationFrame(animate);
// // //   const t = performance.now() * 0.001;
// // //   const dt = Math.min(0.05, t - _t); _t = t;

// // //   controls.update();

// // //   const posPrev = ghost ? ghost.root.position.clone() : null;

// // //   ghost?.update(dt);

// // //   // HUD
// // //   if (ghost) {
// // //     const dNow = Math.hypot(targetPoint.x - ghost.root.position.x,
// // //                             targetPoint.z - ghost.root.position.z);
// // //     animate._dPrev = dNow;
// // //     const thr = ghost._getThreshold ? ghost._getThreshold() : 1;
// // //     hud?.setDebug({ state: ghost.state ?? 'inactive', threshold: thr, exposure: ghost.exposure ?? 0, dist: dNow });
// // //   }

// // //   // Arrow
// // //   if (ghost && posPrev) {
// // //     const origin = new THREE.Vector3().copy(ghost.root.position); origin.y += 1.1;
// // //     const dir = new THREE.Vector3().copy(targetPoint).sub(origin); dir.y = 0;
// // //     const len = dir.length();
// // //     if (len > 1e-6) {
// // //       dir.multiplyScalar(1/len);
// // //       ghostArrow.position.copy(origin);
// // //       ghostArrow.setDirection(dir);
// // //       ghostArrow.setLength(THREE.MathUtils.clamp(len, 0.5, 3.0));
// // //     }
// // //     const moved = ghost.root.position.clone().sub(posPrev).setY(0);
// // //     const toT   = targetPoint.clone().sub(posPrev).setY(0);
// // //     if (moved.lengthSq()>1e-8 && toT.lengthSq()>1e-8) {
// // //       const dot = moved.normalize().dot(toT.normalize());
// // //       ghostArrow.setColor(new THREE.Color(dot < -0.01 ? 0xff3b30 : 0x18c08f));
// // //       if (window.DEBUG && dot < -0.01) console.warn('Ghost si muove al contrario! dot=', dot.toFixed(3));
// // //     }
// // //   }

// // //   // Linea & striscia a terra
// // //   if (ghost && seekLine && seekStrip) {
// // //     const gy = ground.position.y + 0.05;
// // //     const gx = ghost.root.position.x, gz = ghost.root.position.z;
// // //     const tx = targetPoint.x,        tz = targetPoint.z;

// // //     const a = new THREE.Vector3(gx, gy, gz);
// // //     const b = new THREE.Vector3(tx, gy, tz);
// // //     seekLineGeom.attributes.position.setXYZ(0, a.x, a.y, a.z);
// // //     seekLineGeom.attributes.position.setXYZ(1, b.x, b.y, b.z);
// // //     seekLineGeom.attributes.position.needsUpdate = true;
// // //     seekLineGeom.computeBoundingSphere();

// // //     const midX = (gx + tx) * 0.5;
// // //     const midZ = (gz + tz) * 0.5;
// // //     const len  = Math.hypot(tx - gx, tz - gz);
// // //     const yaw  = Math.atan2(tz - gz, tx - gx);
// // //     seekStrip.position.set(midX, gy, midZ);
// // //     seekStrip.rotation.y = yaw;
// // //     seekStrip.scale.set(len, 1, 1);
// // //   }

// // //   // Labels 3D
// // //   if (ghost && labelGhost && labelTarget) {
// // //     const gp = ghost.root.position, tp = targetPoint;
// // //     labelGhost.position.set(gp.x, gp.y + 1.8, gp.z);
// // //     labelTarget.position.set(tp.x, ground.position.y + 1.6, tp.z);

// // //     const d = Math.hypot(tp.x - gp.x, tp.z - gp.z);
// // //     const status = isLocked ? '[locked]' : '[click to move]';
// // //     labelGhost.userData.update(`ghost ${gp.x.toFixed(2)}, ${gp.z.toFixed(2)}  d=${d.toFixed(2)}`);
// // //     labelTarget.userData.update(`target ${tp.x.toFixed(2)}, ${tp.z.toFixed(2)} ${status}`);
// // //   }

// // //   renderer.render(scene, camera);
// // // }

// // // function onResize() {
// // //   camera.aspect = innerWidth / innerHeight;
// // //   camera.updateProjectionMatrix();
// // //   renderer.setSize(innerWidth, innerHeight);
// // // }





// WORKING MULTI-GHOST SPAWNER (8A) + target dinamico + sector/mix spawn + HUD spawner + Dynamic target + Shading 
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { initHUD } from './ui/hud.js';
import { GhostSpawner } from './systems/GhostSpawner.js';

window.DEBUG = false;

let scene, camera, renderer, controls, hud, spawner;
let ground, groundPlane;
let targetMarker, targetRing, targetBeacon;
let labelTarget;
let _t = performance.now() * 0.001;

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// Target lock / click-to-move
const LOCK_TARGET = false;
const FIX_X = 4.0, FIX_Z = -4.0;
let isLocked = LOCK_TARGET;
let targetPoint = null;

function makeLabel(){
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent:true, depthTest:false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(2.6, 0.65, 1);
  spr.userData.update = (text)=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.font = '48px ui-sans-serif,system-ui,Arial';
    ctx.fillStyle = '#00000088';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#ffe7b3';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width/2, canvas.height/2);
    tex.needsUpdate = true;
  };
  spr.userData.update('');
  return spr;
}

(async function start(){ await init(); animate(); })();

async function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fb3d9);
  scene.fog = new THREE.FogExp2(0xDFE9F3, 0.00015);

  // Camera + Controls
  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(0, 6, 24);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2.0;
  controls.maxDistance = 60.0;
  controls.target.set(0, 1.2, 0);
  controls.update();

  // Luci
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xfff1c1, 1.2); sun.position.set(5,10,4);
  scene.add(sun);

  // Ground
  ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: 0x6b5b53, roughness: 1 })
  );
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -0.10;
  scene.add(ground);

  // Piano infinito del terreno per fallback raycast
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ground.position.y);

  // Target marker & ring
  const markerR = 0.6, ringR = 0.75;
  targetMarker = new THREE.Mesh(
    new THREE.CircleGeometry(markerR, 64),
    new THREE.MeshBasicMaterial({ color: 0xff8c00, depthTest:false, depthWrite:false })
  );
  targetMarker.rotation.x = -Math.PI/2; targetMarker.renderOrder = 999;

  targetRing = new THREE.Mesh(
    new THREE.RingGeometry(markerR*0.7, ringR, 64),
    new THREE.MeshBasicMaterial({ color: 0x111111, depthTest:false, depthWrite:false })
  );
  targetRing.rotation.x = -Math.PI/2; targetRing.renderOrder = 999;

  scene.add(targetMarker, targetRing);
  targetPoint = targetMarker.position;

  // Beacon
  targetBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 2.0, 22),
    new THREE.MeshBasicMaterial({ color: 0xff8c00, transparent:true, opacity:0.95, depthTest:false })
  );
  targetBeacon.frustumCulled = false; targetBeacon.renderOrder = 998;
  scene.add(targetBeacon);

  // Label target
  labelTarget = makeLabel(); scene.add(labelTarget);

  // Target iniziale
  setTarget(FIX_X, FIX_Z);

  // HUD
  hud = initHUD();

  // === Spawner (8A) con direzioni ===
  const getGroundY = () => ground.position.y;
  const getFocusPos = () => targetPoint; // il target funge da "player" ora
  spawner = new GhostSpawner({
    scene, camera, getGroundY, getFocusPos,
    poolSize: 12,
    maxAlive: 4,
    spawnInterval: 4.0,
    minR: 6.0,
    maxR: 14.0,
    minPlayerDist: 5.0,
    minSeparation: 2.0,

    // --- LOGICA DIREZIONALE (compatibile col tuo GhostSpawner) ---
    spawnMode: 'mix',               // 'none'|'behind'|'front'|'left'|'right'|'mix'
    sectorHalfAngleDeg: 60,         // ampiezza del settore (±)
    mixWeights: { front: 0.25, behind: 0.5, left: 0.125, right: 0.125 },
    antiPopIn: false,               // true = evita spawn dentro frustum

    ghostOpts: {
      targetHeight: 2.2,
      opacityBody: 0.75,
      clearance: 0.06,
      speed: 1.2,
      keepDistance: 0.0,
      arriveRadius: 0.03,
    }
  });
  await spawner.init();

  // Inquadratura panoramica dell’anello di spawn
  focusOnArena();

  // Input
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  // Hotkeys utili
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k==='f') focusOnArena();
    if (k==='o') toggleTopDown();
    if (k==='l') setLocked(!isLocked);

    // ciclo modalità di spawn
    if (k==='b') {
      const order = ['mix','behind','front','left','right','none'];
      const i = order.indexOf(spawner.params.spawnMode);
      const next = order[(i+1) % order.length];
      spawner.setSpawnMode(next);
      console.log('[spawner] mode =', next);
    }
    // toggle anti pop-in
    if (k==='n') {
      spawner.toggleAntiPopIn();
      console.log('[spawner] antiPopIn =', spawner.params.antiPopIn);
    }

    // debug spawner
    if (k==='g' && !e.shiftKey) spawner.forceSpawnNow();
    if (k==='g' &&  e.shiftKey) spawner.fillToCap();
    if (k==='c') spawner.cleanseAll();
    if (k==='[') spawner.decMaxAlive(1);
    if (k===']') spawner.incMaxAlive(1);
    if (k===';') spawner.params.spawnInterval = Math.max(0.5, spawner.params.spawnInterval - 0.5);
    if (k==="'") spawner.params.spawnInterval += 0.5;

    // shader / materials debug (se vuoi)
    if (k==='9') {
      animate._dbgMode = ((animate._dbgMode ?? 0) + 1) % 4;
      for (const g of spawner.active) g.setDebugMode(animate._dbgMode);
      const labels = ['NORMAL','NOISE','MASK','EDGE'];
      console.log('[DEBUG MODE]', animate._dbgMode, labels[animate._dbgMode]);
    }
    if (k==='m') for (const g of spawner.active) g.logMaterialsDebug();
  });

  setLocked(isLocked);

  addEventListener('resize', onResize);
  Object.assign(window, { spawner, targetPoint, renderer, scene, camera });
}

function setLocked(v){
  isLocked = !!v;
  renderer.domElement.style.cursor = isLocked ? 'default' : 'crosshair';
  if (targetBeacon?.material) {
    targetBeacon.material.color.set(isLocked ? 0xff8c00 : 0x22cc88);
    targetBeacon.material.needsUpdate = true;
  }
}

function setTarget(x, z){
  const gy = ground.position.y + 0.02;
  targetMarker.position.set(x, gy, z);
  targetRing.position.set(x, gy + 0.001, z);
  targetBeacon.position.set(x, gy + 1.0, z);
}

function onPointerDown(e){
  if (isLocked) return;
  if (e.button !== 0) return;

  // NDC
  ndc.x =  (e.clientX / innerWidth)  * 2 - 1;
  ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);

  // 1) prova a colpire la mesh del terreno
  let hit = raycaster.intersectObject(ground, false)[0];
  if (hit) { setTarget(hit.point.x, hit.point.z); return; }

  // 2) fallback su piano infinito
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(groundPlane, p)) {
    setTarget(p.x, p.z);
  }
}

// Panoramic view of the spawn ring around the target
function focusOnArena(pad = 2.0){
  const r = (spawner?.params?.maxR ?? 14) + pad;
  const fov = camera.fov * Math.PI / 180;
  const dist = r / Math.sin(fov * 0.5);
  camera.position.set(targetPoint.x, Math.max(3, 0.4*r), targetPoint.z + dist);
  controls.target.set(targetPoint.x, 0.6, targetPoint.z);
  controls.update();
}

// Optional top-down toggle (O)
let _savedCam = null;
function toggleTopDown(){
  if (_savedCam){
    camera.position.copy(_savedCam.pos);
    controls.target.copy(_savedCam.target);
    controls.enableRotate = _savedCam.rotate;
    controls.update();
    _savedCam = null;
    return;
  }
  _savedCam = { pos: camera.position.clone(), target: controls.target.clone(), rotate: controls.enableRotate };
  camera.position.set(targetPoint.x, 20, targetPoint.z);
  controls.target.set(targetPoint.x, 0, targetPoint.z);
  controls.enableRotate = false;
  controls.update();
}

function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;
  const dt = Math.min(0.05, t - _t); _t = t;

  controls.update();

  // Spawner tick + update ghosts
  spawner?.update(dt);
  for (const g of spawner?.active ?? []) g.update(dt);

  // HUD (mostra anche i dati dello spawner se presenti)
  const lead = spawner?.firstActive?.();
  hud?.setDebug({
    state: lead?.state ?? 'none',
    threshold: lead?._getThreshold ? lead._getThreshold() : 1,
    exposure: lead?.exposure ?? 0,
    dist: lead ? Math.hypot(targetPoint.x - lead.root.position.x, targetPoint.z - lead.root.position.z) : 0,
    spawner: {
      alive: spawner?.active?.size ?? 0,
      pool: spawner?.pool?.length ?? 0,
      maxAlive: spawner?.params?.maxAlive ?? 0,
      nextIn: Math.max(0, spawner?.spawnCooldown ?? 0).toFixed(2),
      mode: spawner?.params?.spawnMode ?? 'mix',
      antiPopIn: !!spawner?.params?.antiPopIn
    }
  });

  // Target label position/text
  if (labelTarget) {
    labelTarget.position.set(targetPoint.x, ground.position.y + 1.6, targetPoint.z);
    const status = isLocked ? '[locked]' : '[click to move]';
    labelTarget.userData.update(`target ${targetPoint.x.toFixed(2)}, ${targetPoint.z.toFixed(2)} ${status}`);
  }

  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}













































































































// // // // // OLDER VERSIONS (ALREADY SAVED IN VERSION)

// // // // // // // // // nebbia funziona 
// // // // // // // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // // // // // // import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// // // // // // // let scene, camera, renderer, controls;
// // // // // // // let ambient, sun;
// // // // // // // let debugEl;
// // // // // // // let animateFog = true;       // [A] per ON/OFF
// // // // // // // const _fogShaders = new Set();

// // // // // // // /* ================== Procedural fog chunks (FBM) ================== */
// // // // // // // const NOISE_GLSL = `
// // // // // // // vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // // // // // vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // // // // // vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
// // // // // // // vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
// // // // // // // float snoise(vec3 v){
// // // // // // //   const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
// // // // // // //   vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
// // // // // // //   vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
// // // // // // //   vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
// // // // // // //   vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
// // // // // // //   float n_=0.142857142857; vec3 ns=n_*D.wyz - D.xzx;
// // // // // // //   vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
// // // // // // //   vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
// // // // // // //   vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
// // // // // // //   vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
// // // // // // //   vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
// // // // // // //   vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
// // // // // // //   p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
// // // // // // //   vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
// // // // // // //   return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
// // // // // // // }
// // // // // // // float FBM(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
// // // // // // // `;

// // // // // // // // 1) world position
// // // // // // // THREE.ShaderChunk.fog_pars_vertex = `
// // // // // // // #ifdef USE_FOG
// // // // // // //   varying vec3 vWorldPosition;
// // // // // // // #endif
// // // // // // // `;
// // // // // // // THREE.ShaderChunk.fog_vertex = `
// // // // // // // #ifdef USE_FOG
// // // // // // //   vWorldPosition = worldPosition.xyz;
// // // // // // // #endif
// // // // // // // `;

// // // // // // // // 2) uniform + noise
// // // // // // // THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
// // // // // // // #ifdef USE_FOG
// // // // // // //   uniform float fogTime;
// // // // // // //   uniform vec3 fogColor;
// // // // // // //   varying vec3 vWorldPosition;
// // // // // // //   #ifdef FOG_EXP2
// // // // // // //     uniform float fogDensity;
// // // // // // //   #else
// // // // // // //     uniform float fogNear;
// // // // // // //     uniform float fogFar;
// // // // // // //   #endif
// // // // // // // #endif
// // // // // // // `;

// // // // // // // // 3) formula (parametri come la repo)
// // // // // // // THREE.ShaderChunk.fog_fragment = `
// // // // // // // #ifdef USE_FOG
// // // // // // //   vec3 fogOrigin = cameraPosition;
// // // // // // //   vec3 dir = normalize(vWorldPosition - fogOrigin);
// // // // // // //   float dist = distance(vWorldPosition, fogOrigin);

// // // // // // //   // scala/velocità come repo
// // // // // // //   vec3 sampleP = vWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
// // // // // // //   float n = FBM(sampleP + FBM(sampleP)); n = n*0.5 + 0.5;

// // // // // // //   dist *= mix(n, 1.0, clamp((dist - 5000.0)/5000.0, 0.0, 1.0));
// // // // // // //   dist *= dist;

// // // // // // //   float y = dir.y; if(abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0)*1e-4;
// // // // // // //   float heightFactor = 0.05;
// // // // // // //   float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) *
// // // // // // //                     (1.0 - exp(-dist * y * fogDensity)) / y;

// // // // // // //   fogFactor = clamp(fogFactor, 0.0, 1.0);
// // // // // // //   gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
// // // // // // // #endif
// // // // // // // `;

// // // // // // // // aggancia uniform fogTime ai materiali
// // // // // // // function attachFogTo(root){
// // // // // // //   root.traverse?.((child)=>{
// // // // // // //     const mat = child.material; if(!mat) return;
// // // // // // //     const mats = Array.isArray(mat) ? mat : [mat];
// // // // // // //     mats.forEach(m=>{
// // // // // // //       m.fog = true;
// // // // // // //       const prev = m.onBeforeCompile;
// // // // // // //       m.onBeforeCompile = (shader)=>{
// // // // // // //         prev?.(shader);
// // // // // // //         shader.uniforms.fogTime = { value: 0.0 };
// // // // // // //         _fogShaders.add(shader);
// // // // // // //       };
// // // // // // //       m.needsUpdate = true;
// // // // // // //     });
// // // // // // //   });
// // // // // // // }

// // // // // // // /* ================== App ================== */
// // // // // // // init();
// // // // // // // animate();

// // // // // // // function init(){
// // // // // // //   // SCENA
// // // // // // //   scene = new THREE.Scene();
// // // // // // //   scene.background = new THREE.Color(0x87a0c0);

// // // // // // //   // CAMERA (far grande + camera alta)
// // // // // // //   camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 20000);
// // // // // // //   camera.position.set(0, 20, 120);   // un po’ più indietro per percepire il tappeto
// // // // // // //   camera.updateProjectionMatrix();

// // // // // // //   // RENDERER
// // // // // // //   renderer = new THREE.WebGLRenderer({
// // // // // // //     canvas: document.getElementById('game-canvas'),
// // // // // // //     antialias: true
// // // // // // //   });
// // // // // // //   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// // // // // // //   renderer.setSize(innerWidth, innerHeight);
// // // // // // //   renderer.outputColorSpace = THREE.SRGBColorSpace;
// // // // // // //   renderer.toneMapping = THREE.ACESFilmicToneMapping;
// // // // // // //   renderer.toneMappingExposure = 1.05;
// // // // // // //   renderer.shadowMap.enabled = true;

// // // // // // //   // LUCI
// // // // // // //   ambient = new THREE.AmbientLight(0xffffff, 0.35);
// // // // // // //   scene.add(ambient);
// // // // // // //   sun = new THREE.DirectionalLight(0xffe6b3, 1.0);
// // // // // // //   sun.position.set(60, 120, 80);
// // // // // // //   sun.castShadow = true;
// // // // // // //   scene.add(sun);

// // // // // // //   // FOG molto sottile (ordini di grandezza come repo)
// // // // // // //   scene.fog = new THREE.FogExp2(0xDFE9F3, 5e-6);

// // // // // // //   // TERRENO grande
// // // // // // //   const ground = new THREE.Mesh(
// // // // // // //     new THREE.PlaneGeometry(20000, 20000, 2, 2),
// // // // // // //     new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1 })
// // // // // // //   );
// // // // // // //   ground.rotation.x = -Math.PI/2;
// // // // // // //   ground.receiveShadow = true;
// // // // // // //   scene.add(ground);

// // // // // // //   // Qualche oggetto verticale per percepire la stratificazione
// // // // // // //   const matCone = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.7, metalness: 0.0 });
// // // // // // //   for(let i=0;i<60;i++){
// // // // // // //     const cone = new THREE.Mesh(new THREE.ConeGeometry(20, 200, 16), matCone);
// // // // // // //     const r = 1200 + Math.random()*1800;
// // // // // // //     const a = Math.random()*Math.PI*2;
// // // // // // //     cone.position.set(Math.cos(a)*r, 100, Math.sin(a)*r);
// // // // // // //     cone.castShadow = true;
// // // // // // //     scene.add(cone);
// // // // // // //   }

// // // // // // //   // tre box come nel test
// // // // // // //   const makeBox = (z, h=50, col=0x9db385)=>{
// // // // // // //     const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.1 });
// // // // // // //     const b = new THREE.Mesh(new THREE.BoxGeometry(60, h, 60), m);
// // // // // // //     b.position.set(0, h/2, z);
// // // // // // //     b.castShadow = true;
// // // // // // //     scene.add(b);
// // // // // // //   };
// // // // // // //   makeBox(-300, 80, 0xb9d097);
// // // // // // //   makeBox(-900, 120, 0x9db385);
// // // // // // //   makeBox(-1800, 200, 0x7f956c);

// // // // // // //   // collega la fog procedurale
// // // // // // //   attachFogTo(scene);

// // // // // // //   // CONTROLS
// // // // // // //   controls = new OrbitControls(camera, renderer.domElement);
// // // // // // //   controls.enableDamping = true;
// // // // // // //   controls.dampingFactor = 0.05;
// // // // // // //   controls.target.set(0, 60, -600);

// // // // // // //   // UI
// // // // // // //   setupDebug();
// // // // // // //   addEventListener('resize', onResize);
// // // // // // // }

// // // // // // // function animate(){
// // // // // // //   requestAnimationFrame(animate);

// // // // // // //   // anima (o ferma) la foschia
// // // // // // //   const t = performance.now() * 0.001;
// // // // // // //   _fogShaders.forEach(s => { s.uniforms.fogTime.value = animateFog ? t : 0.0; });

// // // // // // //   controls.update();
// // // // // // //   renderer.render(scene, camera);
// // // // // // //   updateDebug();
// // // // // // // }

// // // // // // // function onResize(){
// // // // // // //   camera.aspect = innerWidth/innerHeight;
// // // // // // //   camera.updateProjectionMatrix();
// // // // // // //   renderer.setSize(innerWidth, innerHeight);
// // // // // // // }

// // // // // // // /* ---------------- UI ---------------- */
// // // // // // // function setupDebug(){
// // // // // // //   debugEl = document.createElement('div');
// // // // // // //   debugEl.style.cssText = `
// // // // // // //     position:fixed; left:8px; bottom:8px; z-index:9999;
// // // // // // //     color:#dfe8f3; background:#0008; padding:6px 8px; border-radius:6px;
// // // // // // //     font:12px/1.35 monospace; user-select:none; pointer-events:none; white-space:pre;`;
// // // // // // //   document.body.appendChild(debugEl);

// // // // // // //   addEventListener('keydown', (e)=>{
// // // // // // //     switch(e.key){
// // // // // // //       case '[': scene.fog.density = clamp(scene.fog.density - 1e-6, 0, 1); break;
// // // // // // //       case ']': scene.fog.density = clamp(scene.fog.density + 1e-6, 0, 1); break;
// // // // // // //       case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.2, 3.0); break;
// // // // // // //       case '=':
// // // // // // //       case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.2, 3.0); break;
// // // // // // //       case 'a':
// // // // // // //       case 'A': animateFog = !animateFog; break; // toggle animazione
// // // // // // //     }
// // // // // // //   });
// // // // // // // }

// // // // // // // function updateDebug(){
// // // // // // //   if(!debugEl) return;
// // // // // // //   debugEl.textContent =
// // // // // // //     `FogExp2+FBM density: ${scene.fog?.density.toExponential(2)}  |  ` +
// // // // // // //     `Exposure: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
// // // // // // //     `shaders:${_fogShaders.size}  |  anim:${animateFog?'ON':'OFF'}\n` +
// // // // // // //     `Keys: [ / ] fog  |  - / = exposure  |  A anim  |  orbit drag`;
// // // // // // // }

// // // // // // // function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

// // // // // // // main.js — Pines only, Pipeline B (rules), Fog FBM  - funziona 

// // // // // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // // // // import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// // // // // import { TreeCatalog } from './assets/TreeCatalog.js';
// // // // // import { ForestSystem } from './systems/ForestSystem.js';

// // // // // /* ---------- REGOLE COLORI PINO (usate sia nel preload che nel ForestSystem) ---------- */

// // // // // const PINE_RULES = [
// // // // //   { // CHIOMA / AGHI
// // // // //     name: 'leaves',
// // // // //     matchMat: ['材质.001'],                   // <-- ESATTO
// // // // //     matchObj: ['leaves','leaf','ico','pine'],
// // // // //     color: '#7FA36B',
// // // // //     roughness: 0.95, metalness: 0.0,
// // // // //     emissiveScale: 0.5, emissiveIntensity: 0.08,
// // // // //     flatShading: true
// // // // //   },
// // // // //   { // TRONCO
// // // // //     name: 'trunk',
// // // // //     matchMat: ['材质'],                        // <-- ESATTO
// // // // //     matchObj: ['trunk','cylinder'],
// // // // //     color: '#B28C72',
// // // // //     roughness: 0.95, metalness: 0.0,
// // // // //     emissiveScale: 0.5, emissiveIntensity: 0.08,
// // // // //     flatShading: true
// // // // //   },
// // // // //   { // FALLBACK
// // // // //     name: 'other',
// // // // //     color: '#BFBFBF',
// // // // //     roughness: 0.95, metalness: 0.0,
// // // // //     emissiveScale: 0.4, emissiveIntensity: 0.04,
// // // // //     flatShading: true
// // // // //   }
// // // // // ];


// // // // // const PINE_OPTIONS = {
// // // // //   mtlUrl: '/assets/textures/trees/pine.mtl', // <<< AGGIUNTO
// // // // //   keepSourceMaps: false,   // ignoriamo MTL/texture del sorgente
// // // // //   scale: 18,               // alza/abbassa se li vuoi più grandi/piccoli
// // // // //   rules: PINE_RULES
// // // // // };

// // // // // /* ---------------- Fog FBM: patch ai chunk PRIMA di creare materiali ---------------- */
// // // // // const NOISE_GLSL = `
// // // // // vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // // // vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
// // // // // vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
// // // // // vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
// // // // // float snoise(vec3 v){
// // // // //   const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
// // // // //   vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
// // // // //   vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
// // // // //   vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
// // // // //   vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
// // // // //   float n_=0.142857142857; vec3 ns=n_*D.wyz - D.xzx;
// // // // //   vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
// // // // //   vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
// // // // //   vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw); vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
// // // // //   vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
// // // // //   vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
// // // // //   vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
// // // // //   p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
// // // // //   vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
// // // // //   return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
// // // // // }
// // // // // float FBM(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<6;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
// // // // // `;
// // // // // THREE.ShaderChunk.fog_pars_vertex = `
// // // // // #ifdef USE_FOG
// // // // //   varying vec3 vWorldPosition;
// // // // // #endif
// // // // // `;
// // // // // THREE.ShaderChunk.fog_vertex = `
// // // // // #ifdef USE_FOG
// // // // //   vWorldPosition = worldPosition.xyz;
// // // // // #endif
// // // // // `;
// // // // // THREE.ShaderChunk.fog_pars_fragment = NOISE_GLSL + `
// // // // // #ifdef USE_FOG
// // // // //   uniform float fogTime;
// // // // //   uniform vec3 fogColor;
// // // // //   varying vec3 vWorldPosition;
// // // // //   #ifdef FOG_EXP2
// // // // //     uniform float fogDensity;
// // // // //   #else
// // // // //     uniform float fogNear;
// // // // //     uniform float fogFar;
// // // // //   #endif
// // // // // #endif
// // // // // `;
// // // // // THREE.ShaderChunk.fog_fragment = `
// // // // // #ifdef USE_FOG
// // // // //   vec3 fogOrigin = cameraPosition;
// // // // //   vec3 dir = normalize(vWorldPosition - fogOrigin);
// // // // //   float dist = distance(vWorldPosition, fogOrigin);

// // // // //   vec3 sampleP = vWorldPosition * 0.00025 + vec3(0.0, 0.0, fogTime * 0.025);
// // // // //   float n = FBM(sampleP + FBM(sampleP)); n = n*0.5 + 0.5;

// // // // //   dist *= mix(n, 1.0, clamp((dist - 5000.0)/5000.0, 0.0, 1.0));
// // // // //   dist *= dist;

// // // // //   float y = dir.y; if(abs(y) < 1e-4) y = (y < 0.0 ? -1.0 : 1.0)*1e-4;
// // // // //   float heightFactor = 0.05;
// // // // //   float fogFactor = heightFactor * exp(-fogOrigin.y * fogDensity) *
// // // // //                     (1.0 - exp(-dist * y * fogDensity)) / y;

// // // // //   fogFactor = clamp(fogFactor, 0.0, 1.0);
// // // // //   gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
// // // // // #endif
// // // // // `;

// // // // // /* uniform fogTime per tutti i materiali presenti/nuovi */
// // // // // const _fogShaders = new Set();
// // // // // function attachFogTo(root){
// // // // //   root.traverse?.(child=>{
// // // // //     const mat = child.material; if(!mat) return;
// // // // //     const mats = Array.isArray(mat) ? mat : [mat];
// // // // //     mats.forEach(m=>{
// // // // //       m.fog = true;
// // // // //       const prev = m.onBeforeCompile;
// // // // //       m.onBeforeCompile = (shader)=>{
// // // // //         prev?.(shader);
// // // // //         shader.uniforms.fogTime = { value: 0.0 };
// // // // //         _fogShaders.add(shader);
// // // // //       };
// // // // //       m.needsUpdate = true;
// // // // //     });
// // // // //   });
// // // // // }

// // // // // /* ---------------- App ---------------- */
// // // // // let scene, camera, renderer, controls;
// // // // // let animateFog = true;
// // // // // let debugEl;

// // // // // init();
// // // // // animate();

// // // // // async function init(){
// // // // //   scene = new THREE.Scene();
// // // // //   scene.background = new THREE.Color(0x87a0c0);
// // // // //   scene.fog = new THREE.FogExp2(0xDFE9F3, 5e-6); // [ / ] per regolare

// // // // //   camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 20000);
// // // // //   camera.position.set(0, 20, 120);

// // // // //   renderer = new THREE.WebGLRenderer({
// // // // //     canvas: document.getElementById('game-canvas'),
// // // // //     antialias: true
// // // // //   });
// // // // //   renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
// // // // //   renderer.setSize(innerWidth, innerHeight);
// // // // //   renderer.outputColorSpace = THREE.SRGBColorSpace;
// // // // //   renderer.toneMapping = THREE.ACESFilmicToneMapping;
// // // // //   renderer.toneMappingExposure = 1.05;
// // // // //   renderer.shadowMap.enabled = true;

// // // // //   scene.add(new THREE.AmbientLight(0xffffff, 0.35));
// // // // //   const sun = new THREE.DirectionalLight(0xffe6b3, 1.0);
// // // // //   sun.position.set(60, 120, 80);
// // // // //   sun.castShadow = true;
// // // // //   scene.add(sun);

// // // // //   const ground = new THREE.Mesh(
// // // // //     new THREE.PlaneGeometry(20000, 20000),
// // // // //     new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 1 })
// // // // //   );
// // // // //   ground.rotation.x = -Math.PI/2;
// // // // //   ground.receiveShadow = true;
// // // // //   scene.add(ground);

// // // // //   controls = new OrbitControls(camera, renderer.domElement);
// // // // //   controls.enableDamping = true;
// // // // //   controls.dampingFactor = 0.05;
// // // // //   controls.target.set(0, 60, -600);

// // // // //   attachFogTo(scene);         // ground & luci già presenti
// // // // //   await setupForest(scene);   // genera instanced
// // // // //   attachFogTo(scene);         // attacca fog anche agli instanced

// // // // //   setupDebug();
// // // // //   addEventListener('resize', onResize);
// // // // // }

// // // // // async function setupForest(scene){
// // // // //   const catalog = new TreeCatalog();

// // // // //   // Preload esplicito (utile per scovare subito eventuali path errati)
// // // // //   await catalog.load('pine', '/assets/textures/trees/pine.obj', PINE_OPTIONS);

// // // // //   const forest = new ForestSystem(scene, {
// // // // //     seed: 2025,
// // // // //     innerRadius: 200,
// // // // //     outerRadius: 6000,
// // // // //     minSpacing: 22,
// // // // //     maxSpacing: 34,
// // // // //     count: 4500,
// // // // //     scale: [0.9, 1.35],
// // // // //     clearings: [{ x:0, z:0, r:200 }],
// // // // //     types: [{
// // // // //       name: 'pine',
// // // // //       url: '/assets/textures/trees/pine.obj',
// // // // //       options: PINE_OPTIONS,             // <<< IMPORTANTISSIMO
// // // // //       occluderHeight: 160,
// // // // //       occluderRadiusScale: 0.9
// // // // //     }]
// // // // //   }, catalog);

// // // // //   const result = await forest.generate();
// // // // //   console.log('Forest ready:', result);
// // // // //   window.forest = forest;
// // // // // }

// // // // // function animate(){
// // // // //   requestAnimationFrame(animate);
// // // // //   const t = performance.now() * 0.001;
// // // // //   _fogShaders.forEach(s => { s.uniforms.fogTime.value = animateFog ? t : 0.0; });
// // // // //   controls.update();
// // // // //   renderer.render(scene, camera);
// // // // //   updateDebug();
// // // // // }

// // // // // function onResize(){
// // // // //   camera.aspect = innerWidth/innerHeight;
// // // // //   camera.updateProjectionMatrix();
// // // // //   renderer.setSize(innerWidth, innerHeight);
// // // // // }

// // // // // /* -------- mini UI -------- */
// // // // // function setupDebug(){
// // // // //   debugEl = document.createElement('div');
// // // // //   debugEl.style.cssText = `
// // // // //     position:fixed; left:8px; bottom:8px; z-index:9999;
// // // // //     color:#dfe8f3; background:#0008; padding:6px 8px; border-radius:6px;
// // // // //     font:12px/1.35 monospace; user-select:none; pointer-events:none; white-space:pre;`;
// // // // //   document.body.appendChild(debugEl);

// // // // //   addEventListener('keydown', (e)=>{
// // // // //     switch(e.key){
// // // // //       case '[': scene.fog.density = clamp(scene.fog.density - 1e-6, 0, 1); break;
// // // // //       case ']': scene.fog.density = clamp(scene.fog.density + 1e-6, 0, 1); break;
// // // // //       case '-': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure - 0.05, 0.2, 3.0); break;
// // // // //       case '=':
// // // // //       case '+': renderer.toneMappingExposure = clamp(renderer.toneMappingExposure + 0.05, 0.2, 3.0); break;
// // // // //       case 'a':
// // // // //       case 'A': animateFog = !animateFog; break;
// // // // //     }
// // // // //   });
// // // // // }
// // // // // function updateDebug(){
// // // // //   if(!debugEl) return;
// // // // //   debugEl.textContent =
// // // // //     `FogExp2+FBM density: ${scene.fog?.density.toExponential(2)}  |  ` +
// // // // //     `Exposure: ${renderer.toneMappingExposure.toFixed(2)}  |  ` +
// // // // //     `shaders:${_fogShaders.size}  |  anim:${animateFog?'ON':'OFF'}\n` +
// // // // //     `Keys: [ / ] fog  |  - / = exposure  |  A anim  |  orbit drag`;
// // // // // }
// // // // // function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
