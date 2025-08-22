// src/systems/BeamSystem.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class BeamSystem {
  constructor(opts = {}) {
    this.scene     = opts.scene;
    this.camera    = opts.camera;
    this.obstacles = opts.obstacles || [];

    this.enabled    = true;
    this.firing     = false;
    this.overheated = false;
    this.heat       = 0;

    this.halfAngleDeg = opts.halfAngleDeg ?? 15;
    this.maxRange     = opts.maxRange     ?? 22;
    this.exposureRate = opts.exposureRate ?? 1.2;
    this.heatRise     = opts.heatRise     ?? 0.8;
    this.heatFall     = opts.heatFall     ?? 0.7;
    this.overheatHi   = opts.overheatHi   ?? 1.0;
    this.overheatLo   = opts.overheatLo   ?? 0.6;

    this._cosHalf = Math.cos(THREE.MathUtils.degToRad(this.halfAngleDeg));
    this._ray     = new THREE.Raycaster();
    this._tmpV    = new THREE.Vector3();
    this._fwd     = new THREE.Vector3();
    this._upNeg   = new THREE.Vector3(0, -1, 0);

    this.hitsThisFrame = 0;

    this._buildVisual();
  }

  setFiring(v) { this.firing = !!v && !this.overheated; }
  setHalfAngleDeg(a) {
    this.halfAngleDeg = THREE.MathUtils.clamp(a, 2, 45);
    this._cosHalf = Math.cos(THREE.MathUtils.degToRad(this.halfAngleDeg));
  }
  setMaxRange(r) { this.maxRange = Math.max(2, r); }
  setObstacles(list) { this.obstacles = list || []; }

  update(dt, ghostsIterable) {
    this._updateHeat(dt);

    let visualLen = this.maxRange;
    this.hitsThisFrame = 0;

    if (this.enabled && this.firing && !this.overheated && ghostsIterable) {
      const camPos = this.camera.position;
      const fwd = this._fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();

      for (const g of ghostsIterable) {
        if (!g || !g.root || g.state !== 'active') continue;

        const aim = this._tmpV.copy(g.root.position);
        aim.y += 1.0;

        const to = this._tmpV.clone().subVectors(aim, camPos);
        const dist = to.length();
        if (dist > this.maxRange || dist < 1e-3) continue;

        to.multiplyScalar(1 / dist);
        const cosAng = to.dot(fwd);
        if (cosAng < this._cosHalf) continue;

        if (!this._hasLOS(camPos, aim, dist)) continue;

        const wAngle = (cosAng - this._cosHalf) / (1 - this._cosHalf);
        const wDist  = 1 - (dist / this.maxRange);
        const weight = THREE.MathUtils.clamp(0.5 * wAngle + 0.5 * wDist, 0, 1);

        const cleansed = g.applyExposure(this.exposureRate * weight * dt);
        if (cleansed) this.hitsThisFrame++;

        if (dist < visualLen) visualLen = dist;
      }
    }

    this._updateVisual(visualLen);
  }

  _buildVisual() {
    // Cono orientato lungo -Y (apice a y=0), così poi ruoto -Y → forward
    const geo = new THREE.ConeGeometry(1, 1, 36, 1, true);
    geo.translate(0, -0.5, 0);

    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff2b3,
      transparent: true,
      opacity: 0.28,             // un po’ più visibile
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,                 // niente fog sul cono
      toneMapped: false           // niente tone mapping
    });

    this.cone = new THREE.Mesh(geo, mat);
    this.cone.visible = false;
    this.cone.renderOrder = 900;
    this.cone.frustumCulled = false; // evita culling aggressivo
    this.scene.add(this.cone);
  }

  _updateHeat(dt) {
    const wanting = this.firing && !this.overheated;
    this.heat = THREE.MathUtils.clamp(this.heat + (wanting ? this.heatRise : -this.heatFall) * dt, 0, 1);

    if (!this.overheated && this.heat >= this.overheatHi) this.overheated = true;
    if (this.overheated && this.heat <= this.overheatLo) this.overheated = false;
    if (this.overheated) this.firing = false;
  }

  _updateVisual(length) {
    if (!this.cone) return;
    const show = this.firing && !this.overheated;
    this.cone.visible = show;
    if (!show) return;

    const camPos = this.camera.position;
    const fwd = this._fwd.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();

    const len = THREE.MathUtils.clamp(length, 0.5, this.maxRange);
    const radius = Math.tan(THREE.MathUtils.degToRad(this.halfAngleDeg)) * len;

    // Sposta l’apice un pelo davanti alla camera per evitare near clipping
    const eps = Math.max(0.05, Math.min(0.25, 0.02 * len));
    this.cone.position.set(
      camPos.x + fwd.x * eps,
      camPos.y + fwd.y * eps,
      camPos.z + fwd.z * eps
    );

    // Ruota -Y → fwd
    this.cone.quaternion.setFromUnitVectors(this._upNeg, fwd);
    this.cone.scale.set(radius, len, radius);
    this.cone.updateMatrixWorld(true);
  }

  _hasLOS(camPos, aim, dist) {
    if (!this.obstacles || this.obstacles.length === 0) return true;
    this._ray.set(camPos, this._tmpV.copy(aim).sub(camPos).normalize());
    this._ray.far = dist;
    const hit = this._ray.intersectObjects(this.obstacles, true);
    return hit.length === 0;
  }
}
