// // // src/systems/SanctuarySystem.js
// // import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// // import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js';

// // export class SanctuarySystem {
// //   /**
// //    * @param {object} opts
// //    *  - scene, camera, beamSystem, spawner
// //    *  - modelUrl: string (FBX totem)
// //    *  - items: [{x,z,radius,holdSeconds}]  // posizioni/parametri
// //    *  - decayRate: number (quanto scende se interrompi, in sec^-1)
// //    *  - onPurified: fn(index, totalDone, totalCount)
// //    */
// //   constructor(opts = {}) {
// //     this.scene       = opts.scene;
// //     this.camera      = opts.camera;
// //     this.beamSystem  = opts.beamSystem;
// //     this.spawner     = opts.spawner;
// //     this.modelUrl    = opts.modelUrl;
// //     this.itemsDef    = opts.items || [];
// //     this.decayRate   = opts.decayRate ?? 0.25;
// //     this.onPurified  = typeof opts.onPurified === 'function' ? opts.onPurified : null;

// //     this._ray        = new THREE.Raycaster();
// //     this._tmpV       = new THREE.Vector3();
// //     this._apex       = new THREE.Vector3();
// //     this._beamDir    = new THREE.Vector3();

// //     this._fbx        = null;      // prototipo caricato
// //     this._sanct      = [];        // istanze
// //     this._doneCount  = 0;

// //     // colori feedback
// //     this._colIdle    = new THREE.Color(0x7aa7ff); // blu tenue
// //     this._colCharge  = new THREE.Color(0x66ffcc); // ciano/verde
// //     this._colDone    = new THREE.Color(0x39ff95); // verde acqua
// //   }

// //   async init(){
// //     // 1) Carica il FBX una volta
// //     const loader = new FBXLoader();
// //     this._fbx = await loader.loadAsync(this.modelUrl);
// //     this._fbx.traverse(o=>{
// //       if (o.isMesh) {
// //         o.castShadow = true;
// //         o.receiveShadow = true;
// //         // assicurati che abbia emissive
// //         const m = o.material;
// //         if (!m || m.isShaderMaterial) return;
// //         if (!('emissive' in m)) {
// //           o.material = new THREE.MeshStandardMaterial({
// //             color: m.color ? m.color.clone() : new THREE.Color(0xaaaaaa),
// //             roughness: 0.8,
// //             metalness: 0.0,
// //             emissive: new THREE.Color(0x000000),
// //             emissiveIntensity: 0.0
// //           });
// //         } else {
// //           m.emissive = m.emissive || new THREE.Color(0x000000);
// //           m.emissiveIntensity = m.emissiveIntensity ?? 0.0;
// //         }
// //       }
// //     });

// //     // 2) Instanzia i santuari
// //     for (let i=0; i<this.itemsDef.length; i++){
// //       const def = this.itemsDef[i];
// //       const root = new THREE.Group();
// //       root.position.set(def.x, 0, def.z);
// //       this.scene.add(root);

// //       const model = this._fbx.clone(true);
// //       // normalizza/altera scala se serve (tocco leggero)
// //       model.scale.setScalar(def.scale ?? 1.0);
// //       root.add(model);

// //       // ring a terra
// //       const rOuter = def.radius;
// //       const rInner = Math.max(0.6 * rOuter, rOuter - 2.5);
// //       const ringGeo = new THREE.RingGeometry(rInner, rOuter, 48);
// //       ringGeo.rotateX(-Math.PI/2);
// //       const ringMat = new THREE.MeshBasicMaterial({
// //         color: this._colIdle.clone(),
// //         transparent: true, opacity: 0.25, depthWrite: false
// //       });
// //       const ring = new THREE.Mesh(ringGeo, ringMat);
// //       ring.position.y = 0.02;
// //       root.add(ring);

// //       // point light (soft)
// //       const light = new THREE.PointLight(0x66ffcc, 0.0, rOuter * 6, 2.0);
// //       light.position.set(0, 6, 0);
// //       root.add(light);

// //       // stato
// //       this._sanct.push({
// //         def,
// //         root, model, ring, light,
// //         charge: 0,
// //         holdSeconds: def.holdSeconds ?? 3.0,
// //         radius: rOuter,
// //         state: 'idle', // 'idle' | 'purifying' | 'done'
// //         _spawnTick: 0
// //       });
// //     }
// //   }

// //   /**
// //    * @param {number} dt
// //    * @param {object} ctx  { beamOn:boolean, playerPos:THREE.Vector3 }
// //    */
// //   update(dt, ctx = {}){
// //     if (!this.beamSystem || this._sanct.length === 0) return;

// //     const halfAngleRad = THREE.MathUtils.degToRad(this.beamSystem.halfAngleDeg);
// //     const cosHalf = Math.cos(halfAngleRad);
// //     this.beamSystem.getBeamApex?.(this._apex);
// //     this.beamSystem.getBeamForward?.(this._beamDir);

// //     const obstacles = this.beamSystem.obstacles || [];
// //     const maxRange  = this.beamSystem.maxRange || 9999;

// //     for (let i=0; i<this._sanct.length; i++){
// //       const s = this._sanct[i];
// //       if (s.state === 'done') { // solo feedback visivo costante
// //         this._applyVisual(s, 1.0);
// //         continue;
// //       }

// //       // 1) Player dentro il cerchio?
// //       const dx = ctx.playerPos.x - s.root.position.x;
// //       const dz = ctx.playerPos.z - s.root.position.z;
// //       const inCircle = (dx*dx + dz*dz) <= (s.radius*s.radius);

// //       // 2) Totem nel cono del beam?
// //       const aim = this._tmpV.set(s.root.position.x, s.root.position.y + 3.5, s.root.position.z);
// //       const to  = aim.clone().sub(this._apex);
// //       const dist = to.length();
// //       let inCone = false, losOK = false;
// //       if (dist > 1e-3 && dist <= maxRange) {
// //         to.multiplyScalar(1/dist);
// //         const cosAng = to.dot(this._beamDir);
// //         inCone = (cosAng >= cosHalf);

// //         // 3) LOS libero?
// //         if (inCone) {
// //           if (obstacles.length === 0) {
// //             losOK = true;
// //           } else {
// //             this._ray.set(this._apex, to);
// //             this._ray.far = dist;
// //             const hit = this._ray.intersectObjects(obstacles, true);
// //             losOK = (hit.length === 0);
// //           }
// //         }
// //       }

// //       const canCharge = ctx.beamOn && inCircle && inCone && losOK;

// //       // Stato + carica
// //       if (canCharge) {
// //         s.state = 'purifying';
// //         s.charge = Math.min(s.holdSeconds, s.charge + dt);
// //         // (facoltativo) più pressione durante la purifica
// //         s._spawnTick += dt;
// //         if (s._spawnTick > 1.2 && this.spawner?.forceSpawnNow) {
// //           this.spawner.forceSpawnNow(); // ogni ~1.2s
// //           s._spawnTick = 0;
// //         }
// //       } else {
// //         s.state = (s.charge > 0) ? 'idle' : 'idle';
// //         s.charge = Math.max(0, s.charge - this.decayRate * dt);
// //         s._spawnTick = 0;
// //       }

// //       const t = THREE.MathUtils.clamp(s.charge / s.holdSeconds, 0, 1);
// //       this._applyVisual(s, t);

// //       if (t >= 1 && s.state !== 'done') {
// //         s.state = 'done';
// //         this._doneCount++;
// //         // piccolo boost luminosità a "done"
// //         this._applyVisual(s, 1);
// //         if (this.onPurified) this.onPurified(i, this._doneCount, this._sanct.length);
// //       }
// //     }
// //   }

// //   _applyVisual(s, t){
// //     // ring: colore→mix e opacità
// //     s.ring.material.color.copy(this._colIdle).lerp(this._colCharge, t).lerp(this._colDone, Math.max(0, t-0.85)*7.0);
// //     s.ring.material.opacity = 0.18 + 0.55 * t;

// //     // emissive del totem + intensità luce
// //     const em = new THREE.Color().copy(this._colIdle).lerp(this._colCharge, t).lerp(this._colDone, Math.max(0, t-0.85)*7.0);
// //     const emInt = 0.2 + 1.2 * t;

// //     s.model.traverse(o=>{
// //       if (o.isMesh && o.material && 'emissive' in o.material) {
// //         o.material.emissive.copy(em);
// //         o.material.emissiveIntensity = emInt;
// //         o.material.needsUpdate = true;
// //       }
// //     });

// //     s.light.intensity = 0.0 + 1.6 * t;
// //   }
// // }



// // src/systems/SanctuarySystem.js
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js';

// // --- helper: scala un oggetto a targetH e appoggia la base a y=0 ---
// function fitObjectToHeight(obj, targetH = 0.9) {
//   obj.updateMatrixWorld(true);
//   const box = new THREE.Box3().setFromObject(obj);
//   const size = new THREE.Vector3();
//   box.getSize(size);
//   const curH = size.y > 1e-6 ? size.y : 1.0;

//   // scala uniforme
//   const s = targetH / curH;
//   obj.scale.multiplyScalar(s);

//   // riallinea la base a y=0
//   obj.updateMatrixWorld(true);
//   const box2 = new THREE.Box3().setFromObject(obj);
//   const minY = box2.min.y;
//   obj.position.y -= minY;

//   // ritorna altezza finale (≈ targetH)
//   obj.updateMatrixWorld(true);
//   const box3 = new THREE.Box3().setFromObject(obj);
//   const size3 = new THREE.Vector3();
//   box3.getSize(size3);
//   return size3.y;
// }

// export class SanctuarySystem {
//   /**
//    * @param {object} opts
//    *  - scene, camera, beamSystem, spawner
//    *  - modelUrl: string (FBX totem)
//    *  - items: [{x,z,radius,holdSeconds,targetHeight,scale}]  // posizioni/parametri
//    *  - decayRate: number (quanto scende se interrompi, in sec^-1)
//    *  - targetHeight: default per i totem (metri)
//    *  - onPurified: fn(index, totalDone, totalCount)
//    */
//   constructor(opts = {}) {
//     this.scene       = opts.scene;
//     this.camera      = opts.camera;
//     this.beamSystem  = opts.beamSystem;
//     this.spawner     = opts.spawner;
//     this.modelUrl    = opts.modelUrl;
//     this.itemsDef    = opts.items || [];
//     this.decayRate   = opts.decayRate ?? 0.25;
//     this.targetHeight= opts.targetHeight ?? 200.5; // 90 cm di default
//     this.onPurified  = typeof opts.onPurified === 'function' ? opts.onPurified : null;

//     this._ray        = new THREE.Raycaster();
//     this._tmpV       = new THREE.Vector3();
//     this._apex       = new THREE.Vector3();
//     this._beamDir    = new THREE.Vector3();

//     this._fbx        = null;      // prototipo caricato
//     this._sanct      = [];        // istanze
//     this._doneCount  = 0;

//     // colori feedback
//     this._colIdle    = new THREE.Color(0x7aa7ff); // blu tenue
//     this._colCharge  = new THREE.Color(0x66ffcc); // ciano/verde
//     this._colDone    = new THREE.Color(0x39ff95); // verde acqua
//   }

//   async init(){
//     // 1) Carica il FBX una volta
//     const loader = new FBXLoader();
//     this._fbx = await loader.loadAsync(this.modelUrl);
//     this._fbx.traverse(o=>{
//       if (o.isMesh) {
//         o.castShadow = true;
//         o.receiveShadow = true;
//         // assicurati che abbia emissive
//         const m = o.material;
//         if (!m || m.isShaderMaterial) return;
//         if (!('emissive' in m)) {
//           o.material = new THREE.MeshStandardMaterial({
//             color: m.color ? m.color.clone() : new THREE.Color(0xaaaaaa),
//             roughness: 0.8,
//             metalness: 0.0,
//             emissive: new THREE.Color(0x000000),
//             emissiveIntensity: 0.0
//           });
//         } else {
//           m.emissive = m.emissive || new THREE.Color(0x000000);
//           m.emissiveIntensity = m.emissiveIntensity ?? 0.0;
//         }
//       }
//     });

//     // 2) Instanzia i santuari
//     for (let i=0; i<this.itemsDef.length; i++){
//       const def = this.itemsDef[i];
//       const root = new THREE.Group();
//       root.position.set(def.x, 0, def.z);
//       this.scene.add(root);

//       const model = this._fbx.clone(true);

//       // --- SCALA REALISTICA ---
//       // priorità: def.targetHeight > this.targetHeight > (fallback scala manuale)
//       let finalHeight;
//       if (def.targetHeight || this.targetHeight) {
//         finalHeight = fitObjectToHeight(model, def.targetHeight ?? this.targetHeight);
//       } else {
//         model.scale.setScalar(def.scale ?? 1.0);
//         // misura altezza dopo scala manuale
//         model.updateMatrixWorld(true);
//         const box = new THREE.Box3().setFromObject(model);
//         const size = new THREE.Vector3();
//         box.getSize(size);
//         finalHeight = size.y;
//         // allinea base
//         const minY = box.min.y;
//         model.position.y -= minY;
//       }
//       root.add(model);

//       // --- RING A TERRA ---
//       const rOuter = (def.radius != null)
//         ? def.radius
//         : Math.max(18, (def.targetHeight ?? this.targetHeight) * 2.0); // fallback gradevole
//       const rInner = Math.max(0.6 * rOuter, rOuter - 2.5);
//       const ringGeo = new THREE.RingGeometry(rInner, rOuter, 48);
//       ringGeo.rotateX(-Math.PI/2);
//       const ringMat = new THREE.MeshBasicMaterial({
//         color: this._colIdle.clone(),
//         transparent: true, opacity: 0.25, depthWrite: false
//       });
//       const ring = new THREE.Mesh(ringGeo, ringMat);
//       ring.position.y = 0.02;
//       root.add(ring);

//       // --- LUCE: altezza e distanza in proporzione ---
//       const lightHeight = Math.max(0.8, finalHeight * 1.2);
//       const light = new THREE.PointLight(0x66ffcc, 0.0, rOuter * 6, 2.0);
//       light.position.set(0, lightHeight, 0);
//       root.add(light);

//       // stato
//       this._sanct.push({
//         def,
//         root, model, ring, light,
//         modelHeight: finalHeight,
//         // punto di mira: un po' sopra il centro del totem
//         aimYOffset: finalHeight * 0.6,
//         charge: 0,
//         holdSeconds: def.holdSeconds ?? 3.0,
//         radius: rOuter,
//         state: 'idle', // 'idle' | 'purifying' | 'done'
//         _spawnTick: 0
//       });
//     }
//   }

//   /**
//    * @param {number} dt
//    * @param {object} ctx  { beamOn:boolean, playerPos:THREE.Vector3 }
//    */
//   update(dt, ctx = {}){
//     if (!this.beamSystem || this._sanct.length === 0) return;

//     const halfAngleRad = THREE.MathUtils.degToRad(this.beamSystem.halfAngleDeg);
//     const cosHalf = Math.cos(halfAngleRad);
//     this.beamSystem.getBeamApex?.(this._apex);
//     this.beamSystem.getBeamForward?.(this._beamDir);

//     const obstacles = this.beamSystem.obstacles || [];
//     const maxRange  = this.beamSystem.maxRange || 9999;

//     for (let i=0; i<this._sanct.length; i++){
//       const s = this._sanct[i];
//       if (s.state === 'done') { // solo feedback visivo costante
//         this._applyVisual(s, 1.0);
//         continue;
//       }

//       // 1) Player dentro il cerchio?
//       const dx = ctx.playerPos.x - s.root.position.x;
//       const dz = ctx.playerPos.z - s.root.position.z;
//       const inCircle = (dx*dx + dz*dz) <= (s.radius*s.radius);

//       // 2) Totem nel cono del beam?
//       const aim = this._tmpV.set(
//         s.root.position.x,
//         s.root.position.y + s.aimYOffset,
//         s.root.position.z
//       );
//       const to  = aim.clone().sub(this._apex);
//       const dist = to.length();
//       let inCone = false, losOK = false;
//       if (dist > 1e-3 && dist <= maxRange) {
//         to.multiplyScalar(1/dist);
//         const cosAng = to.dot(this._beamDir);
//         inCone = (cosAng >= cosHalf);

//         // 3) LOS libero?
//         if (inCone) {
//           if (obstacles.length === 0) {
//             losOK = true;
//           } else {
//             this._ray.set(this._apex, to);
//             this._ray.far = dist;
//             const hit = this._ray.intersectObjects(obstacles, true);
//             losOK = (hit.length === 0);
//           }
//         }
//       }

//       const canCharge = ctx.beamOn && inCircle && inCone && losOK;

//       // Stato + carica
//       if (canCharge) {
//         s.state = 'purifying';
//         s.charge = Math.min(s.holdSeconds, s.charge + dt);
//         // (facoltativo) più pressione durante la purifica
//         s._spawnTick += dt;
//         if (s._spawnTick > 1.2 && this.spawner?.forceSpawnNow) {
//           this.spawner.forceSpawnNow(); // ogni ~1.2s
//           s._spawnTick = 0;
//         }
//       } else {
//         s.state = (s.charge > 0) ? 'idle' : 'idle';
//         s.charge = Math.max(0, s.charge - this.decayRate * dt);
//         s._spawnTick = 0;
//       }

//       const t = THREE.MathUtils.clamp(s.charge / s.holdSeconds, 0, 1);
//       this._applyVisual(s, t);

//       if (t >= 1 && s.state !== 'done') {
//         s.state = 'done';
//         this._doneCount++;
//         // piccolo boost luminosità a "done"
//         this._applyVisual(s, 1);
//         if (this.onPurified) this.onPurified(i, this._doneCount, this._sanct.length);
//       }
//     }
//   }

//   _applyVisual(s, t){
//     // ring: colore→mix e opacità
//     s.ring.material.color
//       .copy(this._colIdle)
//       .lerp(this._colCharge, t)
//       .lerp(this._colDone, Math.max(0, t-0.85)*7.0);
//     s.ring.material.opacity = 0.18 + 0.55 * t;

//     // emissive del totem + intensità luce
//     const em = new THREE.Color()
//       .copy(this._colIdle)
//       .lerp(this._colCharge, t)
//       .lerp(this._colDone, Math.max(0, t-0.85)*7.0);
//     const emInt = 0.2 + 1.2 * t;

//     s.model.traverse(o=>{
//       if (o.isMesh && o.material && 'emissive' in o.material) {
//         o.material.emissive.copy(em);
//         o.material.emissiveIntensity = emInt;
//         o.material.needsUpdate = true;
//       }
//     });

//     s.light.intensity = 0.0 + 1.6 * t;
//   }
// }



// src/systems/SanctuarySystem.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { FBXLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/FBXLoader.js';

// Scala a un'altezza target e appoggia la base a y=0
function fitObjectToHeight(obj, targetH = 0.9) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const curH = size.y > 1e-6 ? size.y : 1.0;

  const s = targetH / curH;
  obj.scale.multiplyScalar(s);

  obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y; // base a terra

  obj.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(obj);
  const sz3 = new THREE.Vector3();
  box3.getSize(sz3);
  return sz3.y; // altezza finale
}

export class SanctuarySystem {
  /**
   * opts: { scene, camera, beamSystem, spawner, modelUrl,
   *         items:[{x,z,radius,holdSeconds,targetHeight}], decayRate, targetHeight, onPurified }
   */
  constructor(opts = {}) {
    this.scene       = opts.scene;
    this.camera      = opts.camera;
    this.beamSystem  = opts.beamSystem;
    this.spawner     = opts.spawner;
    this.modelUrl    = opts.modelUrl;
    this.itemsDef    = opts.items || [];
    this.decayRate   = opts.decayRate ?? 0.25;
    this.targetHeight= opts.targetHeight ?? 200.5; // 200.5 cm
    this.onPurified  = typeof opts.onPurified === 'function' ? opts.onPurified : null;

    this._ray        = new THREE.Raycaster();
    this._tmpV       = new THREE.Vector3();
    this._apex       = new THREE.Vector3();
    this._beamDir    = new THREE.Vector3();

    this._fbx        = null;
    this._sanct      = [];
    this._doneCount  = 0;

    // palette
    this._colIdle    = new THREE.Color(0x64a6ff); // blu tenue
    this._colCharge  = new THREE.Color(0x66ffcc); // ciano/verde
    this._colDone    = new THREE.Color(0x39ff95); // verde acqua
  }

  async init(){
    // carica FBX prototipo
    const loader = new FBXLoader();
    this._fbx = await loader.loadAsync(this.modelUrl);
    this._fbx.traverse(o=>{
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const m = o.material;
        if (!m || m.isShaderMaterial) return;
        if (!('emissive' in m)) {
          o.material = new THREE.MeshStandardMaterial({
            color: m.color ? m.color.clone() : new THREE.Color(0xaaaaaa),
            roughness: 0.85, metalness: 0.0,
            emissive: new THREE.Color(0x000000),
            emissiveIntensity: 0.0
          });
        } else {
          m.emissive = m.emissive || new THREE.Color(0x000000);
          m.emissiveIntensity = 0.0; // niente glow a riposo
        }
      }
    });

    // istanzia santuari
    for (let i=0; i<this.itemsDef.length; i++){
      const def  = this.itemsDef[i];
      const root = new THREE.Group();
      root.position.set(def.x, 0, def.z);
      this.scene.add(root);

      // modello totem (90 cm default)
      const model = this._fbx.clone(true);
      const finalH = fitObjectToHeight(model, def.targetHeight ?? this.targetHeight);
      root.add(model);

      // ring a terra (fog OFF per visibilità nella nebbia)
      const rOuter = (def.radius != null) ? def.radius : 40; // cerchio ben visibile
      const rInner = Math.max(0.6 * rOuter, rOuter - 2.5);
      const ringGeo = new THREE.RingGeometry(rInner, rOuter, 48);
      ringGeo.rotateX(-Math.PI/2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: this._colIdle.clone(),
        transparent: true, opacity: 0.18, depthWrite: false
      });
      ringMat.fog = false; // NON subisce fog
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.02;
      root.add(ring);

      // beacon verticale (pilastro di luce morbido) — fog OFF
      const hBeacon = Math.max(4, finalH * 3.0);
      const rBeacon = Math.max(0.8, rOuter * 0.25);
      const beaconGeo = new THREE.CylinderGeometry(rBeacon, rBeacon * 0.6, hBeacon, 16, 1, true);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.0,                 // cresce con la carica
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      beaconMat.fog = false;          // NON sbianca con la nebbia
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = hBeacon * 0.5;
      root.add(beacon);

      // luce puntiforme soft (range ridotto, niente effetto “lavatrice”)
      const light = new THREE.PointLight(0x66ffcc, 0.0, rOuter * 4, 2.0);
      light.position.set(0, Math.max(0.8, finalH * 1.2), 0);
      root.add(light);

      this._sanct.push({
        def, root, model, ring, beacon, light,
        modelHeight: finalH,
        aimYOffset: finalH * 0.6,
        charge: 0,
        holdSeconds: def.holdSeconds ?? 3.0,
        radius: rOuter,
        state: 'idle',
        _spawnTick: 0
      });
    }
  }

  update(dt, ctx = {}){
    if (!this.beamSystem || this._sanct.length === 0) return;

    const cosHalf = Math.cos(THREE.MathUtils.degToRad(this.beamSystem.halfAngleDeg));
    this.beamSystem.getBeamApex?.(this._apex);
    this.beamSystem.getBeamForward?.(this._beamDir);

    const obstacles = this.beamSystem.obstacles || [];
    const maxRange  = this.beamSystem.maxRange || 9999;

    for (let i=0; i<this._sanct.length; i++){
      const s = this._sanct[i];
      if (s.state === 'done') { this._applyVisual(s, 1.0); continue; }

      // 1) dentro il cerchio?
      const dx = ctx.playerPos.x - s.root.position.x;
      const dz = ctx.playerPos.z - s.root.position.z;
      const inCircle = (dx*dx + dz*dz) <= (s.radius*s.radius);

      // 2) totem nel cono?
      const aim = this._tmpV.set(s.root.position.x, s.root.position.y + s.aimYOffset, s.root.position.z);
      const to  = aim.clone().sub(this._apex);
      const dist = to.length();
      let inCone = false, losOK = false;
      if (dist > 1e-3 && dist <= maxRange) {
        to.multiplyScalar(1/dist);
        inCone = (to.dot(this._beamDir) >= cosHalf);
        if (inCone) {
          if (obstacles.length === 0) losOK = true;
          else {
            this._ray.set(this._apex, to); this._ray.far = dist;
            losOK = (this._ray.intersectObjects(obstacles, true).length === 0);
          }
        }
      }

      const canCharge = ctx.beamOn && inCircle && inCone && losOK;

      if (canCharge) {
        s.state = 'purifying';
        s.charge = Math.min(s.holdSeconds, s.charge + dt);
        s._spawnTick += dt;
        if (s._spawnTick > 1.2 && this.spawner?.forceSpawnNow) { this.spawner.forceSpawnNow(); s._spawnTick = 0; }
      } else {
        s.state = (s.charge > 0) ? 'idle' : 'idle';
        s.charge = Math.max(0, s.charge - this.decayRate * dt);
        s._spawnTick = 0;
      }

      const t = THREE.MathUtils.clamp(s.charge / s.holdSeconds, 0, 1);
      this._applyVisual(s, t);

      if (t >= 1 && s.state !== 'done') {
        s.state = 'done';
        this._applyVisual(s, 1);
        if (++this._doneCount && this.onPurified) this.onPurified(i, this._doneCount, this._sanct.length);
      }
    }
  }

  _applyVisual(s, t){
    // ring più sobrio, niente fog
    s.ring.material.color
      .copy(this._colIdle)
      .lerp(this._colCharge, t)
      .lerp(this._colDone, Math.max(0, t-0.85)*7.0);
    s.ring.material.opacity = 0.12 + 0.38 * t;

    // beacon: glow additivo che cresce con t
    s.beacon.material.opacity = 0.05 + 0.22 * t;
    s.beacon.material.color
      .copy(this._colIdle)
      .lerp(this._colCharge, t)
      .lerp(this._colDone, Math.max(0, t-0.85)*7.0);

    // emissive del totem
    const emCol = new THREE.Color()
      .copy(this._colIdle)
      .lerp(this._colCharge, t)
      .lerp(this._colDone, Math.max(0, t-0.85)*7.0);
    const emInt = 0.0 + 1.0 * t; // nessuna emissive a riposo
    s.model.traverse(o=>{
      if (o.isMesh && o.material && 'emissive' in o.material) {
        o.material.emissive.copy(emCol);
        o.material.emissiveIntensity = emInt;
        o.material.needsUpdate = true;
      }
    });

    // luce soft, raggio ridotto
    s.light.intensity = 0.0 + 1.2 * t;
  }
}
