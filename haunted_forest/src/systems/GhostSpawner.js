// // src/systems/GhostSpawner.js
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { Ghost } from '../entities/Ghost.js';

// function clamp01(v){ return Math.max(0, Math.min(1, v)); }
// function rand01(){ return Math.random(); }

// export class GhostSpawner {
//   constructor(opts = {}) {
//     // External deps
//     this.scene       = opts.scene;
//     this.camera      = opts.camera;
//     this.getGroundY  = opts.getGroundY || (() => 0);
//     this.getFocusPos = opts.getFocusPos || null; // focus point: target/player

//     // Pool / Active
//     this.pool   = [];
//     this.active = new Set();

//     // Parameters (defaults)
//     this.params = {
//       poolSize:      opts.poolSize      ?? 12,
//       maxAlive:      opts.maxAlive      ?? 4,
//       spawnInterval: opts.spawnInterval ?? 4.0,
//       minR:          opts.minR          ?? 6.0,
//       maxR:          opts.maxR          ?? 14.0,
//       minPlayerDist: opts.minPlayerDist ?? 5.0,
//       minSeparation: opts.minSeparation ?? 2.0,
//       maxTriesPerTick: opts.maxTriesPerTick ?? 12,

//       // visibility rule
//       antiPopIn:     opts.antiPopIn ?? false,   // false = allow spawning in view

//       // --- NEW: sector-based spawn control
//       spawnMode:           opts.spawnMode ?? 'mix', // 'none'|'behind'|'front'|'left'|'right'|'mix'
//       sectorHalfAngleDeg:  opts.sectorHalfAngleDeg ?? 60, // half-angle per sector (±)
//       mixWeights:          {                        // used if spawnMode === 'mix'
//         front:  (opts.mixWeights?.front  ?? 0.25),
//         behind: (opts.mixWeights?.behind ?? 0.5),
//         left:   (opts.mixWeights?.left   ?? 0.125),
//         right:  (opts.mixWeights?.right  ?? 0.125),
//       },

//       // Ghost defaults
//       ghostOpts:      opts.ghostOpts ?? {},
//     };

//     // State
//     this.spawnCooldown = this.params.spawnInterval;

//     // scratch
//     this._frustum = new THREE.Frustum();
//     this._proj    = new THREE.Matrix4();
//     this._tmpV    = new THREE.Vector3();
//     this._forward = new THREE.Vector3();
//     this._right   = new THREE.Vector3();
//   }

//   async init() {
//     // Pre-create + load pool
//     for (let i = 0; i < this.params.poolSize; i++) {
//       const g = new Ghost({
//         ...this.params.ghostOpts,
//         getGroundY:  this.getGroundY,
//         // IMPORTANT: use focus/target as the AI target
//         getTargetPos: () => (typeof this.getFocusPos === 'function' ? this.getFocusPos() : null),
//       });
//       await g.load();
//       this.pool.push(g);
//     }
//   }

//   // --- Public controls ---
//   firstActive() { for (const g of this.active) return g; return null; }
//   incMaxAlive(n=1){ this.params.maxAlive += n; }
//   decMaxAlive(n=1){ this.params.maxAlive = Math.max(0, this.params.maxAlive - n); }

//   setSpawnMode(mode){
//     this.params.spawnMode = mode;
//   }
//   toggleAntiPopIn(){
//     this.params.antiPopIn = !this.params.antiPopIn;
//   }

//   forceSpawnNow(){
//     this.spawnCooldown = 0;
//     this._trySpawnOne(); // attempt immediately
//   }
//   fillToCap(){
//     let guard = 32;
//     while (this.active.size < this.params.maxAlive && guard-- > 0) {
//       if (!this._trySpawnOne()) break;
//     }
//   }
//   cleanseAll(){
//     for (const g of this.active) g.cleanse();
//   }

//   // --- Main tick ---
//   update(dt) {
//     // recycle inactive
//     this._recycleInactive();

//     // cooldown
//     this.spawnCooldown -= dt;

//     if (this.spawnCooldown <= 0 && this.active.size < this.params.maxAlive) {
//       const spawned = this._trySpawnOne();
//       // reset timer (small backoff if failed)
//       this.spawnCooldown = spawned ? this.params.spawnInterval : Math.max(0.5, this.params.spawnInterval * 0.25);
//     }
//   }

//   // --- Internals ---
//   _recycleInactive(){
//     for (const g of this.active) {
//       if (g.state === 'inactive') {
//         // remove from scene + recycle
//         if (g.root.parent) g.root.parent.remove(g.root);
//         this.active.delete(g);
//         this.pool.push(g);
//       }
//     }
//   }

//   _getFromPool(){
//     return this.pool.pop() || null;
//   }

//   _trySpawnOne(){
//     if (this.pool.length === 0) return false;
//     if (typeof this.getFocusPos !== 'function') return false;

//     const focus = this.getFocusPos();
//     if (!focus) return false;

//     // basis for sector directions: forward = normalize( target - camera ) on XZ
//     this._forward.set(
//       focus.x - this.camera.position.x,
//       0,
//       focus.z - this.camera.position.z
//     ).normalize();

//     // right = rotate forward by +90° around Y
//     this._right.set(this._forward.z, 0, -this._forward.x).normalize();

//     const tries = this.params.maxTriesPerTick;
//     for (let i = 0; i < tries; i++) {
//       const cand = this._sampleCandidate(focus);
//       if (!cand) continue;
//       if (this._rejectByRules(cand, focus)) continue;

//       // success
//       const g = this._getFromPool();
//       if (!g) return false;
//       g.setPosition(cand.x, cand.y, cand.z).addTo(this.scene);
//       g.appear();                 // FSM: appearing -> active
//       this.active.add(g);
//       return true;
//     }
//     return false;
//   }

//   _sampleCandidate(focus){
//     const { minR, maxR, spawnMode, sectorHalfAngleDeg } = this.params;

//     // choose direction (unit vector on XZ) based on mode/weights
//     const dir2D = this._pickDirection2D(spawnMode);

//     // spread inside sector by ±halfAngle
//     const half = THREE.MathUtils.degToRad(sectorHalfAngleDeg);
//     const jitter = (rand01() * 2 - 1) * half;

//     // rotate dir2D by jitter around Y
//     const cosJ = Math.cos(jitter), sinJ = Math.sin(jitter);
//     const rx = dir2D.x * cosJ - dir2D.z * sinJ;
//     const rz = dir2D.x * sinJ + dir2D.z * cosJ;

//     // radius (uniform in area): r = sqrt(lerp(min^2, max^2, u))
//     const r2min = minR * minR;
//     const r2max = maxR * maxR;
//     const r = Math.sqrt( r2min + (r2max - r2min) * rand01() );

//     const x = focus.x + rx * r;
//     const z = focus.z + rz * r;
//     const y = this.getGroundY(x,z) + 1.4; // float above ground

//     return new THREE.Vector3(x, y, z);
//   }

//   _pickDirection2D(mode){
//     // build basis
//     const F = this._forward; // towards camera from focus
//     const R = this._right;   // right relative to F
//     const B = new THREE.Vector3(-F.x, 0, -F.z);
//     const L = new THREE.Vector3(-R.x, 0, -R.z);

//     switch (mode) {
//       case 'front':  return F.clone();
//       case 'behind': return B.clone();
//       case 'left':   return L.clone();
//       case 'right':  return R.clone();
//       case 'none':   // full ring (no bias)
//       default: {
//         if (mode !== 'mix') {
//           // full 360°: pick a random angle around focus
//           const ang = rand01() * Math.PI * 2;
//           return new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
//         }
//         // mix mode: weighted pick among F/B/L/R
//         const w = this.params.mixWeights || {};
//         const wf = Math.max(0, +w.front  || 0);
//         const wb = Math.max(0, +w.behind || 0);
//         const wl = Math.max(0, +w.left   || 0);
//         const wr = Math.max(0, +w.right  || 0);
//         const sum = wf+wb+wl+wr || 1;
//         let u = rand01() * sum;
//         if ((u -= wf) < 0) return F.clone();
//         if ((u -= wb) < 0) return B.clone();
//         if ((u -= wl) < 0) return L.clone();
//         return R.clone();
//       }
//     }
//   }

//   _rejectByRules(p, focus){
//     const { minPlayerDist, minSeparation, antiPopIn } = this.params;

//     // (1) too close to focus (player/target)
//     if (Math.hypot(p.x - focus.x, p.z - focus.z) < minPlayerDist) {
//       return true;
//     }

//     // (2) separation from other ghosts
//     for (const g of this.active) {
//       const gx = g.root.position.x, gz = g.root.position.z;
//       if (Math.hypot(p.x - gx, p.z - gz) < minSeparation) return true;
//     }

//     // (3) frustum (only if strict anti-pop-in ON)
//     if (antiPopIn) {
//       this._proj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
//       this._frustum.setFromProjectionMatrix(this._proj);
//       if (this._frustum.containsPoint(p)) return true;
//     }

//     return false;
//   }
// }


// src/systems/GhostSpawner.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Ghost } from '../entities/Ghost.js';

function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function rand01(){ return Math.random(); }

export class GhostSpawner {
  constructor(opts = {}) {
    // External deps
    this.scene       = opts.scene;
    this.camera      = opts.camera;
    this.getGroundY  = opts.getGroundY || (() => 0);
    this.getFocusPos = opts.getFocusPos || null; // focus point: target/player
    this.attachFog   = typeof opts.attachFog === 'function' ? opts.attachFog : null; // << NEW

    // Pool / Active
    this.pool   = [];
    this.active = new Set();

    // Parameters (defaults)
    this.params = {
      poolSize:      opts.poolSize      ?? 12,
      maxAlive:      opts.maxAlive      ?? 4,
      spawnInterval: opts.spawnInterval ?? 4.0,
      minR:          opts.minR          ?? 6.0,
      maxR:          opts.maxR          ?? 14.0,
      minPlayerDist: opts.minPlayerDist ?? 5.0,
      minSeparation: opts.minSeparation ?? 2.0,
      maxTriesPerTick: opts.maxTriesPerTick ?? 12,

      // visibility rule
      antiPopIn:     opts.antiPopIn ?? false,   // false = allow spawning in view

      // sector-based spawn control
      spawnMode:           opts.spawnMode ?? 'mix', // 'none'|'behind'|'front'|'left'|'right'|'mix'
      sectorHalfAngleDeg:  opts.sectorHalfAngleDeg ?? 60,
      mixWeights: {
        front:  (opts.mixWeights?.front  ?? 0.25),
        behind: (opts.mixWeights?.behind ?? 0.5),
        left:   (opts.mixWeights?.left   ?? 0.125),
        right:  (opts.mixWeights?.right  ?? 0.125),
      },

      // Ghost defaults
      ghostOpts:      opts.ghostOpts ?? {},
    };

    // State
    this.spawnCooldown = this.params.spawnInterval;

    // scratch
    this._frustum = new THREE.Frustum();
    this._proj    = new THREE.Matrix4();
    this._tmpV    = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right   = new THREE.Vector3();
  }

  async init() {
    // Pre-create + load pool
    for (let i = 0; i < this.params.poolSize; i++) {
      const g = new Ghost({
        ...this.params.ghostOpts,
        getGroundY:  this.getGroundY,
        // IMPORTANT: use focus/target as the AI target
        getTargetPos: () => (typeof this.getFocusPos === 'function' ? this.getFocusPos() : null),
      });
      await g.load();
      this.pool.push(g);
    }
  }

  // --- Public controls ---
  firstActive() { for (const g of this.active) return g; return null; }
  incMaxAlive(n=1){ this.params.maxAlive += n; }
  decMaxAlive(n=1){ this.params.maxAlive = Math.max(0, this.params.maxAlive - n); }

  setSpawnMode(mode){
    this.params.spawnMode = mode;
  }
  toggleAntiPopIn(){
    this.params.antiPopIn = !this.params.antiPopIn;
  }

  forceSpawnNow(){
    this.spawnCooldown = 0;
    this._trySpawnOne(); // attempt immediately
  }
  fillToCap(){
    let guard = 32;
    while (this.active.size < this.params.maxAlive && guard-- > 0) {
      if (!this._trySpawnOne()) break;
    }
  }
  cleanseAll(){
    for (const g of this.active) g.cleanse();
  }

  // HUD / Telemetry
  stats(now = 0){
    return {
      alive:    this.active.size,
      maxAlive: this.params.maxAlive,
      pool:     this.pool.length,
      nextIn:   Math.max(0, this.spawnCooldown),
      mode:     this.params.spawnMode,
      antiPopIn: !!this.params.antiPopIn,
    };
  }

  // --- Main tick ---
  update(dt) {
    // recycle inactive
    this._recycleInactive();

    // cooldown
    this.spawnCooldown -= dt;

    if (this.spawnCooldown <= 0 && this.active.size < this.params.maxAlive) {
      const spawned = this._trySpawnOne();
      // reset timer (small backoff if failed)
      this.spawnCooldown = spawned ? this.params.spawnInterval : Math.max(0.5, this.params.spawnInterval * 0.25);
    }

    // advance active ghosts (bob/sway, FSM, motion)
    for (const g of this.active) g.update?.(dt);
  }

  // --- Internals ---
  _recycleInactive(){
    for (const g of this.active) {
      if (g.state === 'inactive') {
        // remove from scene + recycle
        if (g.root.parent) g.root.parent.remove(g.root);
        this.active.delete(g);
        this.pool.push(g);
      }
    }
  }

  _getFromPool(){
    return this.pool.pop() || null;
  }

  _trySpawnOne(){
    if (this.pool.length === 0) return false;
    if (typeof this.getFocusPos !== 'function') return false;

    const focus = this.getFocusPos();
    if (!focus) return false;

    // basis for sector directions: forward = normalize( target - camera ) on XZ
    this._forward.set(
      focus.x - this.camera.position.x,
      0,
      focus.z - this.camera.position.z
    ).normalize();

    // right = rotate forward by +90° around Y
    this._right.set(this._forward.z, 0, -this._forward.x).normalize();

    const tries = this.params.maxTriesPerTick;
    for (let i = 0; i < tries; i++) {
      const cand = this._sampleCandidate(focus);
      if (!cand) continue;
      if (this._rejectByRules(cand, focus)) continue;

      // success
      const g = this._getFromPool();
      if (!g) return false;
      g.setPosition(cand.x, cand.y, cand.z).addTo(this.scene);
      // aggancia fogTime / patch fog se necessario
      if (this.attachFog) this.attachFog(g.root);   // << NEW
      g.appear();                 // FSM: appearing -> active
      this.active.add(g);
      return true;
    }
    return false;
  }

  _sampleCandidate(focus){
    const { minR, maxR, spawnMode, sectorHalfAngleDeg } = this.params;

    // choose direction (unit vector on XZ) based on mode/weights
    const dir2D = this._pickDirection2D(spawnMode);

    // spread inside sector by ±halfAngle
    const half = THREE.MathUtils.degToRad(sectorHalfAngleDeg);
    const jitter = (rand01() * 2 - 1) * half;

    // rotate dir2D by jitter around Y
    const cosJ = Math.cos(jitter), sinJ = Math.sin(jitter);
    const rx = dir2D.x * cosJ - dir2D.z * sinJ;
    const rz = dir2D.x * sinJ + dir2D.z * cosJ;

    // radius (uniform in area): r = sqrt(lerp(min^2, max^2, u))
    const r2min = minR * minR;
    const r2max = maxR * maxR;
    const r = Math.sqrt( r2min + (r2max - r2min) * rand01() );

    const x = focus.x + rx * r;
    const z = focus.z + rz * r;
    const y = this.getGroundY(x,z) + 1.4; // float above ground

    return new THREE.Vector3(x, y, z);
  }

  _pickDirection2D(mode){
    // build basis
    const F = this._forward; // towards camera from focus
    const R = this._right;   // right relative to F
    const B = new THREE.Vector3(-F.x, 0, -F.z);
    const L = new THREE.Vector3(-R.x, 0, -R.z);

    switch (mode) {
      case 'front':  return F.clone();
      case 'behind': return B.clone();
      case 'left':   return L.clone();
      case 'right':  return R.clone();
      case 'none':   // full ring (no bias)
      default: {
        if (mode !== 'mix') {
          // full 360°: pick a random angle around focus
          const ang = rand01() * Math.PI * 2;
          return new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        }
        // mix mode: weighted pick among F/B/L/R
        const w = this.params.mixWeights || {};
        const wf = Math.max(0, +w.front  || 0);
        const wb = Math.max(0, +w.behind || 0);
        const wl = Math.max(0, +w.left   || 0);
        const wr = Math.max(0, +w.right  || 0);
        const sum = wf+wb+wl+wr || 1;
        let u = rand01() * sum;
        if ((u -= wf) < 0) return F.clone();
        if ((u -= wb) < 0) return B.clone();
        if ((u -= wl) < 0) return L.clone();
        return R.clone();
      }
    }
  }

  _rejectByRules(p, focus){
    const { minPlayerDist, minSeparation, antiPopIn } = this.params;

    // (1) too close to focus (player/target)
    if (Math.hypot(p.x - focus.x, p.z - focus.z) < minPlayerDist) {
      return true;
    }

    // (2) separation from other ghosts
    for (const g of this.active) {
      const gx = g.root.position.x, gz = g.root.position.z;
      if (Math.hypot(p.x - gx, p.z - gz) < minSeparation) return true;
    }

    // (3) frustum (only if strict anti-pop-in ON)
    if (antiPopIn) {
      this._proj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._proj);
      if (this._frustum.containsPoint(p)) return true;
    }

    return false;
  }
}
