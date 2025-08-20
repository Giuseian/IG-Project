// // // // src/entities/Ghost.js
// // // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // // import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
// // // import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
// // // import { patchGhostMaterial } from '../entities/dissolvePatch.js';

// // // /* -------- feature detector: keeps eyes/mouth/cheeks opaque & colored -------- */
// // // function isFeature(mesh, mat) {
// // //   const a = (mesh?.name || '').toLowerCase();
// // //   const b = (mat?.name  || '').toLowerCase();
// // //   const re = /(ghost_)?(eyes?|mouth|cheeks?)/;
// // //   return re.test(a) || re.test(b);
// // // }

// // // function buildGhostMaterialsForMesh(mesh, opacityBody) {
// // //   const src = mesh.material;
// // //   const srcMats = Array.isArray(src) ? src : [src];
// // //   const geom = mesh.geometry;

// // //   const newMats = srcMats.map((m) => {
// // //     const feature = isFeature(mesh, m);
// // //     if (feature) {
// // //       return new THREE.MeshStandardMaterial({
// // //         name: (m?.name || '') + '_feature',
// // //         color: (m?.color ? m.color.clone() : new THREE.Color(0x111111)),
// // //         metalness: 0.0,
// // //         roughness: 0.6,
// // //         transparent: false,
// // //         depthWrite: true,
// // //         depthTest: true,
// // //         vertexColors: !!geom.attributes.color,
// // //       });
// // //     } else {
// // //       const mat = new THREE.MeshStandardMaterial({
// // //         name: (m?.name || '') + '_body',
// // //         color: (m?.color ? m.color.clone() : new THREE.Color(0xffffff)),
// // //         metalness: 0.0,
// // //         roughness: 0.35,
// // //         transparent: true,
// // //         opacity: opacityBody,
// // //         emissive: new THREE.Color(0x66ffff),
// // //         emissiveIntensity: 0.25,
// // //         depthWrite: false,
// // //         depthTest: true,
// // //         vertexColors: !!geom.attributes.color,
// // //       });
// // //       patchGhostMaterial(mat); // inject uniforms (uPulseTime, uThreshold…) — no discard yet
// // //       (mesh.userData._uniformSets ||= []).push(mat.userData._ghostUniforms);
// // //       return mat;
// // //     }
// // //   });

// // //   mesh.material = Array.isArray(src) ? newMats : newMats[0];
// // //   return newMats;
// // // }

// // // // tmp vectors (riutilizzati per evitare allocazioni)
// // // const _tmpW = new THREE.Vector3();
// // // const _tmpW2 = new THREE.Vector3();

// // // export class Ghost {
// // //   /**
// // //    * @param {Object} opts
// // //    *  - url: string to .glb or .obj
// // //    *  - targetHeight: desired world height (meters)
// // //    *  - opacityBody: alpha for the body
// // //    *  - getGroundY(x,z): funzione che ritorna la quota terreno in WORLD
// // //    *  - clearance: distanza minima dal terreno (m)
// // //    */
// // //   constructor(opts = {}) {
// // //     this.url           = opts.url ?? '/assets/models/ghost/ghost.glb';
// // //     this.targetHeight  = opts.targetHeight ?? 2.2;
// // //     this.opacityBody   = opts.opacityBody ?? 0.75;

// // //     // terreno/world awareness
// // //     this.getGroundY = opts.getGroundY || ((x, z) => 0.0);
// // //     this.clearance  = (opts.clearance ?? 0.05);

// // //     // World transform lives on "root"; idle animation lives on "rig"
// // //     this.root = new THREE.Group(); this.root.name = 'Ghost';
// // //     this.rig  = new THREE.Group(); this.rig.name  = 'GhostRig';
// // //     this.root.add(this.rig);

// // //     this.model  = null;
// // //     this.materials   = [];
// // //     this.uniformSets = []; // {uPulseTime, uThreshold, ...} per body material
// // //     this.baseRadius  = 0.8;

// // //     // --- Idle animation params (can be randomized later by a Director) ---
// // //     // Sane defaults for a calm float; all values in meters/radians/seconds
// // //     this.idle = {
// // //       baseY: 0.01,                          // rest height above ground (locale al rig)
// // //       phase: Math.random() * Math.PI * 2,   // de-sync multiple ghosts
// // //       ampBob: 0.25,                         // vertical amplitude (m)
// // //       omegaBob: 1.3,                        // vertical angular speed (rad/s) ~0.2 Hz
// // //       swayAmpX: THREE.MathUtils.degToRad(3),// tilt around X (radians)
// // //       swayAmpZ: THREE.MathUtils.degToRad(3),// tilt around Z (radians)
// // //       swayOmega: 1.05,                      // angular speed for sway (rad/s)
// // //       clampGround: true,                    // clamp rispetto al terreno reale
// // //       minY: 0.0,                            // min locale
// // //       maxY: null,                           // max locale
// // //     };

// // //     // Debug knobs you can tweak from console
// // //     this.debug = {
// // //       freezeIdle: false,
// // //       scaleIdle: 1.0, // multiplies all amplitudes
// // //     };

// // //     this._time = 0; // also drives uPulseTime
// // //   }

// // //   async load() {
// // //     const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');
// // //     const model = isGLB
// // //       ? (await new GLTFLoader().loadAsync(this.url)).scene
// // //       : (await new OBJLoader().loadAsync(this.url));

// // //     this.model = model;
// // //     this.rig.add(model); // <-- IMPORTANT: model goes under rig (idle motion lives here)

// // //     // Normalize: center XZ, lift to y=0, scale to target height, re-lift
// // //     this._normalize();

// // //     // Apply material policy + shader patch
// // //     this._applyMaterials();

// // //     return this;
// // //   }

// // //   addTo(parent) { parent.add(this.root); return this; }

// // //   setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
// // //   getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }
// // //   setVisible(v) { this.root.visible = !!v; }

// // //   setBaseY(y) { this.idle.baseY = y; return this; }

// // //   setIdleParams(partial = {}) {
// // //     Object.assign(this.idle, partial);
// // //     return this;
// // //   }

// // //   update(dt) {
// // //     this._time += dt;
// // //     for (const set of this.uniformSets) {
// // //       if (set?.uPulseTime) set.uPulseTime.value = this._time;
// // //     }

// // //     if (!this.debug.freezeIdle) {
// // //       const k   = Math.max(0, this.debug.scaleIdle || 1);
// // //       const t   = this._time;
// // //       const ph  = this.idle.phase;

// // //       const y  = this.idle.baseY + (this.idle.ampBob * k) * Math.sin(this.idle.omegaBob * t + ph);
// // //       const rx = (this.idle.swayAmpX * k) * Math.sin(this.idle.swayOmega * t + ph * 0.7);
// // //       const rz = (this.idle.swayAmpZ * k) * Math.sin(this.idle.swayOmega * t + ph * 1.13);

// // //       // ---------- clamp robusto rispetto al terreno (in WORLD) ----------
// // //       let floorLocal = -Infinity;

// // //       // min/ground in WORLD -> convertito nello spazio locale del root (stesso spazio di rig.position)
// // //       if (this.idle.clampGround && this.root) {
// // //         // world position del root (serve x,z mondo)
// // //         this.root.getWorldPosition(_tmpW);
// // //         const xw = _tmpW.x, zw = _tmpW.z;

// // //         // quota terreno in (x,z) mondo + margine
// // //         const groundY = this.getGroundY(xw, zw) + this.clearance;

// // //         // prendi quel punto in WORLD (stessa x,z del root, y = groundY) e converti a LOCAL root
// // //         _tmpW2.set(xw, groundY, zw);
// // //         this.root.worldToLocal(_tmpW2);
// // //         const minLocalFromWorld = _tmpW2.y; // soglia locale per rig.position.y

// // //         floorLocal = Math.max(floorLocal, minLocalFromWorld);
// // //       }

// // //       if (typeof this.idle.minY === 'number') floorLocal = Math.max(floorLocal, this.idle.minY);
// // //       const ceilLocal = (typeof this.idle.maxY === 'number') ? this.idle.maxY : +Infinity;

// // //       const ySafe = Math.min(ceilLocal, Math.max(floorLocal, y));

// // //       this.rig.position.y = ySafe;
// // //       this.rig.rotation.x = rx;
// // //       this.rig.rotation.z = rz;
// // //     }
// // //   }

// // //   // ---------- internals ----------
// // //   _normalize() {
// // //     // Compute bbox BEFORE scaling
// // //     const box = new THREE.Box3().setFromObject(this.model);
// // //     const size = new THREE.Vector3(); box.getSize(size);
// // //     const center = new THREE.Vector3(); box.getCenter(center);

// // //     // Center XZ and lift so base is at y=0
// // //     this.model.position.x -= center.x;
// // //     this.model.position.z -= center.z;
// // //     this.model.position.y -= box.min.y;

// // //     // Scale to target height
// // //     const currentH = size.y || 1.0;
// // //     const s = this.targetHeight / currentH;
// // //     this.model.scale.setScalar(s);

// // //     // Re-lift AFTER scaling so the base is EXACTLY y=0
// // //     const box2 = new THREE.Box3().setFromObject(this.model);
// // //     this.model.position.y -= box2.min.y;

// // //     // Base radius (used later by spawner/LOS spacing)
// // //     const size2 = new THREE.Vector3(); box2.getSize(size2);
// // //     this.baseRadius = 0.5 * Math.hypot(size2.x, size2.z);
// // //   }

// // //   _applyMaterials() {
// // //     this.materials.length = 0;
// // //     this.uniformSets.length = 0;

// // //     this.model.traverse((o) => {
// // //       if (!o.isMesh) return;
// // //       const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
// // //       this.materials.push(...(Array.isArray(mats) ? mats : [mats]));
// // //       if (o.userData._uniformSets) this.uniformSets.push(...o.userData._uniformSets);

// // //       o.castShadow = false;
// // //       o.receiveShadow = false;
// // //       o.renderOrder = 10;   // ↑ più alto: evita che il ground lo “copra”
// // //     });
// // //   }
// // // }


// // // src/entities/Ghost.js
// // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
// // import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
// // import { patchGhostMaterial } from '../entities/dissolvePatch.js';

// // /* -------- feature detector: keeps eyes/mouth/cheeks opaque & colored -------- */
// // function isFeature(mesh, mat) {
// //   const a = (mesh?.name || '').toLowerCase();
// //   const b = (mat?.name  || '').toLowerCase();
// //   const re = /(ghost_)?(eyes?|mouth|cheeks?)/;
// //   return re.test(a) || re.test(b);
// // }

// // function buildGhostMaterialsForMesh(mesh, opacityBody) {
// //   const src = mesh.material;
// //   const srcMats = Array.isArray(src) ? src : [src];
// //   const geom = mesh.geometry;

// //   const newMats = srcMats.map((m) => {
// //     const feature = isFeature(mesh, m);
// //     if (feature) {
// //       return new THREE.MeshStandardMaterial({
// //         name: (m?.name || '') + '_feature',
// //         color: (m?.color ? m.color.clone() : new THREE.Color(0x111111)),
// //         metalness: 0.0,
// //         roughness: 0.6,
// //         transparent: false,
// //         depthWrite: true,
// //         depthTest: true,
// //         vertexColors: !!geom.attributes.color,
// //       });
// //     } else {
// //       const mat = new THREE.MeshStandardMaterial({
// //         name: (m?.name || '') + '_body',
// //         color: (m?.color ? m.color.clone() : new THREE.Color(0xffffff)),
// //         metalness: 0.0,
// //         roughness: 0.35,
// //         transparent: true,
// //         opacity: opacityBody,
// //         emissive: new THREE.Color(0x66ffff),
// //         emissiveIntensity: 0.25,
// //         depthWrite: false,
// //         depthTest: true,
// //         vertexColors: !!geom.attributes.color,
// //       });
// //       patchGhostMaterial(mat); // inject uniforms (uPulseTime, uThreshold…) — no discard yet
// //       (mesh.userData._uniformSets ||= []).push(mat.userData._ghostUniforms);
// //       return mat;
// //     }
// //   });

// //   mesh.material = Array.isArray(src) ? newMats : newMats[0];
// //   return newMats;
// // }

// // // tmp vectors (riutilizzati per evitare allocazioni)
// // const _tmpW  = new THREE.Vector3();
// // const _tmpW2 = new THREE.Vector3();
// // const _dir   = new THREE.Vector3();

// // export class Ghost {
// //   /**
// //    * @param {Object} opts
// //    *  - url: string to .glb or .obj
// //    *  - targetHeight: desired world height (meters)
// //    *  - opacityBody: alpha for the body
// //    *  - getGroundY(x,z): quota terreno in WORLD
// //    *  - clearance: distanza minima dal terreno (m)
// //    *  - getTargetPos(): funzione che ritorna la pos del player/camera (Vector3 WORLD)
// //    *  - speed, keepDistance: AI base in 'active'
// //    */
// //   constructor(opts = {}) {
// //     this.url           = opts.url ?? '/assets/models/ghost/ghost.glb';
// //     this.targetHeight  = opts.targetHeight ?? 2.2;
// //     this.opacityBody   = opts.opacityBody ?? 0.75;

// //     // terreno/world awareness
// //     this.getGroundY = opts.getGroundY || ((x, z) => 0.0);
// //     this.clearance  = (opts.clearance ?? 0.05);

// //     // target (es. camera/player) per l'AI base
// //     this.getTargetPos = opts.getTargetPos || null;

// //     // World transform lives on "root"; idle animation lives on "rig"
// //     this.root = new THREE.Group(); this.root.name = 'Ghost';
// //     this.rig  = new THREE.Group(); this.rig.name  = 'GhostRig';
// //     this.root.add(this.rig);
// //     this.root.visible = false; // evita flicker prima della FSM

// //     this.model  = null;
// //     this.materials   = [];
// //     this.uniformSets = []; // {uPulseTime, uThreshold, ...} per body material
// //     this.baseRadius  = 0.8;

// //     // --- Idle animation params (manuale) ---
// //     this.idle = {
// //       baseY: 0.01,                          // rest height sopra base
// //       phase: Math.random() * Math.PI * 2,
// //       ampBob: 0.25,
// //       omegaBob: 1.3,
// //       swayAmpX: THREE.MathUtils.degToRad(3),
// //       swayAmpZ: THREE.MathUtils.degToRad(3),
// //       swayOmega: 1.05,
// //       clampGround: true,
// //       minY: 0.0,
// //       maxY: null,
// //     };

// //     // --- FSM & gameplay ---
// //     this.state    = 'inactive';
// //     this.tState   = 0;        // tempo nello stato corrente
// //     this.exposure = 0;        // riempito dal Beam in futuro
// //     this.params = {
// //       appearDuration:   1.2,               // s
// //       cleanseDuration:  0.8,               // s
// //       speed:            opts.speed ?? 1.2, // m/s
// //       keepDistance:     opts.keepDistance ?? 1.2, // m
// //       arriveRadius:     opts.arriveRadius ?? 0.02, // NEW: tolleranza di arrivo (2 cm)
// //       turnSpeed:        5.0,               // rad/s (se vuoi ruotarlo verso il target)
// //       exposureFalloff:  0.6,               // al/s quando non illuminato
// //     };

// //     this._time = 0; // guida uPulseTime
// //   }

// //   async load() {
// //     const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');
// //     const model = isGLB
// //       ? (await new GLTFLoader().loadAsync(this.url)).scene
// //       : (await new OBJLoader().loadAsync(this.url));

// //     this.model = model;
// //     this.rig.add(model); // idle vive sul rig

// //     // Normalize: center XZ, lift to y=0, scala a target height
// //     this._normalize();

// //     // Material policy + shader patch
// //     this._applyMaterials();

// //     // stato iniziale coerente
// //     this._setThreshold(1.0);
// //     this.setVisible(false);

// //     return this;
// //   }

// //   addTo(parent) { parent.add(this.root); return this; }

// //   setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
// //   getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }
// //   setVisible(v) { this.root.visible = !!v; return this; }

// //   setBaseY(y) { this.idle.baseY = y; return this; }
// //   setIdleParams(partial = {}) { Object.assign(this.idle, partial); return this; }

// //   // ---------- API FSM ----------
// //   spawnAt(x, y, z) { this.setPosition(x, y, z); return this.appear(); }
// //   appear() { return this._enter('appearing'); }
// //   activate() { return this._enter('active'); }
// //   cleanse() { return this._enter('cleansing'); }
// //   deactivate() { return this._enter('inactive'); }

// //   applyExposure(delta) {
// //     // chiamata dal Beam in futuro (+) o decadimento (-)
// //     this.exposure = THREE.MathUtils.clamp(this.exposure + delta, 0, 1);
// //     if (this.exposure >= 1 && this.state === 'active') {
// //       this.cleanse();
// //       return true;
// //     }
// //     return false;
// //   }

// //   // ---------- loop ----------
// //   update(dt) {
// //     this._time += dt;

// //     // anima il breathing dell'emissive (già patchato nello shader)
// //     for (const set of this.uniformSets) {
// //       if (set?.uPulseTime) set.uPulseTime.value = this._time;
// //     }

// //     // IDLE manuale (bobbing+sway + clamp terreno)
// //     if (this.root.visible) this._updateIdle(dt);

// //     // FSM
// //     this.tState += dt;
// //     switch (this.state) {
// //       case 'appearing': this._updateAppearing(dt); break;
// //       case 'active':    this._updateActive(dt);    break;
// //       case 'cleansing': this._updateCleansing(dt); break;
// //       case 'inactive':  /* noop */                 break;
// //     }
// //   }

// //   // ---------- internals ----------
// //   _enter(next) {
// //     this.state = next;
// //     this.tState = 0;

// //     if (next === 'inactive') {
// //       this.setVisible(false);
// //       this.exposure = 0;
// //       this._setThreshold(1.0);
// //     }

// //     if (next === 'appearing') {
// //       this.setVisible(true);
// //       this.exposure = 0;
// //       this._setThreshold(1.0); // parte “completamente dissolto”
// //     }

// //     if (next === 'active') {
// //       this.setVisible(true);
// //       this._setThreshold(0.25); // stato di “presenza” nel mondo
// //     }

// //     if (next === 'cleansing') {
// //       // animato in _updateCleansing
// //     }

// //     return this;
// //   }

// //   _updateAppearing(dt) {
// //     const d = this.params.appearDuration || 1.0;
// //     const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
// //     const k = t * t * (3 - 2 * t); // smoothstep
// //     const thr = THREE.MathUtils.lerp(1.0, 0.25, k);
// //     this._setThreshold(thr);

// //     if (t >= 1 || thr <= 0.26) this.activate();
// //   }

// //   _updateActive(dt) {
// //     // decadimento exposure (temporaneo finché non usi il Beam)
// //     if (this.exposure > 0) this.applyExposure(-this.params.exposureFalloff * dt);

// //     if (typeof this.getTargetPos !== 'function') return;
// //     const target = this.getTargetPos();
// //     if (!target) return;

// //     // vettore WORLD: ghost -> target solo su XZ
// //     _dir.subVectors(target, this.root.position);
// //     _dir.y = 0;

// //     let dist = _dir.length();
// //     if (!isFinite(dist) || dist < 1e-6) return;

// //     const stop    = Math.max(0, this.params.keepDistance || 0);
// //     const arriveR = Math.max(1e-3, this.params.arriveRadius || 0.03); // evita 0.0

// //     // Normalizza ORA (serve sia per snap sia per step)
// //     _dir.multiplyScalar(1 / dist);

// //     // distanza “utile” oltre lo stop (mai negativa)
// //     const desired = Math.max(0, dist - stop);

// //     // dentro la zona di arrivo → snap preciso sul bordo dello stop
// //     if (desired <= arriveR) {
// //       // pos finale = target - dir * stop (su XZ)
// //       this.root.position.x = target.x - _dir.x * stop;
// //       this.root.position.z = target.z - _dir.z * stop;
// //       return;
// //     }

// //     // muovi SEMPRE in avanti (step clamped >= 0 e <= desired)
// //     const step = Math.min(this.params.speed * dt, desired);
// //     this.root.position.x += _dir.x * step;
// //     this.root.position.z += _dir.z * step;
// //   }




// //   _updateCleansing(dt) {
// //     const d = this.params.cleanseDuration || 0.8;
// //     const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
// //     const k = t * t * (3 - 2 * t);
// //     const start = Math.max(0.25, this._getThreshold());
// //     const thr = THREE.MathUtils.lerp(start, 1.0, k);
// //     this._setThreshold(thr);

// //     if (t >= 1 || thr >= 0.999) this.deactivate();
// //   }

// //   _updateIdle(dt) {
// //     const k   = 1.0;
// //     const t   = this._time;
// //     const ph  = this.idle.phase;

// //     const y  = this.idle.baseY + (this.idle.ampBob * k) * Math.sin(this.idle.omegaBob * t + ph);
// //     const rx = (this.idle.swayAmpX * k) * Math.sin(this.idle.swayOmega * t + ph * 0.7);
// //     const rz = (this.idle.swayAmpZ * k) * Math.sin(this.idle.swayOmega * t + ph * 1.13);

// //     // clamp rispetto al terreno (WORLD) convertito in locale root
// //     let floorLocal = -Infinity;
// //     if (this.idle.clampGround && this.root) {
// //       this.root.getWorldPosition(_tmpW);
// //       const xw = _tmpW.x, zw = _tmpW.z;

// //       const groundY = this.getGroundY(xw, zw) + this.clearance;
// //       _tmpW2.set(xw, groundY, zw);
// //       this.root.worldToLocal(_tmpW2);
// //       const minLocalFromWorld = _tmpW2.y;

// //       floorLocal = Math.max(floorLocal, minLocalFromWorld);
// //     }
// //     if (typeof this.idle.minY === 'number') floorLocal = Math.max(floorLocal, this.idle.minY);
// //     const ceilLocal = (typeof this.idle.maxY === 'number') ? this.idle.maxY : +Infinity;

// //     const ySafe = Math.min(ceilLocal, Math.max(floorLocal, y));

// //     this.rig.position.y = ySafe;
// //     this.rig.rotation.x = rx;
// //     this.rig.rotation.z = rz;
// //   }

// //   _setThreshold(v) {
// //     for (const set of this.uniformSets) {
// //       if (set?.uThreshold) set.uThreshold.value = v;
// //     }
// //   }
// //   _getThreshold() {
// //     for (const set of this.uniformSets) {
// //       if (set?.uThreshold) return set.uThreshold.value;
// //     }
// //     return 1.0;
// //   }

// //   _normalize() {
// //     // Compute bbox BEFORE scaling
// //     const box = new THREE.Box3().setFromObject(this.model);
// //     const size = new THREE.Vector3(); box.getSize(size);
// //     const center = new THREE.Vector3(); box.getCenter(center);

// //     // Center XZ and lift so base is at y=0
// //     this.model.position.x -= center.x;
// //     this.model.position.z -= center.z;
// //     this.model.position.y -= box.min.y;

// //     // Scale to target height
// //     const currentH = size.y || 1.0;
// //     const s = this.targetHeight / currentH;
// //     this.model.scale.setScalar(s);

// //     // Re-lift AFTER scaling so the base is EXACTLY y=0
// //     const box2 = new THREE.Box3().setFromObject(this.model);
// //     this.model.position.y -= box2.min.y;

// //     // Base radius (used later by spawner/LOS spacing)
// //     const size2 = new THREE.Vector3(); box2.getSize(size2);
// //     this.baseRadius = 0.5 * Math.hypot(size2.x, size2.z);
// //   }

// //   _applyMaterials() {
// //     this.materials.length = 0;
// //     this.uniformSets.length = 0;

// //     this.model.traverse((o) => {
// //       if (!o.isMesh) return;
// //       const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
// //       this.materials.push(...(Array.isArray(mats) ? mats : [mats]));
// //       if (o.userData._uniformSets) this.uniformSets.push(...o.userData._uniformSets);

// //       o.castShadow = false;
// //       o.receiveShadow = false;
// //       o.renderOrder = 10;   // ↑ più alto: evita che il ground lo “copra”
// //     });
// //   }
// // }



// // src/entities/Ghost.js
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
// import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
// import { patchGhostMaterial } from '../entities/dissolvePatch.js';

// /* -------- feature detector: keeps eyes/mouth/cheeks opaque & colored -------- */
// function isFeature(mesh, mat) {
//   const a = (mesh?.name || '').toLowerCase();
//   const b = (mat?.name  || '').toLowerCase();
//   const re = /(ghost_)?(eyes?|mouth|cheeks?)/;
//   return re.test(a) || re.test(b);
// }

// function buildGhostMaterialsForMesh(mesh, opacityBody) {
//   const src = mesh.material;
//   const srcMats = Array.isArray(src) ? src : [src];
//   const geom = mesh.geometry;

//   const newMats = srcMats.map((m) => {
//     const feature = isFeature(mesh, m);
//     if (feature) {
//       return new THREE.MeshStandardMaterial({
//         name: (m?.name || '') + '_feature',
//         color: (m?.color ? m.color.clone() : new THREE.Color(0x111111)),
//         metalness: 0.0,
//         roughness: 0.6,
//         transparent: false,
//         depthWrite: true,
//         depthTest: true,
//         vertexColors: !!geom.attributes.color,
//       });
//     } else {
//       const mat = new THREE.MeshStandardMaterial({
//         name: (m?.name || '') + '_body',
//         color: (m?.color ? m.color.clone() : new THREE.Color(0xffffff)),
//         metalness: 0.0,
//         roughness: 0.35,
//         transparent: true,
//         opacity: opacityBody,
//         emissive: new THREE.Color(0x66ffff),
//         emissiveIntensity: 0.25,
//         depthWrite: false,
//         depthTest: true,
//         vertexColors: !!geom.attributes.color,
//       });
//       // uniforms (uPulseTime, uThreshold, …) – niente discard qui (arriva allo step shader)
//       patchGhostMaterial(mat);
//       (mesh.userData._uniformSets ||= []).push(mat.userData._ghostUniforms);
//       return mat;
//     }
//   });

//   mesh.material = Array.isArray(src) ? newMats : newMats[0];
//   return newMats;
// }

// // tmp vectors (riutilizzati per evitare allocazioni)
// const _tmpW  = new THREE.Vector3();
// const _tmpW2 = new THREE.Vector3();
// const _dir   = new THREE.Vector3();

// export class Ghost {
//   /**
//    * @param {Object} opts
//    *  - url: string to .glb or .obj
//    *  - targetHeight: desired world height (meters)
//    *  - opacityBody: alpha for the body
//    *  - getGroundY(x,z): quota terreno in WORLD
//    *  - clearance: distanza minima dal terreno (m)
//    *  - getTargetPos(): funzione che ritorna la pos del player/camera (Vector3 WORLD)
//    *  - speed, keepDistance, arriveRadius
//    */
//   constructor(opts = {}) {
//     this.url           = opts.url ?? '/assets/models/ghost/ghost.glb';
//     this.targetHeight  = opts.targetHeight ?? 2.2;
//     this.opacityBody   = opts.opacityBody ?? 0.75;

//     // terreno/world awareness
//     this.getGroundY = opts.getGroundY || ((x, z) => 0.0);
//     this.clearance  = (opts.clearance ?? 0.05);

//     // target (es. camera/player) per l'AI base
//     this.getTargetPos = opts.getTargetPos || null;

//     // World transform lives on "root"; idle animation lives on "rig"
//     this.root = new THREE.Group(); this.root.name = 'Ghost';
//     this.rig  = new THREE.Group(); this.rig.name  = 'GhostRig';
//     this.root.add(this.rig);
//     this.root.visible = false; // evita flicker prima della FSM

//     this.model  = null;
//     this.materials   = [];
//     this.uniformSets = []; // {uPulseTime, uThreshold, ...} per body material
//     this.baseRadius  = 0.8;

//     // --- Idle animation params (manuale) ---
//     this.idle = {
//       baseY: 0.01,
//       phase: Math.random() * Math.PI * 2,
//       ampBob: 0.25,
//       omegaBob: 1.3,
//       swayAmpX: THREE.MathUtils.degToRad(3),
//       swayAmpZ: THREE.MathUtils.degToRad(3),
//       swayOmega: 1.05,
//       clampGround: true,
//       minY: 0.0,
//       maxY: null,
//     };

//     // --- FSM & gameplay ---
//     this.state    = 'inactive';
//     this.tState   = 0;        // tempo nello stato corrente
//     this.exposure = 0;        // riempito dal Beam in futuro
//     this.params = {
//       appearDuration:   1.2,               // s
//       cleanseDuration:  0.8,               // s
//       speed:            opts.speed ?? 1.2, // m/s
//       keepDistance:     opts.keepDistance ?? 0.0, // m
//       arriveRadius:     opts.arriveRadius ?? 0.03, // m (snap)
//       exposureFalloff:  0.6,               // al/s quando non illuminato
//     };

//     this._time = 0; // guida uPulseTime
//   }

//   async load() {
//     const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');
//     const model = isGLB
//       ? (await new GLTFLoader().loadAsync(this.url)).scene
//       : (await new OBJLoader().loadAsync(this.url));

//     this.model = model;
//     this.rig.add(model); // idle vive sul rig

//     // Normalize: center XZ, lift to y=0, scala a target height
//     this._normalize();

//     // Material policy + shader patch
//     this._applyMaterials();

//     // stato iniziale coerente
//     this._setThreshold(1.0);
//     this.setVisible(false);

//     return this;
//   }

//   addTo(parent) { parent.add(this.root); return this; }

//   setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
//   getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }
//   setVisible(v) { this.root.visible = !!v; return this; }

//   setBaseY(y) { this.idle.baseY = y; return this; }
//   setIdleParams(partial = {}) { Object.assign(this.idle, partial); return this; }

//   // ---------- API FSM ----------
//   spawnAt(x, y, z) { this.setPosition(x, y, z); return this.appear(); }
//   appear() { return this._enter('appearing'); }
//   activate() { return this._enter('active'); }
//   cleanse() { return this._enter('cleansing'); }
//   deactivate() { return this._enter('inactive'); }

//   applyExposure(delta) {
//     this.exposure = THREE.MathUtils.clamp(this.exposure + delta, 0, 1);
//     if (this.exposure >= 1 && this.state === 'active') {
//       this.cleanse();
//       return true;
//     }
//     return false;
//   }

//   // ---------- loop ----------
//   update(dt) {
//     this._time += dt;

//     // emissive breathing
//     for (const set of this.uniformSets) {
//       if (set?.uPulseTime) set.uPulseTime.value = this._time;
//     }

//     // IDLE manuale
//     if (this.root.visible) this._updateIdle(dt);

//     // FSM
//     this.tState += dt;
//     switch (this.state) {
//       case 'appearing': this._updateAppearing(dt); break;
//       case 'active':    this._updateActive(dt);    break;
//       case 'cleansing': this._updateCleansing(dt); break;
//       case 'inactive':  /* noop */                 break;
//     }
//   }

//   // ---------- internals ----------
//   _enter(next) {
//     this.state = next;
//     this.tState = 0;

//     if (next === 'inactive') {
//       this.setVisible(false);
//       this.exposure = 0;
//       this._setThreshold(1.0);
//     }

//     if (next === 'appearing') {
//       this.setVisible(true);
//       this.exposure = 0;
//       this._setThreshold(1.0);
//     }

//     if (next === 'active') {
//       this.setVisible(true);
//       this._setThreshold(0.25);
//     }

//     if (next === 'cleansing') {
//       // animato in _updateCleansing
//     }

//     return this;
//   }

//   _updateAppearing(dt) {
//     const d = this.params.appearDuration || 1.0;
//     const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
//     const k = t * t * (3 - 2 * t); // smoothstep
//     const thr = THREE.MathUtils.lerp(1.0, 0.25, k);
//     this._setThreshold(thr);

//     if (t >= 1 || thr <= 0.26) this.activate();
//   }

//   _updateActive(dt) {
//     // decadimento exposure (finché non avrai il Beam)
//     if (this.exposure > 0) this.applyExposure(-this.params.exposureFalloff * dt);

//     if (typeof this.getTargetPos !== 'function') return;
//     const target = this.getTargetPos();
//     if (!target) return;

//     // direzione WORLD: ghost -> target solo su XZ
//     _dir.copy(target).sub(this.root.position);
//     _dir.y = 0;

//     let dist = _dir.length();
//     if (!isFinite(dist) || dist < 1e-6) return;

//     const stop    = Math.max(0, this.params.keepDistance || 0);
//     const arriveR = Math.max(1e-3, this.params.arriveRadius || 0.03);

//     // unit dir
//     _dir.multiplyScalar(1 / dist);

//     // distanza oltre lo stop (mai negativa)
//     const desired = Math.max(0, dist - stop);

//     // entro la soglia → snap preciso al bordo di stop
//     if (desired <= arriveR) {
//       this.root.position.x = target.x - _dir.x * stop;
//       this.root.position.z = target.z - _dir.z * stop;
//       return;
//     }

//     // step clamped (mai retro)
//     const step = Math.min(this.params.speed * dt, desired);
//     this.root.position.x += _dir.x * step;
//     this.root.position.z += _dir.z * step;
//   }

//   _updateCleansing(dt) {
//     const d = this.params.cleanseDuration || 0.8;
//     const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
//     const k = t * t * (3 - 2 * t);
//     const start = Math.max(0.25, this._getThreshold());
//     const thr = THREE.MathUtils.lerp(start, 1.0, k);
//     this._setThreshold(thr);

//     if (t >= 1 || thr >= 0.999) this.deactivate();
//   }

//   _updateIdle(dt) {
//     const k   = 1.0;
//     const t   = this._time;
//     const ph  = this.idle.phase;

//     const y  = this.idle.baseY + (this.idle.ampBob * k) * Math.sin(this.idle.omegaBob * t + ph);
//     const rx = (this.idle.swayAmpX * k) * Math.sin(this.idle.swayOmega * t + ph * 0.7);
//     const rz = (this.idle.swayAmpZ * k) * Math.sin(this.idle.swayOmega * t + ph * 1.13);

//     // clamp rispetto al terreno (WORLD) convertito in locale root
//     let floorLocal = -Infinity;
//     if (this.idle.clampGround && this.root) {
//       this.root.getWorldPosition(_tmpW);
//       const xw = _tmpW.x, zw = _tmpW.z;

//       const groundY = this.getGroundY(xw, zw) + this.clearance;
//       _tmpW2.set(xw, groundY, zw);
//       this.root.worldToLocal(_tmpW2);
//       const minLocalFromWorld = _tmpW2.y;

//       floorLocal = Math.max(floorLocal, minLocalFromWorld);
//     }
//     if (typeof this.idle.minY === 'number') floorLocal = Math.max(floorLocal, this.idle.minY);
//     const ceilLocal = (typeof this.idle.maxY === 'number') ? this.idle.maxY : +Infinity;

//     const ySafe = Math.min(ceilLocal, Math.max(floorLocal, y));

//     this.rig.position.y = ySafe;
//     this.rig.rotation.x = rx;
//     this.rig.rotation.z = rz;
//   }

//   _setThreshold(v) {
//     for (const set of this.uniformSets) {
//       if (set?.uThreshold) set.uThreshold.value = v;
//     }
//   }
//   _getThreshold() {
//     for (const set of this.uniformSets) {
//       if (set?.uThreshold) return set.uThreshold.value;
//     }
//     return 1.0;
//   }

//   _normalize() {
//     // Compute bbox BEFORE scaling
//     const box = new THREE.Box3().setFromObject(this.model);
//     const size = new THREE.Vector3(); box.getSize(size);
//     const center = new THREE.Vector3(); box.getCenter(center);

//     // Center XZ and lift so base is at y=0
//     this.model.position.x -= center.x;
//     this.model.position.z -= center.z;
//     this.model.position.y -= box.min.y;

//     // Scale to target height
//     const currentH = size.y || 1.0;
//     const s = this.targetHeight / currentH;
//     this.model.scale.setScalar(s);

//     // Re-lift AFTER scaling so the base is EXACTLY y=0
//     const box2 = new THREE.Box3().setFromObject(this.model);
//     this.model.position.y -= box2.min.y;

//     // Base radius (used later by spawner/LOS spacing)
//     const size2 = new THREE.Vector3(); box2.getSize(size2);
//     this.baseRadius = 0.5 * Math.hypot(size2.x, size2.z);
//   }

//   _applyMaterials() {
//     this.materials.length = 0;
//     this.uniformSets.length = 0;

//     this.model.traverse((o) => {
//       if (!o.isMesh) return;
//       const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
//       this.materials.push(...(Array.isArray(mats) ? mats : [mats]));
//       if (o.userData._uniformSets) this.uniformSets.push(...o.userData._uniformSets);

//       o.castShadow = false;
//       o.receiveShadow = false;
//       o.renderOrder = 10;   // ↑ più alto: evita che il ground lo “copra”
//     });
//   }
// }


// // src/entities/Ghost.js  - working 
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
// import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
// import { patchGhostMaterial } from '../entities/dissolvePatch.js';

// /* ------ feature detector: keeps eyes/mouth/cheeks opaque & colored ------ */
// function isFeature(mesh, mat) {
//   const a = (mesh?.name || '').toLowerCase();
//   const b = (mat?.name  || '').toLowerCase();
//   const re = /(ghost_)?(eyes?|mouth|cheeks?)/;
//   return re.test(a) || re.test(b);
// }

// function buildGhostMaterialsForMesh(mesh, opacityBody) {
//   const src = mesh.material;
//   const srcMats = Array.isArray(src) ? src : [src];
//   const geom = mesh.geometry;

//   const newMats = srcMats.map((m) => {
//     const feature = isFeature(mesh, m);
//     if (feature) {
//       return new THREE.MeshStandardMaterial({
//         name: (m?.name || '') + '_feature',
//         color: (m?.color ? m.color.clone() : new THREE.Color(0x111111)),
//         metalness: 0.0,
//         roughness: 0.6,
//         transparent: false,
//         depthWrite: true,
//         depthTest: true,
//         vertexColors: !!geom.attributes.color,
//       });
//     } else {
//       const mat = new THREE.MeshStandardMaterial({
//         name: (m?.name || '') + '_body',
//         color: (m?.color ? m.color.clone() : new THREE.Color(0xffffff)),
//         metalness: 0.0,
//         roughness: 0.35,
//         transparent: true,
//         opacity: opacityBody,
//         emissive: new THREE.Color(0x66ffff),
//         emissiveIntensity: 0.25,
//         depthWrite: false,
//         depthTest: true,
//         vertexColors: !!geom.attributes.color,
//       });
//       patchGhostMaterial(mat);
//       (mesh.userData._uniformSets ||= []).push(mat.userData._ghostUniforms);
//       return mat;
//     }
//   });

//   mesh.material = Array.isArray(src) ? newMats : newMats[0];
//   return newMats;
// }

// // tmp vectors
// const _wRoot  = new THREE.Vector3();
// const _wModel = new THREE.Vector3();
// const _dir    = new THREE.Vector3();

// export class Ghost {
//   constructor(opts = {}) {
//     this.url           = opts.url ?? '/assets/models/ghost/ghost.glb';
//     this.targetHeight  = opts.targetHeight ?? 2.2;
//     this.opacityBody   = opts.opacityBody ?? 0.75;

//     this.getGroundY = opts.getGroundY || ((x, z) => 0.0);
//     this.clearance  = (opts.clearance ?? 0.05);

//     this.getTargetPos = opts.getTargetPos || null;

//     this.root = new THREE.Group(); this.root.name = 'Ghost';
//     this.rig  = new THREE.Group(); this.rig.name  = 'GhostRig';
//     this.root.add(this.rig);
//     this.root.visible = false;

//     this.model  = null;
//     this.materials   = [];
//     this.uniformSets = [];
//     this.baseRadius  = 0.8;

//     this.idle = {
//       baseY: 0.45,
//       phase: Math.random() * Math.PI * 2,
//       ampBob: 0.00,        // niente bobbing per debug
//       omegaBob: 1.3,
//       swayAmpX: 0,
//       swayAmpZ: 0,
//       swayOmega: 1.05,
//       clampGround: true,
//       minY: 0.40,
//       maxY: 0.50,
//     };

//     this.state    = 'inactive';
//     this.tState   = 0;
//     this.exposure = 0;
//     this.params = {
//       appearDuration:   1.2,
//       cleanseDuration:  0.8,
//       speed:            opts.speed ?? 1.2,
//       keepDistance:     opts.keepDistance ?? 0.0,
//       arriveRadius:     opts.arriveRadius ?? 0.03,
//       exposureFalloff:  0.6,
//     };

//     this._time = 0;
//     this._debugPins = null;
//   }

//   async load() {
//     const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');
//     const model = isGLB
//       ? (await new GLTFLoader().loadAsync(this.url)).scene
//       : (await new OBJLoader().loadAsync(this.url));

//     this.model = model;
//     this._normalize();           // centra e scala il modello
//     this._applyMaterials();

//     // === FORZA GERARCHIA E OFFSET ===
//     this._ensureHierarchy();
//     this._zeroLocalOffsetsXZ();  // X/Z del modello & rig = 0 (si muove solo root)

//     // spilli di debug: ciano=root, magenta=model
//     this._attachDebugPins();

//     // stato iniziale
//     this._setThreshold(1.0);
//     this.setVisible(false);

//     return this;
//   }

//   addTo(parent) { parent.add(this.root); return this; }
//   setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
//   getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }
//   setVisible(v) { this.root.visible = !!v; return this; }
//   setIdleParams(partial = {}) { Object.assign(this.idle, partial); return this; }

//   spawnAt(x, y, z) { this.setPosition(x, y, z); return this.appear(); }
//   appear()    { return this._enter('appearing'); }
//   activate()  { return this._enter('active'); }
//   cleanse()   { return this._enter('cleansing'); }
//   deactivate(){ return this._enter('inactive'); }

//   applyExposure(delta) {
//     this.exposure = THREE.MathUtils.clamp(this.exposure + delta, 0, 1);
//     if (this.exposure >= 1 && this.state === 'active') { this.cleanse(); return true; }
//     return false;
//   }

//   update(dt) {
//     this._time += dt;

//     for (const set of this.uniformSets) {
//       if (set?.uPulseTime) set.uPulseTime.value = this._time;
//     }

//     if (this.root.visible) this._updateIdle(dt);

//     this.tState += dt;
//     switch (this.state) {
//       case 'appearing': this._updateAppearing(dt); break;
//       case 'active':    this._updateActive(dt);    break;
//       case 'cleansing': this._updateCleansing(dt); break;
//     }

//     // ---- SANITY: model deve stare sopra a root (stessa XZ) ----
//     if (this.model && this.root.parent) {
//       this.root.getWorldPosition(_wRoot);
//       this.model.getWorldPosition(_wModel);
//       const dx = Math.abs(_wModel.x - _wRoot.x);
//       const dz = Math.abs(_wModel.z - _wRoot.z);
//       if (dx > 0.02 || dz > 0.02) {
//         console.warn(`[ghost drift] MODEL!=ROOT on XZ  dx=${dx.toFixed(3)}  dz=${dz.toFixed(3)}  (fixing hierarchy)`);
//         this._ensureHierarchy();         // se qualcuno ha riparentato, lo ripristino
//         this._zeroLocalOffsetsXZ();      // azzera eventuali offset locali
//       }
//     }
//   }

//   /* =================== internals =================== */
//   _enter(next) {
//     this.state = next;
//     this.tState = 0;

//     if (next === 'inactive') { this.setVisible(false); this.exposure = 0; this._setThreshold(1.0); }
//     if (next === 'appearing'){ this.setVisible(true);  this.exposure = 0; this._setThreshold(1.0); }
//     if (next === 'active')   { this.setVisible(true);  this._setThreshold(0.25); }
//     return this;
//   }

//   _updateAppearing(dt) {
//     const d = this.params.appearDuration || 1.0;
//     const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
//     const k = t * t * (3 - 2 * t);
//     const thr = THREE.MathUtils.lerp(1.0, 0.25, k);
//     this._setThreshold(thr);
//     if (t >= 1 || thr <= 0.26) this.activate();
//   }

//   _updateActive(dt) {
//     if (this.exposure > 0) this.applyExposure(-this.params.exposureFalloff * dt);

//     if (typeof this.getTargetPos !== 'function') return;
//     const target = this.getTargetPos();
//     if (!target) return;

//     _dir.subVectors(target, this.root.position);
//     _dir.y = 0;
//     const dist = _dir.length();
//     if (!isFinite(dist) || dist < 1e-6) return;

//     const stop    = Math.max(0, this.params.keepDistance || 0);
//     const arriveR = Math.max(1e-3, this.params.arriveRadius || 0.03);

//     _dir.multiplyScalar(1 / dist);
//     const desired = Math.max(0, dist - stop);

//     if (desired <= arriveR) {
//       this.root.position.x = target.x - _dir.x * stop;
//       this.root.position.z = target.z - _dir.z * stop;
//       return;
//     }

//     const step = Math.min(this.params.speed * dt, desired);
//     this.root.position.x += _dir.x * step;
//     this.root.position.z += _dir.z * step;
//   }

//   _updateCleansing(dt) {
//     const d = this.params.cleanseDuration || 0.8;
//     const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
//     const k = t * t * (3 - 2 * t);
//     const start = Math.max(0.25, this._getThreshold());
//     const thr = THREE.MathUtils.lerp(start, 1.0, k);
//     this._setThreshold(thr);
//     if (t >= 1 || thr >= 0.999) this.deactivate();
//   }

//   _updateIdle(dt) {
//     // sole Y bobbing (molto piccolo per debug)
//     const t = this._time, ph = this.idle.phase;
//     const y = this.idle.baseY; // + this.idle.ampBob * Math.sin(this.idle.omegaBob * t + ph);
//     // clamp su terreno
//     let floorLocal = -Infinity;
//     if (this.root) {
//       this.root.getWorldPosition(_wRoot);
//       const groundY = this.getGroundY(_wRoot.x, _wRoot.z) + this.clearance;
//       const toLocal = new THREE.Vector3(_wRoot.x, groundY, _wRoot.z);
//       this.root.worldToLocal(toLocal);
//       floorLocal = Math.max(floorLocal, toLocal.y);
//     }
//     const ySafe = Math.min(this.idle.maxY, Math.max(floorLocal, y));
//     this.rig.position.y = ySafe;
//   }

//   _setThreshold(v) { for (const s of this.uniformSets) if (s?.uThreshold) s.uThreshold.value = v; }
//   _getThreshold()  { for (const s of this.uniformSets) if (s?.uThreshold) return s.uThreshold.value; return 1.0; }

//   _normalize() {
//     // prendi bbox PRIMA dello scaling
//     const box = new THREE.Box3().setFromObject(this.model);
//     const size = new THREE.Vector3(); box.getSize(size);
//     const center = new THREE.Vector3(); box.getCenter(center);

//     // centra XZ e porta base a y=0 (in locale al modello)
//     this.model.position.x -= center.x;
//     this.model.position.z -= center.z;
//     this.model.position.y -= box.min.y;

//     // scala all'altezza target
//     const s = (this.targetHeight / (size.y || 1.0));
//     this.model.scale.setScalar(s);

//     // riallinea base a y=0 dopo lo scale
//     const box2 = new THREE.Box3().setFromObject(this.model);
//     this.model.position.y -= box2.min.y;
//   }

//   _applyMaterials() {
//     this.materials.length = 0;
//     this.uniformSets.length = 0;

//     // IMPORTANTISSIMO: attacca il modello al rig QUI
//     this.rig.add(this.model);

//     this.model.traverse((o) => {
//       if (!o.isMesh) return;
//       const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
//       this.materials.push(...(Array.isArray(mats) ? mats : [mats]));
//       if (o.userData._uniformSets) this.uniformSets.push(...o.userData._uniformSets);
//       o.castShadow = false; o.receiveShadow = false; o.renderOrder = 10;
//     });
//   }

//   _ensureHierarchy() {
//     // vogliamo root -> rig -> model
//     if (this.model.parent !== this.rig) {
//       console.warn('Ghost: model non era figlio del rig. Lo sistemo.');
//       this.rig.add(this.model);
//     }
//     if (this.rig.parent !== this.root) this.root.add(this.rig);
//     this.model.updateMatrixWorld(true);
//     this.rig.updateMatrixWorld(true);
//     this.root.updateMatrixWorld(true);
//   }

//   _zeroLocalOffsetsXZ() {
//     // il drift tipico nasce da X/Z locali non nulli
//     this.rig.position.x = 0;   this.rig.position.z = 0;
//     this.model.position.x = 0; this.model.position.z = 0;
//   }

//   _attachDebugPins() {
//     if (this._debugPins) return;
//     const mk = (col)=> new THREE.Mesh(
//       new THREE.SphereGeometry(0.08, 16, 16),
//       new THREE.MeshBasicMaterial({ color: col, depthTest:false, depthWrite:false })
//     );
//     const rootDot  = mk(0x00ffff); // ciano = ROOT (AI)
//     const modelDot = mk(0xff00aa); // magenta = MODEL (visuale)
//     rootDot.position.set(0, 1.2, 0);
//     modelDot.position.set(0, 1.2, 0);
//     this.root.add(rootDot);
//     this.model.add(modelDot);
//     this._debugPins = { rootDot, modelDot };
//   }
// }



// src/entities/Ghost.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { patchGhostMaterial } from '../entities/dissolvePatch.js';

/* ------ feature detector: keeps eyes/mouth/cheeks opaque & colored ------ */
function isFeature(mesh, mat) {
  const a = (mesh?.name || '').toLowerCase();
  const b = (mat?.name  || '').toLowerCase();
  const re = /(ghost_)?(eyes?|mouth|cheeks?)/;
  return re.test(a) || re.test(b);
}

function buildGhostMaterialsForMesh(mesh, opacityBody) {
  const src = mesh.material;
  const srcMats = Array.isArray(src) ? src : [src];
  const geom = mesh.geometry;

  const newMats = srcMats.map((m) => {
    const feature = isFeature(mesh, m);
    if (feature) {
      return new THREE.MeshStandardMaterial({
        name: (m?.name || '') + '_feature',
        color: (m?.color ? m.color.clone() : new THREE.Color(0x111111)),
        metalness: 0.0,
        roughness: 0.6,
        transparent: false,
        depthWrite: true,
        depthTest: true,
        vertexColors: !!geom.attributes.color,
      });
    } else {
      const mat = new THREE.MeshStandardMaterial({
        name: (m?.name || '') + '_body',
        color: (m?.color ? m.color.clone() : new THREE.Color(0xffffff)),
        metalness: 0.0,
        roughness: 0.35,
        transparent: true,
        opacity: opacityBody,
        emissive: new THREE.Color(0x66ffff),
        emissiveIntensity: 0.40,   // ↑ un filo più brillante
        depthWrite: false,
        depthTest: true,
        vertexColors: !!geom.attributes.color,
      });
      patchGhostMaterial(mat);
      (mesh.userData._uniformSets ||= []).push(mat.userData._ghostUniforms);
      return mat;
    }
  });

  mesh.material = Array.isArray(src) ? newMats : newMats[0];
  return newMats;
}

// tmp vectors
const _wRoot  = new THREE.Vector3();
const _wModel = new THREE.Vector3();
const _dir    = new THREE.Vector3();

export class Ghost {
  constructor(opts = {}) {
    this.url           = opts.url ?? '/assets/models/ghost/ghost.glb';
    this.targetHeight  = opts.targetHeight ?? 2.2;
    this.opacityBody   = opts.opacityBody ?? 0.75;

    this.getGroundY = opts.getGroundY || ((x, z) => 0.0);
    this.clearance  = (opts.clearance ?? 0.05);

    this.getTargetPos = opts.getTargetPos || null;

    this.root = new THREE.Group(); this.root.name = 'Ghost';
    this.rig  = new THREE.Group(); this.rig.name  = 'GhostRig';
    this.root.add(this.rig);
    this.root.visible = false;

    this.model  = null;
    this.materials   = [];
    this.uniformSets = [];
    this.baseRadius  = 0.8;

    // --- IDLE "vivo": bobbing + sway ---
    this.idle = {
      baseY: 0.45,
      phase: Math.random() * Math.PI * 2,
      ampBob: 0.06,                              // era 0.00 (disattivato)
      omegaBob: 1.2,
      swayAmpX: THREE.MathUtils.degToRad(4),     // dondolio dolce
      swayAmpZ: THREE.MathUtils.degToRad(4),
      swayOmega: 1.05,
      clampGround: true,
      minY: 0.35,
      maxY: 0.60,
    };

    this.state    = 'inactive';
    this.tState   = 0;
    this.exposure = 0;
    this.params = {
      appearDuration:   1.2,
      cleanseDuration:  0.8,
      speed:            opts.speed ?? 1.2,
      keepDistance:     opts.keepDistance ?? 0.0,
      arriveRadius:     opts.arriveRadius ?? 0.03,
      exposureFalloff:  0.6,
    };

    this._time = 0;
    this._debugPins = null;
  }

  async load() {
    const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');
    const model = isGLB
      ? (await new GLTFLoader().loadAsync(this.url)).scene
      : (await new OBJLoader().loadAsync(this.url));

    this.model = model;
    this._normalize();
    this._applyMaterials();

    // === GERARCHIA & OFFSET ===
    this._ensureHierarchy();
    this._zeroLocalOffsetsXZ();

    // spilli di debug: ciano=root, magenta=model
    this._attachDebugPins();

    // stato iniziale
    this._setThreshold(1.0);
    this.setVisible(false);

    return this;
  }

  addTo(parent) { parent.add(this.root); return this; }
  setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
  getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }
  setVisible(v) { this.root.visible = !!v; return this; }
  setIdleParams(partial = {}) { Object.assign(this.idle, partial); return this; }

  spawnAt(x, y, z) { this.setPosition(x, y, z); return this.appear(); }
  appear()    { return this._enter('appearing'); }
  activate()  { return this._enter('active'); }
  cleanse()   { return this._enter('cleansing'); }
  deactivate(){ return this._enter('inactive'); }

  applyExposure(delta) {
    this.exposure = THREE.MathUtils.clamp(this.exposure + delta, 0, 1);
    if (this.exposure >= 1 && this.state === 'active') { this.cleanse(); return true; }
    return false;
  }

  update(dt) {
    this._time += dt;

    // avanzamento tempo per l'emissive breathing
    for (const set of this.uniformSets) {
      if (set?.uPulseTime) set.uPulseTime.value = this._time;
    }

    if (this.root.visible) this._updateIdle(dt);

    this.tState += dt;
    switch (this.state) {
      case 'appearing': this._updateAppearing(dt); break;
      case 'active':    this._updateActive(dt);    break;
      case 'cleansing': this._updateCleansing(dt); break;
    }

    // sanity: model deve seguire root su XZ
    if (this.model && this.root.parent) {
      this.root.getWorldPosition(_wRoot);
      this.model.getWorldPosition(_wModel);
      const dx = Math.abs(_wModel.x - _wRoot.x);
      const dz = Math.abs(_wModel.z - _wRoot.z);
      if (dx > 0.02 || dz > 0.02) {
        console.warn(`[ghost drift] MODEL!=ROOT on XZ  dx=${dx.toFixed(3)}  dz=${dz.toFixed(3)}  (fixing hierarchy)`);
        this._ensureHierarchy();
        this._zeroLocalOffsetsXZ();
      }
    }
  }

  /* =================== internals =================== */
  _enter(next) {
    this.state = next;
    this.tState = 0;

    if (next === 'inactive') { this.setVisible(false); this.exposure = 0; this._setThreshold(1.0); }
    if (next === 'appearing'){ this.setVisible(true);  this.exposure = 0; this._setThreshold(1.0); }
    if (next === 'active')   { this.setVisible(true);  this._setThreshold(0.25); }
    return this;
  }

  _updateAppearing(dt) {
    const d = this.params.appearDuration || 1.0;
    const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
    const k = t * t * (3 - 2 * t);
    const thr = THREE.MathUtils.lerp(1.0, 0.25, k);
    this._setThreshold(thr);
    if (t >= 1 || thr <= 0.26) this.activate();
  }

  _updateActive(dt) {
    if (this.exposure > 0) this.applyExposure(-this.params.exposureFalloff * dt);

    if (typeof this.getTargetPos !== 'function') return;
    const target = this.getTargetPos();
    if (!target) return;

    _dir.subVectors(target, this.root.position);
    _dir.y = 0;
    const dist = _dir.length();
    if (!isFinite(dist) || dist < 1e-6) return;

    const stop    = Math.max(0, this.params.keepDistance || 0);
    const arriveR = Math.max(1e-3, this.params.arriveRadius || 0.03);

    _dir.multiplyScalar(1 / dist);
    const desired = Math.max(0, dist - stop);

    if (desired <= arriveR) {
      this.root.position.x = target.x - _dir.x * stop;
      this.root.position.z = target.z - _dir.z * stop;
      return;
    }

    const step = Math.min(this.params.speed * dt, desired);
    this.root.position.x += _dir.x * step;
    this.root.position.z += _dir.z * step;
  }

  _updateCleansing(dt) {
    const d = this.params.cleanseDuration || 0.8;
    const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
    const k = t * t * (3 - 2 * t);
    const start = Math.max(0.25, this._getThreshold());
    const thr = THREE.MathUtils.lerp(start, 1.0, k);
    this._setThreshold(thr);
    if (t >= 1 || thr >= 0.999) this.deactivate();
  }

  _updateIdle(dt) {
    // bobbing + sway
    const t = this._time, ph = this.idle.phase;

    // bobbing verticale
    let y = this.idle.baseY + this.idle.ampBob * Math.sin(this.idle.omegaBob * t + ph);

    // clamp al terreno (in locale)
    let floorLocal = -Infinity;
    if (this.root) {
      this.root.getWorldPosition(_wRoot);
      const groundY = this.getGroundY(_wRoot.x, _wRoot.z) + this.clearance;
      const toLocal = new THREE.Vector3(_wRoot.x, groundY, _wRoot.z);
      this.root.worldToLocal(toLocal);
      floorLocal = Math.max(floorLocal, toLocal.y);
    }
    const ySafe = Math.min(this.idle.maxY, Math.max(floorLocal, y));
    this.rig.position.y = ySafe;

    // sway dolce attorno a X/Z
    const rx = this.idle.swayAmpX * Math.sin(this.idle.swayOmega * t + ph * 0.7);
    const rz = this.idle.swayAmpZ * Math.sin(this.idle.swayOmega * t + ph * 0.9);
    this.rig.rotation.x = rx;
    this.rig.rotation.z = rz;
  }

  _setThreshold(v) { for (const s of this.uniformSets) if (s?.uThreshold) s.uThreshold.value = v; }
  _getThreshold()  { for (const s of this.uniformSets) if (s?.uThreshold) return s.uThreshold.value; return 1.0; }

  _normalize() {
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    this.model.position.x -= center.x;
    this.model.position.z -= center.z;
    this.model.position.y -= box.min.y;

    const s = (this.targetHeight / (size.y || 1.0));
    this.model.scale.setScalar(s);

    const box2 = new THREE.Box3().setFromObject(this.model);
    this.model.position.y -= box2.min.y;
  }

  _applyMaterials() {
    this.materials.length = 0;
    this.uniformSets.length = 0;

    this.rig.add(this.model);

    this.model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
      this.materials.push(...(Array.isArray(mats) ? mats : [mats]));
      if (o.userData._uniformSets) this.uniformSets.push(...o.userData._uniformSets);
      o.castShadow = false; o.receiveShadow = false; o.renderOrder = 10;
    });
  }

  _ensureHierarchy() {
    if (this.model.parent !== this.rig) {
      console.warn('Ghost: model non era figlio del rig. Lo sistemo.');
      this.rig.add(this.model);
    }
    if (this.rig.parent !== this.root) this.root.add(this.rig);
    this.model.updateMatrixWorld(true);
    this.rig.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
  }

  _zeroLocalOffsetsXZ() {
    this.rig.position.x = 0;   this.rig.position.z = 0;
    this.model.position.x = 0; this.model.position.z = 0;
  }

  _attachDebugPins() {
    if (this._debugPins) return;
    const mk = (col)=> new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 16),
      new THREE.MeshBasicMaterial({ color: col, depthTest:false, depthWrite:false })
    );
    const rootDot  = mk(0x00ffff); // ciano = ROOT (AI)
    const modelDot = mk(0xff00aa); // magenta = MODEL (visuale)
    rootDot.position.set(0, 1.2, 0);
    modelDot.position.set(0, 1.2, 0);
    this.root.add(rootDot);
    this.model.add(modelDot);
    this._debugPins = { rootDot, modelDot };
  }
}
