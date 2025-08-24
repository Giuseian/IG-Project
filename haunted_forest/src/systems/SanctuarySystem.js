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
   *         items:[{x,z,radius,holdSeconds,targetHeight}], decayRate, targetHeight, entryPad, onPurified }
   */
  constructor(opts = {}) {
    this.scene       = opts.scene;
    this.camera      = opts.camera;
    this.beamSystem  = opts.beamSystem;
    this.spawner     = opts.spawner;
    this.modelUrl    = opts.modelUrl;
    this.itemsDef    = opts.items || [];
    this.decayRate   = opts.decayRate ?? 0.25;
    this.targetHeight= opts.targetHeight ?? 200.5; // cm
    this.entryPad    = opts.entryPad ?? 8.0;
    this.onPurified  = typeof opts.onPurified === 'function' ? opts.onPurified : null;

    this._ray        = new THREE.Raycaster();
    this._tmpV       = new THREE.Vector3();
    this._apex       = new THREE.Vector3();
    this._beamDir    = new THREE.Vector3();

    this._fbx        = null;
    this._sanct      = [];
    this._doneCount  = 0;

    // tempo per effetti (pulse)
    this._time       = 0;

    // palette
    this._colIdle    = new THREE.Color(0x64a6ff); // blu
    this._colArmed   = new THREE.Color(0xff5a5a); // rosso
    this._colYellow  = new THREE.Color(0xffe066); // giallo (inizio purify)
    this._colDone    = new THREE.Color(0x39ff95); // verde (target purify + done)

    this._purifyingCount = 0; // per safe time
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

      // modello totem
      const model = this._fbx.clone(true);
      const finalH = fitObjectToHeight(model, def.targetHeight ?? this.targetHeight);
      root.add(model);

      // ring a terra (fog OFF per visibilità)
      const rOuter = (def.radius != null) ? def.radius : 100;
      const rInner = Math.max(0.6 * rOuter, rOuter - 8.0);
      const ringGeo = new THREE.RingGeometry(rInner, rOuter, 64);
      ringGeo.rotateX(-Math.PI/2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: this._colIdle.clone(),
        transparent: true, opacity: 0.25, depthWrite: false
      });
      ringMat.fog = false; // NON subisce fog
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.02;
      root.add(ring);

      // outline interno (leggero contrasto)
      const outlineGeo = new THREE.RingGeometry(rInner * 0.92, rInner * 0.98, 64);
      outlineGeo.rotateX(-Math.PI/2);
      const outlineMat = new THREE.MeshBasicMaterial({
        color: 0x0a0f14, transparent: true, opacity: 0.25, depthWrite:false
      });
      outlineMat.fog = false;
      const ringOutline = new THREE.Mesh(outlineGeo, outlineMat);
      ringOutline.position.y = 0.018;
      root.add(ringOutline);

      // glow esterno additivo (sottilissimo)
      const glowGeo = new THREE.RingGeometry(rOuter * 1.00, rOuter * 1.05, 64);
      glowGeo.rotateX(-Math.PI/2);
      const glowMat = new THREE.MeshBasicMaterial({
        color: this._colIdle.clone(),
        transparent: true, opacity: 0.10,
        blending: THREE.AdditiveBlending, depthWrite:false
      });
      glowMat.fog = false;
      const ringGlow = new THREE.Mesh(glowGeo, glowMat);
      ringGlow.position.y = 0.021;
      root.add(ringGlow);

        // beacon: colonna additiva che PARTE dalla testa del totem (più stretta)
        const hBeacon = Math.max(6, finalH * 2.8);
        const rBottom = Math.max(0.6, rOuter * 0.12); // ↓ più sottile
        const rTop    = Math.max(0.3, rOuter * 0.04); // ↓ più sottile
        const beaconGeo = new THREE.CylinderGeometry(rTop, rBottom, hBeacon, 24, 1, true);
        const beaconMat = new THREE.MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
        });
        beaconMat.fog = false;
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);

        // **attacco alla testa**: centro geometria a metà, quindi alzo di (finalH + hBeacon*0.5)
        beacon.position.y = finalH + hBeacon * 0.5;

        root.add(beacon);


      // luce puntiforme soft
      const light = new THREE.PointLight(0x66ffcc, 0.0, rOuter * 6, 2.0);
      light.position.set(0, Math.max(1.0, finalH * 1.2), 0);
      root.add(light);

      this._sanct.push({
        def, root, model, ring, ringOutline, ringGlow, beacon, light,
        modelHeight: finalH,
        aimYOffset: finalH * 0.85, // mira verso la testa
        charge: 0,
        holdSeconds: def.holdSeconds ?? 3.0,
        radius: rOuter,
        state: 'idle',
        _spawnTick: 0
      });
    }
  }

  /** helper: gradiente giallo → verde (t in [0..1]) */
  _purifyColor(out, t){
    out.copy(this._colYellow).lerp(this._colDone, THREE.MathUtils.clamp(t,0,1));
    return out;
  }

  update(dt, ctx = {}){
    if (!this.beamSystem || this._sanct.length === 0) return;

    this._time += dt;

    const beam = this.beamSystem;
    const cosHalf = Math.cos(THREE.MathUtils.degToRad(beam.halfAngleDeg));
    beam.getBeamApex?.(this._apex);
    beam.getBeamForward?.(this._beamDir);

    const obstacles = beam.obstacles || [];
    const maxRange  = beam.maxRange || 9999;

    const inOverheat = !!ctx.overheated;
    const beamOn     = !!ctx.beamOn;

    let purifyingNow = 0;

    for (let i=0; i<this._sanct.length; i++){
      const s = this._sanct[i];

      if (s.state === 'done') { this._applyVisual(s, 1.0, 'done'); continue; }

      // 1) dentro il cerchio (con padding)
      const dx = ctx.playerPos.x - s.root.position.x;
      const dz = ctx.playerPos.z - s.root.position.z;
      const rad = s.radius + this.entryPad;
      const inCircle = (dx*dx + dz*dz) <= (rad*rad);

      // 2) totem nel cono + LOS
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

      const canPoint  = inCircle && inCone && losOK;
      const canCharge = canPoint && beamOn && !inOverheat;

      if (canCharge) {
        s.state  = 'purifying';
        s.charge = Math.min(s.holdSeconds, s.charge + dt);
        s._spawnTick += dt;
        purifyingNow++;
      } else {
        // niente più "blocked": se non puoi caricare, resti in "armed" quando sei nel cerchio
        s.state  = inCircle ? 'armed' : 'idle';
        s.charge = Math.max(0, s.charge - this.decayRate * dt);
        s._spawnTick = 0;
      }

      const t = THREE.MathUtils.clamp(s.charge / s.holdSeconds, 0, 1);
      this._applyVisual(s, t, s.state);

      if (t >= 1 && s.state !== 'done') {
        s.state = 'done';
        this._applyVisual(s, 1, 'done');
        if (++this._doneCount && this.onPurified) this.onPurified(i, this._doneCount, this._sanct.length);
      }
    }

    // SAFE TIME: pausa aggro se stai purificando
    if (this._purifyingCount !== purifyingNow) {
      this._purifyingCount = purifyingNow;
      if (this.spawner?.pauseAggro) {
        this.spawner.pauseAggro(this._purifyingCount > 0);
      }
    }
  }

  _applyVisual(s, t, mode){
    // NOTE: fog OFF già sul ring/beacon
    const ringMat   = s.ring.material;
    const beaconMat = s.beacon.material;
    const glowMat   = s.ringGlow.material;

    switch(mode){
      case 'idle': {
        ringMat.color.copy(this._colIdle);
        ringMat.opacity = 0.25;
        glowMat.color.copy(this._colIdle);
        glowMat.opacity = 0.10;

        beaconMat.color.copy(this._colIdle);
        beaconMat.opacity = 0.06;

        this._setModelEmissive(s.model, new THREE.Color(0x000000), 0.0);
        s.light.intensity = 0.0;
      } break;

      case 'armed': {
        // nel cerchio ma NON stai caricando → rosso pieno
        ringMat.color.copy(this._colArmed);
        ringMat.opacity = 0.28;
        glowMat.color.copy(this._colArmed);
        glowMat.opacity = 0.12;

        beaconMat.color.copy(this._colArmed);
        beaconMat.opacity = 0.10;

        this._setModelEmissive(s.model, this._colArmed, 0.25);
        s.light.intensity = 0.4;
      } break;

      case 'purifying': {
        // gradiente giallo → verde in base a t
        const c = new THREE.Color();
        this._purifyColor(c, t);

        ringMat.color.copy(c);
        ringMat.opacity = 0.28 + 0.27 * t;
        glowMat.color.copy(c);
        glowMat.opacity = 0.14 + 0.18 * t;

        beaconMat.color.copy(c);
        beaconMat.opacity = 0.10 + 0.32 * t;

        this._setModelEmissive(s.model, c, 0.5 + 1.2 * t);
        s.light.intensity = 1.0 + 1.4 * t;
      } break;

      case 'done':
      default: {
        ringMat.color.copy(this._colDone);
        ringMat.opacity = 0.45;
        glowMat.color.copy(this._colDone);
        glowMat.opacity = 0.22;

        beaconMat.color.copy(this._colDone);
        beaconMat.opacity = 0.50;

        this._setModelEmissive(s.model, this._colDone, 1.9);
        s.light.intensity = 1.9;
      } break;
    }

    ringMat.needsUpdate   = true;
    beaconMat.needsUpdate = true;
    glowMat.needsUpdate   = true;
  }

  _setModelEmissive(model, color, intensity){
    model.traverse(o=>{
      if (o.isMesh && o.material && 'emissive' in o.material) {
        o.material.emissive.copy(color);
        o.material.emissiveIntensity = intensity;
        o.material.needsUpdate = true;
      }
    });
  }

  /** Ritorna info sul santuario più vicino: { state, t, dist } */
  getNearestInfo(playerPos){
    if (!this._sanct.length) return null;
    let best=null, bestD=Infinity;
    for (const s of this._sanct){
      const dx = playerPos.x - s.root.position.x;
      const dz = playerPos.z - s.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD){ best = s; bestD = d; }
    }
    if (!best) return null;
    const t = THREE.MathUtils.clamp(best.charge / best.holdSeconds, 0, 1);
    return { state: best.state, t, dist: bestD, radius: best.radius };
  }

  /** True se almeno un santuario è in purifying (=> aggro pausa) */
  isPurifySafe(){ return this._purifyingCount > 0; }
}
