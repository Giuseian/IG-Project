// // src/entities/Ghost.js
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
// import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
// import { patchGhostMaterial } from '../entities/dissolvePatch.js';

// export class Ghost {
//   /**
//    * @param {Object} opts
//    *  - url: '/assets/models/ghost/ghost.glb' (or .obj)
//    *  - targetHeight: desired world height in meters (default 2.2)
//    *  - opacityBody: transparency for body (default 0.75)
//    */
//   constructor(opts = {}) {
//     this.url = opts.url ?? '/assets/models/ghost/ghost.glb';
//     this.targetHeight = opts.targetHeight ?? 2.2;
//     this.opacityBody = opts.opacityBody ?? 0.75;

//     this.root = new THREE.Group();
//     this.root.name = 'Ghost';
//     this.model = null;

//     this.materials = [];     // all materials patched
//     this.baseRadius = 0.8;   // filled after normalization
//     this._pulse = 0;         // time accumulator
//   }

//   async load() {
//     const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');

//     // 1) Load model
//     const model = isGLB
//       ? await new Promise((res, rej) => new GLTFLoader().load(this.url, (g) => res(g.scene), undefined, rej))
//       : await new Promise((res, rej) => new OBJLoader().load(this.url, (o) => res(o), undefined, rej));

//     this.model = model;
//     this.root.add(model);

//     // 2) Replace materials with a consistent policy and patch them
//     model.traverse((child) => {
//       if (!child.isMesh) return;

//       // simple PBR ghost look (stable transparency)
//       const mat = new THREE.MeshStandardMaterial({
//         color: 0xffffff,
//         transparent: true,
//         opacity: this.opacityBody,
//         roughness: 0.3,
//         metalness: 0.0,
//         emissive: new THREE.Color(0x66ffff),
//         emissiveIntensity: 0.25,
//         depthWrite: false,     // important for transparent
//       });
//       child.material = mat;
//       patchGhostMaterial(mat);
//       this.materials.push(mat);

//       child.castShadow = false;
//       child.receiveShadow = false;
//     });

//     // 3) Normalize: scale to target height and lift base to y=0
//     this._normalizeScaleAndPivot();

//     // Done
//     return this;
//   }

//   _normalizeScaleAndPivot() {
//     this.model.updateMatrixWorld(true);

//     // current size
//     const box = new THREE.Box3().setFromObject(this.model);
//     const size = new THREE.Vector3();
//     box.getSize(size);

//     // scale to target height
//     const scale = (this.targetHeight > 0 && size.y > 0) ? (this.targetHeight / size.y) : 1.0;
//     this.model.scale.setScalar(scale);
//     this.model.updateMatrixWorld(true);

//     // recompute after scaling
//     const box2 = new THREE.Box3().setFromObject(this.model);
//     const size2 = new THREE.Vector3();
//     const center2 = new THREE.Vector3();
//     box2.getSize(size2);
//     box2.getCenter(center2);

//     // lift so base sits on y=0
//     const baseY = box2.min.y;
//     this.model.position.y += -baseY;

//     // store a baseRadius (XZ footprint) for future spawn/LOS logic
//     const dx = box2.max.x - box2.min.x;
//     const dz = box2.max.z - box2.min.z;
//     this.baseRadius = 0.5 * Math.sqrt(dx * dx + dz * dz);

//     this.model.updateMatrixWorld(true);
//   }

//   addTo(parent) { parent.add(this.root); }
//   setVisible(v) { this.root.visible = v; }
//   setPosition(x, y, z) { this.root.position.set(x, y, z); }
//   getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }

//   update(dt) {
//     this._pulse += dt;
//     // push time into every patched material
//     for (const m of this.materials) {
//       const u = m.userData._ghostUniforms;
//       if (u?.uPulseTime) u.uPulseTime.value = this._pulse;
//     }
//   }
// }


// src/entities/Ghost.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { patchGhostMaterial } from '../entities/dissolvePatch.js'; // If your file is at /src/, use "../dissolvePatch.js"

// --- feature detector: match your names from Blender/OBJ ---
function isFeature(mesh, mat) {
  const a = (mesh?.name || '').toLowerCase();
  const b = (mat?.name  || '').toLowerCase();
  // works for "Ghost_Eyes", "Ghost_Mouth", "Ghost_Cheeks.001", etc.
  const re = /(ghost_)?(eyes?|mouth|cheeks?)/;
  return re.test(a) || re.test(b);
}

// --- build materials for a single mesh (keeps eyes/mouth/cheeks opaque & colored) ---
function buildGhostMaterialsForMesh(mesh, opacityBody) {
  const src = mesh.material;
  const srcMats = Array.isArray(src) ? src : [src];
  const geom = mesh.geometry;

  const newMats = srcMats.map((m) => {
    const feature = isFeature(mesh, m);

    if (feature) {
      // Eyes/Mouth/Cheeks: opaque, keep their color, no emissive cyan tint
      return new THREE.MeshStandardMaterial({
        name: (m?.name || '') + '_feature',
        color: (m?.color ? m.color.clone() : new THREE.Color(0x111111)),
        metalness: 0.0,
        roughness: 0.6,
        transparent: false,
        depthWrite: true,
        depthTest: true,
        vertexColors: !!geom.attributes.color, // keep vertex color blush if painted here
      });
    } else {
      // Body: semi-transparent PBR + emissive, allow vertex colors (for blush on body)
      const mat = new THREE.MeshStandardMaterial({
        name: (m?.name || '') + '_body',
        color: (m?.color ? m.color.clone() : new THREE.Color(0xffffff)),
        metalness: 0.0,
        roughness: 0.35,
        transparent: true,
        opacity: opacityBody,              // e.g. 0.75
        emissive: new THREE.Color(0x66ffff),
        emissiveIntensity: 0.25,
        depthWrite: false,                  // stable transparency
        depthTest: true,
        vertexColors: !!geom.attributes.color,
      });
      // Inject uniforms (uPulseTime, uThreshold...) but **no discard** yet
      patchGhostMaterial(mat);
      // collect uniform refs for updates
      (mesh.userData._uniformSets ||= []).push(mat.userData._ghostUniforms);
      return mat;
    }
  });

  mesh.material = Array.isArray(src) ? newMats : newMats[0];
  return newMats;
}

export class Ghost {
  /**
   * @param {Object} opts
   *  - url: string to .glb or .obj (default '/assets/models/ghost.glb')
   *  - targetHeight: desired world height in meters (default 2.2)
   *  - opacityBody: alpha for body (default 0.75)
   */
  constructor(opts = {}) {
    this.url         = opts.url ?? '/assets/models/ghost/ghost.glb';
    this.targetHeight = opts.targetHeight ?? 2.2;
    this.opacityBody  = opts.opacityBody ?? 0.75;

    this.root   = new THREE.Group();
    this.root.name = 'Ghost';
    this.model  = null;

    this.materials  = [];
    this.uniformSets = [];      // array of { uPulseTime, uThreshold, ... } per body material
    this.baseRadius = 0.8;      // filled after normalization

    this._time = 0;             // for uPulseTime
  }

  async load() {
    const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');
    const model = isGLB
      ? (await new GLTFLoader().loadAsync(this.url)).scene
      : (await new OBJLoader().loadAsync(this.url));

    this.model = model;
    this.root.add(model);

    // Normalize: center XZ, lift to y=0, scale to target height
    this._normalize();

    // Apply material policy + shader patch
    this._applyMaterials();

    return this;
  }

  addTo(parent) { parent.add(this.root); return this; }

  setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
  getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }

  setVisible(v) { this.root.visible = !!v; }

  update(dt) {
    this._time += dt;
    // drive uPulseTime on all patched body materials
    for (const set of this.uniformSets) {
      if (set?.uPulseTime) set.uPulseTime.value = this._time;
    }
  }

  // ---------- internals ----------
  _normalize() {
  // 1) bbox before scale
  const box = new THREE.Box3().setFromObject(this.model);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);

  // 2) center XZ and lift so current base sits at y=0
  this.model.position.x -= center.x;
  this.model.position.z -= center.z;
  this.model.position.y -= box.min.y;

  // 3) scale to target height
  const currentH = size.y || 1.0;
  const s = this.targetHeight / currentH;
  this.model.scale.setScalar(s);

  // 4) **RE-LIFT AFTER SCALING** so the base is exactly y=0
  const box2 = new THREE.Box3().setFromObject(this.model);
  this.model.position.y -= box2.min.y;

  // 5) store base radius for later
  const size2 = new THREE.Vector3(); box2.getSize(size2);
  this.baseRadius = 0.5 * Math.hypot(size2.x, size2.z);
}


  _applyMaterials() {
    this.materials.length = 0;
    this.uniformSets.length = 0;

    this.model.traverse((o) => {
      if (!o.isMesh) return;
      // Build new materials based on mesh role
      const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
      this.materials.push(...(Array.isArray(mats) ? mats : [mats]));
      // Collect uniform sets created by patch (if body)
      if (o.userData._uniformSets) this.uniformSets.push(...o.userData._uniformSets);
      o.castShadow = false;
      o.receiveShadow = false;
      // small renderOrder tweak helps against foliage later
      o.renderOrder = 2;
    });
  }
}
