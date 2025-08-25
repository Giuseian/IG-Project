import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { Ghost } from '../entities/Ghost.js';

const rand01 = ()=>Math.random();
const randInt = (a,b)=> (a + Math.floor(Math.random() * (b - a + 1)));

export class GhostSpawner {
  constructor(opts = {}) {
    // External deps
    this.scene       = opts.scene;
    this.camera      = opts.camera;
    this.getGroundY  = opts.getGroundY || (() => 0);
    this.getFocusPos = opts.getFocusPos || null;

    // callbacks
    this.onGhostCleansed = typeof opts.onGhostCleansed === 'function' ? opts.onGhostCleansed : null;

    // Pool / Active
    this.pool   = [];
    this.active = new Set();

    // Parameters (defaults)
    this.params = {
      // pool/spawn
      poolSize:      opts.poolSize      ?? 24,
      maxAlive:      opts.maxAlive      ?? 12,
      spawnInterval: opts.spawnInterval ?? 0.4,
      minR:          opts.minR          ?? 6.0,
      maxR:          opts.maxR          ?? 14.0,
      minPlayerDist: opts.minPlayerDist ?? 5.0,
      minSeparation: opts.minSeparation ?? 2.0,
      maxTriesPerTick: opts.maxTriesPerTick ?? 12,

      // visibility rule
      antiPopIn:     opts.antiPopIn ?? false,

      // sector-based spawn control
      spawnMode:          opts.spawnMode ?? 'mix',
      sectorHalfAngleDeg: opts.sectorHalfAngleDeg ?? 60,
      mixWeights: {
        front:  (opts.mixWeights?.front  ?? 0.25),
        behind: (opts.mixWeights?.behind ?? 0.5),
        left:   (opts.mixWeights?.left   ?? 0.125),
        right:  (opts.mixWeights?.right  ?? 0.125),
      },

      // DESPAWN / CULLING
      farCull:            opts.farCull            ?? ((opts.maxR ?? 14) * 2),
      despawnBehindDist:  opts.despawnBehindDist  ?? 60,
      minBehindRange:     opts.minBehindRange     ?? 30,
      behindTime:         opts.behindTime         ?? 1.25,
      protectSeconds:     opts.protectSeconds     ?? 0.75,
      despawnStyle:       opts.despawnStyle       ?? 'deactivate',

      // WAVE by distance
      wave: {
        byDistance: opts.wave?.byDistance ?? true,
        meters:     opts.wave?.meters     ?? 70,
        countMin:   opts.wave?.countMin   ?? 2,
        countMax:   opts.wave?.countMax   ?? 3,
        minInterval:opts.wave?.minInterval?? 2.5,
        jitter:     opts.wave?.jitter     ?? 1.0,
      },

      // Ghost defaults
      ghostOpts:          opts.ghostOpts ?? {},
    };

    // State
    this.spawnCooldown = this.params.spawnInterval;
    this._time = 0;

    // wave state
    this._lastCamPos   = this.camera?.position?.clone() ?? new THREE.Vector3();
    this._distAccum    = 0;
    this._waveCooldown = 0;

    // scratch
    this._frustum = new THREE.Frustum();
    this._proj    = new THREE.Matrix4();
    this._forward = new THREE.Vector3();
    this._right   = new THREE.Vector3();

    // timers "dietro" + protezione spawn
    this._behindTimers = new Map();
    this._protectUntil = new Map();

    // Aggro pause (purifying)
    this._pauseAggro = false;

    // DEFENSE HOTSPOT
    this._defense = null;
    this._capBoost = 0;
    this._boostActive = false;

    // GUARD MODE params
    this.guard = {
      orbitSpeed: 0.7,
      orbitRadiusMul: 0.65,
      chasePlayerWithinTotem: 0.6,
      chasePlayerNearGhost: 180,
    };

    // prev state tracking per eventi
    this._prevState = new Map();
  }

  async init() {
    for (let i = 0; i < this.params.poolSize; i++) {
      const g = new Ghost({
        ...this.params.ghostOpts,
        getGroundY:  this.getGroundY,
        getTargetPos: () => this.camera?.position?.clone?.() ?? null,
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

  pauseAggro(flag){ this._pauseAggro = !!flag; }
  isAggroPaused(){ return !!this._pauseAggro; }

  // reset completo (per Retry/Replay)
  reset(){
    // despawn immediato di tutti gli active
    for (const g of Array.from(this.active)) this._despawnImmediate(g);
    this.active.clear();

    // timers & stati
    this.spawnCooldown = this.params.spawnInterval;
    this._time = 0;
    this._distAccum = 0;
    this._waveCooldown = 0;

    this._behindTimers.clear();
    this._protectUntil.clear();
    this._prevState.clear();

    this._defense = null;
    this._capBoost = 0;
    this._boostActive = false;

    this._pauseAggro = false;
  }

  // === DEFENSE HOTSPOT API ===
  setDefenseHotspot({ pos, radius = 700, capBoost = 2, spawnIntervalMul = 0.6 } = {}){
    if (!pos) { this._defense = null; return; }
    this._defense = {
      pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y||0, pos.z),
      radius: Math.max(1, +radius || 1),
      capBoost: Math.max(0, capBoost|0),
      spawnIntervalMul: Math.max(0.1, Math.min(1, +spawnIntervalMul || 1))
    };
  }
  clearDefenseHotspot(){ this._defense = null; }

  forceSpawnNow(){ this.spawnCooldown = 0; this._trySpawnOne(); }
  forceWave(n = 2){
    const want = Math.max(1, n|0);
    for (let i=0; i<want; i++){
      if (this.active.size >= this._getMaxAlive()) break;
      if (!this._trySpawnOne()) break;
    }
    this._distAccum = 0;
    this._waveCooldown = this.params.wave.minInterval;
  }

  fillToCap(){
    let guard = 32;
    while (this.active.size < this._getMaxAlive() && guard-- > 0) {
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
      maxAlive: this._getMaxAlive(),
      pool:     this.pool.length,
      nextIn:   Math.max(0, this.spawnCooldown),
      mode:     this.params.spawnMode,
      antiPopIn:this.params.antiPopIn,
      aggroPaused: this._pauseAggro,
      defenseActive: !!this._boostActive,
    };
  }

  // --- Main tick ---
  update(dt) {
    this._time += dt;

    // distanza XZ per ondata
    const cp = this.camera.position;
    this._distAccum += Math.hypot(cp.x - this._lastCamPos.x, cp.z - this._lastCamPos.z);
    this._lastCamPos.copy(cp);
    this._waveCooldown -= dt;

    // recycle
    this._recycleInactive();

    // culling
    this._cullByDistanceAndBehind(dt);

    // hotspot attivo?
    const def = this._defense;
    const inDefense = !!(def && !this._pauseAggro &&
      Math.hypot(cp.x - def.pos.x, cp.z - def.pos.z) <= def.radius);
    this._capBoost    = inDefense ? (def.capBoost|0) : 0;
    this._boostActive = inDefense;

    // se l’hotspot si spegne, i ghost tornano a targettare il player
    if (!this._boostActive) {
      for (const g of this.active) {
        if (g._guardMode) {
          g.getTargetPos = () => this.camera.position.clone();
          g._guardMode = false;
          delete g._guardPhase; delete g._guardCenter;
          g._chasing = false;
          g.params.speed = g._baseSpeed ?? g.params.speed;
          g.params.burstMultiplier = g._baseBurst ?? g.params.burstMultiplier;
        }
      }
    }

    // spawn
    if (!this._pauseAggro) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0 && this.active.size < this._getMaxAlive()) {
        const spawned = this._trySpawnOne();
        const base = this.params.spawnInterval;
        const mul  = (inDefense ? (def?.spawnIntervalMul ?? 1) : 1);
        this.spawnCooldown = spawned ? (base * mul) : Math.max(0.5, base * 0.25);
      }
    } else {
      this.spawnCooldown = Math.max(this.spawnCooldown, this.params.spawnInterval * 0.75);
    }

    // wave
    const w = this.params.wave;
    if (!this._pauseAggro && w.byDistance && this._waveCooldown <= 0 && this._distAccum >= w.meters) {
      const want = randInt(w.countMin, w.countMax);
      for (let i=0; i<want; i++) {
        if (this.active.size >= this._getMaxAlive()) break;
        if (!this._trySpawnOne()) break;
      }
      this._distAccum = 0;
      this._waveCooldown = Math.max(0.5, w.minInterval + (Math.random()*2 - 1) * w.jitter);
    }

    // advance ghosts + eventi
    for (const g of this.active) {
      if (this._pauseAggro && typeof g.setPacified === 'function') g.setPacified(true);
      if (!this._pauseAggro && typeof g.setPacified === 'function') g.setPacified(false);
      g.update?.(dt);

      const prev = this._prevState.get(g) ?? g.state;
      if (prev !== g.state) {
        if (g.state === 'cleansing' && this.onGhostCleansed) this.onGhostCleansed(g);
        this._prevState.set(g, g.state);
      }
    }
  }

  // --- Internals ---
  _getMaxAlive(){ return this.params.maxAlive + (this._capBoost|0); }

  _recycleInactive(){
    for (const g of Array.from(this.active)) {
      if (g.state === 'inactive') {
        if (g.root.parent) g.root.parent.remove(g.root);
        this.active.delete(g);
        this.pool.push(g);
        this._behindTimers.delete(g);
        this._protectUntil.delete(g);
        this._prevState.delete(g);
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
    this._prevState.delete(g);
  }
  _despawnCleanse(g){
    if (g.state !== 'cleansing') g.cleanse();
    this._behindTimers.delete(g);
    this._protectUntil.delete(g);
  }

  _getForwardXZ(){
    this.camera.getWorldDirection(this._forward);
    this._forward.y = 0;
    const len = this._forward.length();
    if (len < 1e-5) { this._forward.set(0,0,-1); }
    else { this._forward.multiplyScalar(1/len); }
    this._right.set(this._forward.z, 0, -this._forward.x);
  }

  _cullByDistanceAndBehind(dt){
    const pCam = this.camera.position;
    this._getForwardXZ();

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

      const until = this._protectUntil.get(g) ?? 0;
      const inProtect = (this._time < until);

      if (dist > farCull) {
        (this.params.despawnStyle === 'cleanse') ? this._despawnCleanse(g) : this._despawnImmediate(g);
        continue;
      }

      const exposure = +g.exposure || 0;
      if (!inProtect && exposure <= 0.05) {
        const s = this._forward.x * dx + this._forward.z * dz;
        const onScreen = this._frustum.containsPoint(g.root.position);
        if (s < -behDist && dist > minBehindRange && !onScreen) {
          const t = (this._behindTimers.get(g) || 0) + dt;
          this._behindTimers.set(g, t);
          if (t >= behTime) {
            (this.params.despawnStyle === 'cleanse') ? this._despawnCleanse(g) : this._despawnImmediate(g);
            continue;
          }
        } else {
          if (this._behindTimers.has(g)) this._behindTimers.set(g, 0);
        }
      } else {
        if (this._behindTimers.has(g)) this._behindTimers.set(g, 0);
      }
    }
  }

  _getFromPool(){ return this.pool.pop() || null; }

  _trySpawnOne(){
    if (this.pool.length === 0) return false;
    if (this._pauseAggro) return false;

    // centro di spawn: totem se boost attivo, altrimenti player
    const focus = this.camera?.position;
    const center = (this._boostActive && this._defense?.pos) ? this._defense.pos : focus;
    if (!center) return false;

    this._getForwardXZ();

    const tries = this.params.maxTriesPerTick;
    for (let i = 0; i < tries; i++) {
      const cand = this._sampleCandidate(center);
      if (!cand) continue;
      if (this._rejectByRules(cand, focus)) continue;

      const g = this._getFromPool();
      if (!g) return false;

      g.resetKinematics?.();

      g.setPosition(cand.x, cand.y, cand.z).addTo(this.scene);
      g.appear();

      // GUARD MODE quando difendo un totem
      if (this._boostActive && this._defense?.pos) {
        const def = this._defense;
        const orbitR = THREE.MathUtils.lerp(this.params.minR, this.params.maxR, this.guard.orbitRadiusMul);
        g._guardPhase  = Math.random() * Math.PI * 2;
        g._guardCenter = def.pos.clone();
        g._guardMode   = true;

        g._chasing = false;
        g._chaseBoostUntil = 0;
        g._baseSpeed = g.params.speed;
        g._baseBurst = g.params.burstMultiplier;
        g._boostSpeed = g._baseSpeed * 1.25;
        g._boostBurst = g._baseBurst * 1.15;
        g._boostDuration = 2.0;

        g.getTargetPos = () => {
          const cam = this.camera.position;
          const gx = g.root.position.x, gz = g.root.position.z;

          const distPlayerTotem = Math.hypot(cam.x - def.pos.x, cam.z - def.pos.z);
          const distPlayerGhost = Math.hypot(cam.x - gx,      cam.z - gz);

          const seesPlayerNearTotem =
            distPlayerTotem <= def.radius * this.guard.chasePlayerWithinTotem;

          const seesPlayerNearGhost =
            distPlayerGhost <= this.guard.chasePlayerNearGhost;

          if (!this._pauseAggro && (seesPlayerNearTotem || seesPlayerNearGhost)) {
            if (!g._chasing) {
              g._chasing = true;
              g.params.speed = g._boostSpeed;
              g.params.burstMultiplier = g._boostBurst;
              g._chaseBoostUntil = performance.now() * 0.001 + g._boostDuration;
            }
            if (g._chasing && performance.now() * 0.001 > g._chaseBoostUntil) {
              g.params.speed = g._baseSpeed;
              g.params.burstMultiplier = g._baseBurst;
            }
            return cam.clone();
          }

          // orbita il totem
          const t = (performance.now() * 0.001) + g._guardPhase;
          const x = def.pos.x + Math.cos(t * this.guard.orbitSpeed) * orbitR;
          const z = def.pos.z + Math.sin(t * this.guard.orbitSpeed) * orbitR;
          const y = this.getGroundY(x, z) + 2.0;
          return new THREE.Vector3(x, y, z);
        };
      } else {
        // comportamento standard: inseguono il player
        g.getTargetPos = () => this.camera.position.clone();
        g._guardMode = false;
      }

      this.active.add(g);
      this._prevState.set(g, g.state);
      this._protectUntil.set(g, this._time + (this.params.protectSeconds || 0));
      return true;
    }
    return false;
  }

  _sampleCandidate(center){
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

    const x = center.x + rx * r;
    const z = center.z + rz * r;
    const y = this.getGroundY(x,z) + 1.4;

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

    const cam = this.camera?.position || focus;
    if (!cam) return true;

    // mai troppo vicino al player
    if (Math.hypot(p.x - cam.x, p.z - cam.z) < minPlayerDist) return true;

    for (const g of this.active) {
      const gx = g.root.position.x, gz = g.root.position.z;
      if (Math.hypot(p.x - gx, p.z - gz) < minSeparation) return true;
    }

    if (antiPopIn) {
      this._proj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
      this._frustum.setFromProjectionMatrix(this._proj);
      const onScreen = this._frustum.containsPoint(p);
      const distCam = Math.hypot(p.x - cam.x, p.z - cam.z);
      if (onScreen && distCam < (this.params.minR * 0.85)) return true;
    }

    return false;
  }
}
