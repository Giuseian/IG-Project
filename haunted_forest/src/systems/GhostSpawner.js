// src/systems/GhostSpawner.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Ghost } from '../entities/Ghost.js';

function rand01(){ return Math.random(); }

export class GhostSpawner {
  constructor(opts = {}) {
    // External deps
    this.scene       = opts.scene;
    this.camera      = opts.camera;
    this.getGroundY  = opts.getGroundY || (() => 0);
    this.getFocusPos = opts.getFocusPos || null; // punto focus/lead

    // Pool / Active
    this.pool   = [];
    this.active = new Set();

    // Parameters (defaults)
    this.params = {
      // pool/spawn
      poolSize:      opts.poolSize      ?? 12,
      maxAlive:      opts.maxAlive      ?? 4,
      spawnInterval: opts.spawnInterval ?? 4.0,
      minR:          opts.minR          ?? 6.0,
      maxR:          opts.maxR          ?? 14.0,
      minPlayerDist: opts.minPlayerDist ?? 5.0,
      minSeparation: opts.minSeparation ?? 2.0,
      maxTriesPerTick: opts.maxTriesPerTick ?? 12,

      // visibility rule
      antiPopIn:     opts.antiPopIn ?? false,

      // sector-based spawn control
      spawnMode:          opts.spawnMode ?? 'mix', // 'none'|'behind'|'front'|'left'|'right'|'mix'
      sectorHalfAngleDeg: opts.sectorHalfAngleDeg ?? 60,
      mixWeights: {
        front:  (opts.mixWeights?.front  ?? 0.25),
        behind: (opts.mixWeights?.behind ?? 0.5),
        left:   (opts.mixWeights?.left   ?? 0.125),
        right:  (opts.mixWeights?.right  ?? 0.125),
      },

      // DESPAWN / CULLING
      farCull:            opts.farCull            ?? ((opts.maxR ?? 14) * 2), // raggio duro
      despawnBehindDist:  opts.despawnBehindDist  ?? 60,   // quanto "dietro" rispetto al forward
      minBehindRange:     opts.minBehindRange     ?? 30,   // non despawnare se troppo vicino
      behindTime:         opts.behindTime         ?? 1.25, // isteresi temporale
      protectSeconds:     opts.protectSeconds     ?? 0.75, // protezione dopo lo spawn
      despawnStyle:       opts.despawnStyle       ?? 'deactivate', // 'deactivate' | 'cleanse'

      // Ghost defaults
      ghostOpts:          opts.ghostOpts ?? {},
    };

    // State
    this.spawnCooldown = this.params.spawnInterval;
    this._time = 0;

    // scratch
    this._frustum = new THREE.Frustum();
    this._proj    = new THREE.Matrix4();
    this._forward = new THREE.Vector3();
    this._right   = new THREE.Vector3();

    // timers "dietro" + protezione spawn
    this._behindTimers = new Map();   // Ghost -> seconds behind
    this._protectUntil = new Map();   // Ghost -> absolute time (seconds)
  }

  async init() {
    // Pre-carico il pool
    for (let i = 0; i < this.params.poolSize; i++) {
      const g = new Ghost({
        ...this.params.ghostOpts,
        getGroundY:  this.getGroundY,
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
  setSpawnMode(mode){ this.params.spawnMode = mode; }
  toggleAntiPopIn(){ this.params.antiPopIn = !this.params.antiPopIn; }

  forceSpawnNow(){ this.spawnCooldown = 0; this._trySpawnOne(); }
  fillToCap(){
    let guard = 32;
    while (this.active.size < this.params.maxAlive && guard-- > 0) {
      if (!this._trySpawnOne()) break;
    }
  }
  cleanseAll(){ for (const g of this.active) g.cleanse(); }
  cleanseNearest(camPos){
    let best=null, bestD=Infinity;
    for (const g of this.active){
      const dx = g.root.position.x - camPos.x;
      const dz = g.root.position.z - camPos.z;
      const d = Math.hypot(dx,dz);
      if (d < bestD){ best=g; bestD=d; }
    }
    if (best) best.cleanse();
  }

  debugInfo(){
    return {
      alive:    this.active.size,
      maxAlive: this.params.maxAlive,
      pool:     this.pool.length,
      nextIn:   Math.max(0, this.spawnCooldown),
      mode:     this.params.spawnMode,
      antiPopIn:this.params.antiPopIn,
    };
  }

  // --- Main tick ---
  update(dt) {
    this._time += dt;

    // 1) riciclo quelli diventati inactive
    this._recycleInactive();

    // 2) culling per distanza / dietro la camera
    this._cullByDistanceAndBehind(dt);

    // 3) cooldown & spawn
    this.spawnCooldown -= dt;
    if (this.spawnCooldown <= 0 && this.active.size < this.params.maxAlive) {
      const spawned = this._trySpawnOne();
      this.spawnCooldown = spawned ? this.params.spawnInterval : Math.max(0.5, this.params.spawnInterval * 0.25);
    }

    // IMPORTANTE: avanzare FSM/idle/motion dei ghost
    for (const g of this.active) g.update?.(dt);
  }

  // --- Internals ---
  _recycleInactive(){
    for (const g of Array.from(this.active)) {
      if (g.state === 'inactive') {
        if (g.root.parent) g.root.parent.remove(g.root);
        this.active.delete(g);
        this.pool.push(g);
        this._behindTimers.delete(g);
        this._protectUntil.delete(g);
      }
    }
  }

  _despawnImmediate(g){
    if (g.root.parent) g.root.parent.remove(g.root);
    g.deactivate();
    this.active.delete(g);
    this.pool.push(g);
    this._behindTimers.delete(g);
    this._protectUntil.delete(g);
  }
  _despawnCleanse(g){
    if (g.state !== 'cleansing') g.cleanse(); // recycle avverrà quando diventa inactive
    this._behindTimers.delete(g);
    this._protectUntil.delete(g);
  }

  _getForwardXZ(){
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    const len = this._forward.length();
    if (len < 1e-5) { this._forward.set(0,0,-1); }
    else { this._forward.multiplyScalar(1/len); }
    // right = +90°
    this._right.set(this._forward.z, 0, -this._forward.x);
  }

  _cullByDistanceAndBehind(dt){
    const pCam = this.camera.position;
    this._getForwardXZ();

    // frustum per gating "dietro"
    this._proj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._proj);

    const farCull = this.params.farCull;
    const behDist = this.params.despawnBehindDist;
    const behTime = this.params.behindTime;
    const minBehindRange = this.params.minBehindRange;

    for (const g of Array.from(this.active)) {
      const gx = g.root.position.x, gz = g.root.position.z;
      const dx = gx - pCam.x, dz = gz - pCam.z;
      const dist = Math.hypot(dx, dz);

      // (0) skip culling "dietro" appena spawnato
      const until = this._protectUntil.get(g) ?? 0;
      const inProtect = (this._time < until);

      // (1) troppo lontano (sempre attivo)
      if (dist > farCull) {
        (this.params.despawnStyle === 'cleanse') ? this._despawnCleanse(g) : this._despawnImmediate(g);
        continue;
      }

      // (2) dietro rispetto al forward della camera
      //     - richiede anche che NON sia nel frustum (evita popping mentre lo guardi)
      //     - non contarla mentre il ghost sta prendendo colpi (exposure>0.05)
      //     - non aplicararla se in protezione spawn
      const exposure = +g.exposure || 0;
      if (!inProtect && exposure <= 0.05) {
        const s = this._forward.x * dx + this._forward.z * dz; // proiezione firmata
        const onScreen = this._frustum.containsPoint(g.root.position);
        if (s < -behDist && dist > minBehindRange && !onScreen) {
          const t = (this._behindTimers.get(g) || 0) + dt;
          this._behindTimers.set(g, t);
          if (t >= behTime) {
            (this.params.despawnStyle === 'cleanse') ? this._despawnCleanse(g) : this._despawnImmediate(g);
            continue;
          }
        } else {
          // reset timer se non è più dietro/sufficientemente distante o visibile
          if (this._behindTimers.has(g)) this._behindTimers.set(g, 0);
        }
      } else {
        // in protezione o colpito: non accumulare dietro
        if (this._behindTimers.has(g)) this._behindTimers.set(g, 0);
      }
    }
  }

  _getFromPool(){ return this.pool.pop() || null; }

  _trySpawnOne(){
    if (this.pool.length === 0) return false;
    if (typeof this.getFocusPos !== 'function') return false;

    const focus = this.getFocusPos();
    if (!focus) return false;

    // base per settori
    this._getForwardXZ();

    const tries = this.params.maxTriesPerTick;
    for (let i = 0; i < tries; i++) {
      const cand = this._sampleCandidate(focus);
      if (!cand) continue;
      if (this._rejectByRules(cand, focus)) continue;

      const g = this._getFromPool();
      if (!g) return false;
      g.setPosition(cand.x, cand.y, cand.z).addTo(this.scene);
      g.appear();
      this.active.add(g);
      // finestra di protezione anti-despawn/anti-pop
      this._protectUntil.set(g, this._time + (this.params.protectSeconds || 0));
      return true;
    }
    return false;
  }

  _sampleCandidate(focus){
    const { minR, maxR, spawnMode, sectorHalfAngleDeg } = this.params;

    const dir2D = this._pickDirection2D(spawnMode);
    const half = THREE.MathUtils.degToRad(sectorHalfAngleDeg);
    const jitter = (rand01() * 2 - 1) * half;

    const cosJ = Math.cos(jitter), sinJ = Math.sin(jitter);
    const rx = dir2D.x * cosJ - dir2D.z * sinJ;
    const rz = dir2D.x * sinJ + dir2D.z * cosJ;

    const r2min = minR * minR;
    const r2max = maxR * maxR;
    const r = Math.sqrt( r2min + (r2max - r2min) * rand01() );

    const x = focus.x + rx * r;
    const z = focus.z + rz * r;
    const y = this.getGroundY(x,z) + 1.4; // leggermente sollevato

    return new THREE.Vector3(x, y, z);
  }

  _pickDirection2D(mode){
    const F = this._forward;
    const R = this._right;
    const B = new THREE.Vector3(-F.x, 0, -F.z);
    const L = new THREE.Vector3(-R.x, 0, -R.z);

    switch (mode) {
      case 'front':  return F.clone();
      case 'behind': return B.clone();
      case 'left':   return L.clone();
      case 'right':  return R.clone();
      case 'none':
      default: {
        if (mode !== 'mix') {
          const ang = Math.random() * Math.PI * 2;
          return new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
        }
        const w = this.params.mixWeights || {};
        const wf = Math.max(0, +w.front  || 0);
        const wb = Math.max(0, +w.behind || 0);
        const wl = Math.max(0, +w.left   || 0);
        const wr = Math.max(0, +w.right  || 0);
        const sum = wf+wb+wl+wr || 1;
        let u = Math.random() * sum;
        if ((u -= wf) < 0) return F.clone();
        if ((u -= wb) < 0) return B.clone();
        if ((u -= wl) < 0) return L.clone();
        return R.clone();
      }
    }
  }

  _rejectByRules(p, focus){
    const { minPlayerDist, minSeparation, antiPopIn } = this.params;

    if (Math.hypot(p.x - focus.x, p.z - focus.z) < minPlayerDist) return true;

    for (const g of this.active) {
      const gx = g.root.position.x, gz = g.root.position.z;
      if (Math.hypot(p.x - gx, p.z - gz) < minSeparation) return true;
    }

    if (antiPopIn) {
      this._proj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._proj);
      if (this._frustum.containsPoint(p)) return true;
    }

    return false;
  }
}
