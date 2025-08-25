// src/entities/Ghost.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { patchGhostMaterial } from '../entities/dissolvePatch.js';

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
        emissiveIntensity: 0.40,
        depthWrite: false,
        depthTest: true,
        vertexColors: !!geom.attributes.color,
      });
      patchGhostMaterial(mat);
      return mat;
    }
  });

  mesh.material = Array.isArray(src) ? newMats : newMats[0];
  return newMats;
}

const _wRoot  = new THREE.Vector3();
const _wModel = new THREE.Vector3();
const _dir    = new THREE.Vector3();
const _right  = new THREE.Vector3();
const _tmpV   = new THREE.Vector3();
const _tmpV2  = new THREE.Vector3();

export class Ghost {
  constructor(opts = {}) {
    this.url           = opts.url ?? '/assets/models/ghost/ghost.glb';
    this.targetHeight  = opts.targetHeight ?? 2.2;
    this.scaleJitter   = opts.scaleJitter ?? 0.28;
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

    this.idle = {
      baseY: 0.45,
      phase: Math.random() * Math.PI * 2,
      ampBob: 0.06,
      omegaBob: 1.2,
      swayAmpX: THREE.MathUtils.degToRad(4),
      swayAmpZ: THREE.MathUtils.degToRad(4),
      swayOmega: 1.05,
      clampGround: true,
      minY: 0.35,
      maxY: 0.60,
    };

    // movimento
    this.vel = new THREE.Vector3(0,0,0);
    this.yaw = 0;
    this.params = {
      appearDuration:   1.0,
      cleanseDuration:  0.8,
      speed:            opts.speed ?? 6.0,
      burstMultiplier:  opts.burstMultiplier ?? 1.6,
      yawRateDeg:       opts.yawRateDeg ?? 720,
      keepDistance:     opts.keepDistance ?? 0.0,
      arriveRadius:     opts.arriveRadius ?? 1.2,
      exposureFalloff:  0.6,
      hardLockDist:     opts.hardLockDist ?? 60
    };
    this.swoop = {
      far:   opts.swoop?.far   ?? 120,
      near:  opts.swoop?.near  ?? 55,
      hLow:  opts.swoop?.hLow  ?? 1.6,
      hHigh: opts.swoop?.hHigh ?? 7.2,
      yLerp: opts.swoop?.yLerp ?? 3.2
    };

    // offset modello & snap iniziale
    this.yawModelOffsetDeg = opts.yawModelOffsetDeg ?? 0;
    this.yawModelOffset    = THREE.MathUtils.degToRad(this.yawModelOffsetDeg);
    this.alignSnapWindow   = opts.alignSnapWindow ?? 0.15;
    this._alignSnapT       = 0;

    // >>> SERPENTINA REALE SULLA TRAIETTORIA
    this.weave = {
      enabled:  opts.weave?.enabled ?? true,
      amp:      opts.weave?.amp ?? 0.35,
      omega:    opts.weave?.omega ?? 1.2,
      fadeNear: opts.weave?.fadeNear ?? 10,
      fadeFar:  opts.weave?.fadeFar  ?? 80,
      phase:    Math.random() * Math.PI * 2,
    };
    this._weavePrev = new THREE.Vector3(0,0,0);

    this.state    = 'inactive';
    this.tState   = 0;
    this.exposure = 0;

    // pacificazione
    this._pacified = false;
    this._pacifyZone = null; // { center: Vector3, radius: number }
    this._keepDistanceBase = null;
    this._speedBase = null;

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

    this._ensureHierarchy();
    this._zeroLocalOffsetsXZ();

    if (this.yawModelOffset) this.model.rotation.y += this.yawModelOffset;

    this._setThreshold(0.98);
    this.setVisible(false);
    return this;
  }

  addTo(parent) { parent.add(this.root); return this; }
  setPosition(x, y, z) { this.root.position.set(x, y, z); return this; }
  getPosition(out = new THREE.Vector3()) { return out.copy(this.root.position); }
  setVisible(v) { this.root.visible = !!v; return this; }
  setIdleParams(partial = {}) { Object.assign(this.idle, partial); return this; }

  resetKinematics(){
    this.vel.set(0,0,0);
    this._alignSnapT = 0;
    this._weavePrev.set(0,0,0);
    return this;
  }

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

  /** Pacifica il ghost quando il player è in un totem (armed/purifying) */
  setPacified(flag, zone = null) {
    const want = !!flag;
    const changed = (want !== this._pacified) ||
                    (want && (zone?.radius !== this._pacifyZone?.radius ||
                              !zone?.center?.equals?.(this._pacifyZone?.center)));

    if (!changed) return this;

    this._pacified = want;
    if (this._pacified) {
      // salva base
      if (this._keepDistanceBase == null) this._keepDistanceBase = this.params.keepDistance;
      if (this._speedBase == null)        this._speedBase = this.params.speed;

      // zona pacifica (fallback se non fornita)
      if (zone && zone.center && isFinite(+zone.radius) && +zone.radius > 0) {
        this._pacifyZone = { center: zone.center.clone?.() ?? new THREE.Vector3(zone.center.x, zone.center.y||0, zone.center.z),
                             radius: +zone.radius };
      } else {
        this._pacifyZone = null;
      }

      // distanza minima dal player (fallback) ~ raggio ring tipico
      const fallbackKeep = 100;

      // imposta keepDistance elevato per evitare avvicinamento al player
      const perimeter = this._pacifyZone ? this._pacifyZone.radius + 6.0 : fallbackKeep;
      this.params.keepDistance = Math.max(this._keepDistanceBase ?? 0, perimeter);

      // rallenta un po'
      this.params.speed = Math.min(this._speedBase, this._speedBase * 0.6);
    } else {
      // ripristina parametri
      this._pacifyZone = null;
      if (this._keepDistanceBase != null) this.params.keepDistance = this._keepDistanceBase;
      if (this._speedBase != null)        this.params.speed        = this._speedBase;
    }
    return this;
  }

  update(dt) {
    this._time += dt;

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

    // sicurezza gerarchia
    if (this.model && this.root.parent) {
      this.root.getWorldPosition(_wRoot);
      this.model.getWorldPosition(_wModel);
      const dx = Math.abs(_wModel.x - _wRoot.x);
      const dz = Math.abs(_wModel.z - _wRoot.z);
      if (dx > 0.02 || dz > 0.02) {
        this._ensureHierarchy();
        this._zeroLocalOffsetsXZ();
      }
    }
  }

  /* =================== internals =================== */
  _enter(next) {
    this.state = next;
    this.tState = 0;

    if (next === 'inactive') {
      this.setVisible(false);
      this.exposure = 0;
      this._setThreshold(0.98);
    }

    if (next === 'appearing'){
      this.setVisible(true);
      this.exposure = 0;
      this._setThreshold(0.98);

      const gx = this.root.position.x;
      const gz = this.root.position.z;
      const gy = this.getGroundY(gx, gz);
      const jitter = 1.0 + Math.random()*1.4;
      const yCanopy = gy + this.swoop.hHigh + jitter;
      if (!isNaN(yCanopy)) this.root.position.y = Math.max(this.root.position.y, yCanopy);

      const target = (typeof this.getTargetPos === 'function') ? this.getTargetPos() : null;
      if (target) {
        this._alignInstant(target);
        this._alignSnapT = this.alignSnapWindow;
      }
      this._weavePrev.set(0,0,0);
    }

    if (next === 'active') {
      this.setVisible(true);
      this._setThreshold(0.25);
      const target = (typeof this.getTargetPos === 'function') ? this.getTargetPos() : null;
      if (target) {
        this._alignInstant(target);
        this._alignSnapT = Math.max(this._alignSnapT, this.alignSnapWindow * 0.5);
      }
      this._weavePrev.set(0,0,0);
    }
    return this;
  }

  _alignInstant(target){
    _dir.subVectors(target, this.root.position);
    _dir.y = 0;
    const len = _dir.length();
    if (len < 1e-6) {
      _dir.set(0,0,1);
    } else {
      _dir.multiplyScalar(1/len);
    }
    this.vel.copy(_dir);
    this.yaw = Math.atan2(_dir.x, _dir.z);
    this.rig.rotation.y = this.yaw;
  }

  _updateAppearing(dt) {
    const d = this.params.appearDuration || 1.0;
    const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
    const k = t * t * (3 - 2 * t);
    const thr = THREE.MathUtils.lerp(0.98, 0.25, k);
    this._setThreshold(thr);
    if (t >= 1 || thr <= 0.26) this.activate();
  }

  _updateActive(dt) {
    if (this.exposure > 0) this.applyExposure(-this.params.exposureFalloff * dt);

    // >>>> BARRIERA SAFE-ZONE: push fuori dal ring se pacificato
    if (this._pacified && this._pacifyZone) {
      const cx = this._pacifyZone.center.x, cz = this._pacifyZone.center.z;
      const dx = this.root.position.x - cx;
      const dz = this.root.position.z - cz;
      const r  = Math.hypot(dx, dz);
      const minR = (this._pacifyZone.radius || 0) + 2.0; // margine visivo
      if (r < Math.max(0.01, minR)) {
        const nx = dx / (r || 1e-6), nz = dz / (r || 1e-6);
        const push = (minR - r);
        this.root.position.x += nx * push;
        this.root.position.z += nz * push;
      }
    }

    if (typeof this.getTargetPos !== 'function') return;
    const target = this.getTargetPos();
    if (!target) return;

    // direzione verso il target (XZ)
    _dir.subVectors(target, this.root.position);
    _dir.y = 0;
    const dist = _dir.length();
    if (!isFinite(dist) || dist < 1e-6) return;
    _dir.multiplyScalar(1 / dist);

    const yawRate = THREE.MathUtils.degToRad(this.params.yawRateDeg || 720);
    let kTurn = Math.min(1, yawRate * dt);

    if (this._alignSnapT > 0) {
      this.vel.copy(_dir);
      const yawTarget = Math.atan2(_dir.x, _dir.z);
      this.yaw = yawTarget;
      this.rig.rotation.y = this.yaw;
      this._alignSnapT -= dt;
    } else {
      if (dist >= this.params.hardLockDist) {
        this.vel.copy(_dir);
      } else {
        if (this.vel.lengthSq() < 1e-6) {
          this.vel.copy(_dir);
        } else {
          const cur = _tmpV.copy(this.vel).normalize();
          const cosA = THREE.MathUtils.clamp(cur.dot(_dir), -1, 1);
          const ang = Math.acos(cosA);
          if (ang > THREE.MathUtils.degToRad(35)) kTurn = Math.min(1, kTurn * 3.5);
          cur.lerp(_dir, kTurn).normalize();
          this.vel.copy(cur);
        }
      }

      if (this.vel.lengthSq() > 1e-6) {
        const yawTarget = Math.atan2(this.vel.x, this.vel.z);
        let dy = yawTarget - this.yaw;
        while (dy >  Math.PI) dy -= 2*Math.PI;
        while (dy < -Math.PI) dy += 2*Math.PI;
        this.yaw += dy * Math.min(1, yawRate * dt);
        this.rig.rotation.y = this.yaw;
      }
    }

    // velocità (burst se lontano) — quando pacificato lo speed è già ridotto
    let spd = this.params.speed;
    if (dist > this.swoop.far) spd *= this.params.burstMultiplier;

    const stop    = Math.max(0, this.params.keepDistance || 0);
    const arriveR = Math.max(1e-3, this.params.arriveRadius || 0.03);
    const desired = Math.max(0, dist - stop);

    if (desired <= arriveR) {
      this.root.position.x = target.x - _dir.x * stop;
      this.root.position.z = target.z - _dir.z * stop;
    } else {
      const step = spd * dt;
      this.root.position.x += this.vel.x * step;
      this.root.position.z += this.vel.z * step;
    }

    // >>> SERPENTINA
    if (this.weave.enabled) {
      if (this.vel.lengthSq() > 1e-6) _right.set(this.vel.z, 0, -this.vel.x).normalize();
      else                             _right.set(_dir.z, 0, -_dir.x).normalize();

      const kDist = THREE.MathUtils.clamp(
        (dist - this.weave.fadeNear) / Math.max(1e-3, (this.weave.fadeFar - this.weave.fadeNear)), 0, 1
      );
      const kNear = THREE.MathUtils.clamp(desired / (arriveR * 1.5), 0, 1);

      const A = this.weave.amp * kDist * kNear;
      const s = Math.sin(this.weave.omega * this._time + this.weave.phase);

      const off = _tmpV.copy(_right).multiplyScalar(A * s);
      const delta = _tmpV2.copy(off).sub(this._weavePrev);
      this.root.position.add(delta);
      this._weavePrev.copy(off);
    }

    // quota: alto quando lontano, poi scende (swoop)
    const gy = this.getGroundY(this.root.position.x, this.root.position.z);
    const yHigh = gy + this.swoop.hHigh;
    const yLow  = gy + this.swoop.hLow;
    const yTarget = (dist > this.swoop.far) ? yHigh
                  : (dist <= this.swoop.near ? yLow
                                             : THREE.MathUtils.lerp(yHigh, yLow, (this.swoop.far - dist)/(this.swoop.far - this.swoop.near)));
    const yK = Math.min(1, this.swoop.yLerp * dt);
    this.root.position.y = THREE.MathUtils.lerp(this.root.position.y, yTarget, yK);
  }

  _updateCleansing(dt) {
    const d = this.params.cleanseDuration || 0.8;
    const t = THREE.MathUtils.clamp(this.tState / d, 0, 1);
    const k = t * t * (3 - 2 * t);
    const start = Math.max(0.25, this._getThreshold());
    const thr = THREE.MathUtils.lerp(start, 0.98, k);
    this._setThreshold(thr);
    if (t >= 1 || thr >= 0.97) this.deactivate();
  }

  _updateIdle(dt) {
    const t = this._time, ph = this.idle.phase;

    // bobbing
    let y = this.idle.baseY + this.idle.ampBob * Math.sin(this.idle.omegaBob * t + ph);

    // clamp terreno in locale
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

    // sway (pitch/roll leggeri)
    const rx = this.idle.swayAmpX * Math.sin(this.idle.swayOmega * t + ph * 0.7);
    const rz = this.idle.swayAmpZ * Math.sin(this.idle.swayOmega * t + ph * 0.9);
    this.rig.rotation.x = rx;
    this.rig.rotation.z = rz;
  }

  _setThreshold(v) { for (const s of this.uniformSets) if (s?.uThreshold) s.uThreshold.value = v; }
  _getThreshold()  { for (const s of this.uniformSets) if (s?.uThreshold) return s.uThreshold.value; return 0.98; }

  _normalize() {
    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    this.model.position.x -= center.x;
    this.model.position.z -= center.z;
    this.model.position.y -= box.min.y;

    const jitter = 1 + (Math.random()*2 - 1) * this.scaleJitter;
    const s = (this.targetHeight * jitter / (size.y || 1.0));
    this.model.scale.setScalar(s);

    const box2 = new THREE.Box3().setFromObject(this.model);
    this.model.position.y -= box2.min.y;
  }

  _applyMaterials() {
    const meshes = [];
    this.model.traverse((o) => { if (o.isMesh) meshes.push(o); });
    for (const o of meshes) {
      const mats = buildGhostMaterialsForMesh(o, this.opacityBody);
      const arr = Array.isArray(mats) ? mats : [mats];
      this.materials.push(...arr);
      for (const m of arr) {
        const u = m?.userData?._ghostUniforms;
        if (u) this.uniformSets.push(u);
      }
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 10;
    }
  }

  _ensureHierarchy() {
    if (this.model.parent !== this.rig) this.rig.add(this.model);
    if (this.rig.parent !== this.root) this.root.add(this.rig);
    this.model.updateMatrixWorld(true);
    this.rig.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
  }

  _zeroLocalOffsetsXZ() {
    this.rig.position.x = 0;   this.rig.position.z = 0;
    this.model.position.x = 0; this.model.position.z = 0;
  }

  setDebugMode(mode = 0) {
    for (const s of this.uniformSets) {
      if (s?.uDebugMode) s.uDebugMode.value = mode | 0;
    }
    return this;
  }
}

