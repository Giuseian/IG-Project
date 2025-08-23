// src/systems/WASDController.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/**
 * WASDController – movimento kinematic su XZ con clamp Y = ground + eyeHeight.
 * Non tocca lo sguardo: lasciamo OrbitControls per la rotazione.
 * Muove SIA camera.position SIA controls.target dello stesso delta.
 */
export class WASDController {
  constructor({
    camera,
    controls,
    getGroundY = () => 0.0,
    eyeHeight = 20,
    speed = 50,                 // m/s
    sprintMultiplier = 1.6,     // Shift = sprint
    accel = 12,                 // reattività verso la velocità target
    friction = 6,               // smorzamento quando non premi
    bounds = null               // {minX, maxX, minZ, maxZ}
  } = {}) {
    this.camera = camera;
    this.controls = controls;
    this.getGroundY = getGroundY;
    this.eyeHeight = eyeHeight;

    this.params = { speed, sprintMultiplier, accel, friction, bounds };

    this.pos = camera.position.clone();
    this.vel = new THREE.Vector3();    // solo XZ

    this.keys = new Set();
    this.enabled = true;

    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();

    this._onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (['w','a','s','d','shift'].includes(k)) e.preventDefault();
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
    };

    addEventListener('keydown', this._onKeyDown);
    addEventListener('keyup', this._onKeyUp);
  }

  dispose(){
    removeEventListener('keydown', this._onKeyDown);
    removeEventListener('keyup', this._onKeyUp);
  }

  setEnabled(v){ this.enabled = !!v; }

  /** Forward XZ normalizzato (utile a chi lo vuole leggere). */
  getForward(out = new THREE.Vector3()){
    out.copy(this._fwd);
    return out;
  }
  /** Velocità orizzontale corrente (m/s). */
  getSpeed(){
    return Math.hypot(this.vel.x, this.vel.z);
  }

  update(dt){
    if (!this.enabled) return;

    // Direzioni locali alla camera su XZ
    this.camera.getWorldDirection(this._fwd);
    this._fwd.y = 0;
    const len = this._fwd.length();
    if (len < 1e-5) this._fwd.set(0,0,-1); else this._fwd.multiplyScalar(1/len);
    this._right.set(this._fwd.z, 0, -this._fwd.x);

    // Input
    let ix = 0, iz = 0;
    if (this.keys.has('w')) iz += 1;
    if (this.keys.has('s')) iz -= 1;
    if (this.keys.has('d')) ix += 1;
    if (this.keys.has('a')) ix -= 1;

    const moving = (ix !== 0 || iz !== 0);
    const maxSpeed = this.params.speed * (this.keys.has('shift') ? this.params.sprintMultiplier : 1);

    // Direzione desiderata normalizzata su XZ
    const desired = new THREE.Vector3();
    if (moving) {
      desired
        .addScaledVector(this._fwd, iz)
        .addScaledVector(this._right, ix);
      const L = desired.length();
      if (L > 1e-6) desired.multiplyScalar(maxSpeed / L);
    }

    // Accelerazione verso la velocità desiderata (solo XZ)
    const k = Math.min(1, this.params.accel * dt);
    this.vel.x += (desired.x - this.vel.x) * k;
    this.vel.z += (desired.z - this.vel.z) * k;

    // Friction quando non c'è input
    if (!moving) {
      const damp = Math.exp(-this.params.friction * dt);
      this.vel.x *= damp; this.vel.z *= damp;
      if (this.vel.lengthSq() < 1e-6) this.vel.set(0,0,0);
    }

    // Integrazione + clamp
    const dx = this.vel.x * dt;
    const dz = this.vel.z * dt;
    if (dx || dz){
      this.pos.x += dx; this.pos.z += dz;

      const b = this.params.bounds;
      if (b){
        this.pos.x = Math.max(b.minX, Math.min(b.maxX, this.pos.x));
        this.pos.z = Math.max(b.minZ, Math.min(b.maxZ, this.pos.z));
      }

      // Clamp Y al terreno + altezza occhi
      const gy = this.getGroundY(this.pos.x, this.pos.z);
      this.pos.y = gy + this.eyeHeight;

      // Applica alla camera + sposta il target di OrbitControls dello stesso delta (dolly)
      this.camera.position.copy(this.pos);
      if (this.controls) this.controls.target.add(new THREE.Vector3(dx, 0, dz));
    } else {
      // Aggiorna solo la Y se fermi
      const gy = this.getGroundY(this.pos.x, this.pos.z);
      this.pos.y = gy + this.eyeHeight;
      this.camera.position.y = this.pos.y;
    }
  }
}
