// src/entities/Ghost.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { patchGhostMaterial } from '../entities/dissolvePatch.js';

/* -------- feature detector: keeps eyes/mouth/cheeks opaque & colored -------- */
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
        emissiveIntensity: 0.25,
        depthWrite: false,
        depthTest: true,
        vertexColors: !!geom.attributes.color,
      });
      patchGhostMaterial(mat); // inject uniforms (uPulseTime, uThreshold…) — no discard yet
      (mesh.userData._uniformSets ||= []).push(mat.userData._ghostUniforms);
      return mat;
    }
  });

  mesh.material = Array.isArray(src) ? newMats : newMats[0];
  return newMats;
}

// tmp vectors (riutilizzati per evitare allocazioni)
const _tmpW = new THREE.Vector3();
const _tmpW2 = new THREE.Vector3();

export class Ghost {
  /**
   * @param {Object} opts
   *  - url: string to .glb or .obj
   *  - targetHeight: desired world height (meters)
   *  - opacityBody: alpha for the body
   *  - getGroundY(x,z): funzione che ritorna la quota terreno in WORLD
   *  - clearance: distanza minima dal terreno (m)
   */
  constructor(opts = {}) {
    this.url           = opts.url ?? '/assets/models/ghost/ghost.glb';
    this.targetHeight  = opts.targetHeight ?? 2.2;
    this.opacityBody   = opts.opacityBody ?? 0.75;

    // terreno/world awareness
    this.getGroundY = opts.getGroundY || ((x, z) => 0.0);
    this.clearance  = (opts.clearance ?? 0.05);

    // World transform lives on "root"; idle animation lives on "rig"
    this.root = new THREE.Group(); this.root.name = 'Ghost';
    this.rig  = new THREE.Group(); this.rig.name  = 'GhostRig';
    this.root.add(this.rig);

    this.model  = null;
    this.materials   = [];
    this.uniformSets = []; // {uPulseTime, uThreshold, ...} per body material
    this.baseRadius  = 0.8;

    // --- Idle animation params (can be randomized later by a Director) ---
    // Sane defaults for a calm float; all values in meters/radians/seconds
    this.idle = {
      baseY: 0.01,                          // rest height above ground (locale al rig)
      phase: Math.random() * Math.PI * 2,   // de-sync multiple ghosts
      ampBob: 0.25,                         // vertical amplitude (m)
      omegaBob: 1.3,                        // vertical angular speed (rad/s) ~0.2 Hz
      swayAmpX: THREE.MathUtils.degToRad(3),// tilt around X (radians)
      swayAmpZ: THREE.MathUtils.degToRad(3),// tilt around Z (radians)
      swayOmega: 1.05,                      // angular speed for sway (rad/s)
      clampGround: true,                    // clamp rispetto al terreno reale
      minY: 0.0,                            // min locale
      maxY: null,                           // max locale
    };

    // Debug knobs you can tweak from console
    this.debug = {
      freezeIdle: false,
      scaleIdle: 1.0, // multiplies all amplitudes
    };

    this._time = 0; // also drives uPulseTime
  }

  async load() {
    const isGLB = this.url.toLowerCase().endsWith('.glb') || this.url.toLowerCase().endsWith('.gltf');
    const model = isGLB
      ? (await new GLTFLoader().loadAsync(this.url)).scene
      : (await new OBJLoader().loadAsync(this.url));

    this.model = model;
    this.rig.add(model); // <-- IMPORTANT: model goes under rig (idle motion lives here)

    // Normalize: center XZ, lift to y=0, scale to target height, re-lift
    this._normalize();

    // Apply material policy + shader patch
    this._applyMaterials();

    return this;
  }

  addTo(parent) { parent.add(this.root); return this; }

  setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
  getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }
  setVisible(v) { this.root.visible = !!v; }

  setBaseY(y) { this.idle.baseY = y; return this; }

  setIdleParams(partial = {}) {
    Object.assign(this.idle, partial);
    return this;
  }

  update(dt) {
    this._time += dt;
    for (const set of this.uniformSets) {
      if (set?.uPulseTime) set.uPulseTime.value = this._time;
    }

    if (!this.debug.freezeIdle) {
      const k   = Math.max(0, this.debug.scaleIdle || 1);
      const t   = this._time;
      const ph  = this.idle.phase;

      const y  = this.idle.baseY + (this.idle.ampBob * k) * Math.sin(this.idle.omegaBob * t + ph);
      const rx = (this.idle.swayAmpX * k) * Math.sin(this.idle.swayOmega * t + ph * 0.7);
      const rz = (this.idle.swayAmpZ * k) * Math.sin(this.idle.swayOmega * t + ph * 1.13);

      // ---------- clamp robusto rispetto al terreno (in WORLD) ----------
      let floorLocal = -Infinity;

      // min/ground in WORLD -> convertito nello spazio locale del root (stesso spazio di rig.position)
      if (this.idle.clampGround && this.root) {
        // world position del root (serve x,z mondo)
        this.root.getWorldPosition(_tmpW);
        const xw = _tmpW.x, zw = _tmpW.z;

        // quota terreno in (x,z) mondo + margine
        const groundY = this.getGroundY(xw, zw) + this.clearance;

        // prendi quel punto in WORLD (stessa x,z del root, y = groundY) e converti a LOCAL root
        _tmpW2.set(xw, groundY, zw);
        this.root.worldToLocal(_tmpW2);
        const minLocalFromWorld = _tmpW2.y; // soglia locale per rig.position.y

        floorLocal = Math.max(floorLocal, minLocalFromWorld);
      }

      if (typeof this.idle.minY === 'number') floorLocal = Math.max(floorLocal, this.idle.minY);
      const ceilLocal = (typeof this.idle.maxY === 'number') ? this.idle.maxY : +Infinity;

      const ySafe = Math.min(ceilLocal, Math.max(floorLocal, y));

      this.rig.position.y = ySafe;
      this.rig.rotation.x = rx;
      this.rig.rotation.z = rz;
    }
  }

  // ---------- internals ----------
  _normalize() {
    // Compute bbox BEFORE scaling
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    // Center XZ and lift so base is at y=0
    this.model.position.x -= center.x;
    this.model.position.z -= center.z;
    this.model.position.y -= box.min.y;

    // Scale to target height
    const currentH = size.y || 1.0;
    const s = this.targetHeight / currentH;
    this.model.scale.setScalar(s);

    // Re-lift AFTER scaling so the base is EXACTLY y=0
    const box2 = new THREE.Box3().setFromObject(this.model);
    this.model.position.y -= box2.min.y;

    // Base radius (used later by spawner/LOS spacing)
    const size2 = new THREE.Vector3(); box2.getSize(size2);
    this.baseRadius = 0.5 * Math.hypot(size2.x, size2.z);
  }

  _applyMaterials() {
    this.materials.length = 0;
    this.uniformSets.length = 0;

    this.model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
      this.materials.push(...(Array.isArray(mats) ? mats : [mats]));
      if (o.userData._uniformSets) this.uniformSets.push(...o.userData._uniformSets);

      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 10;   // ↑ più alto: evita che il ground lo “copra”
    });
  }
}

















