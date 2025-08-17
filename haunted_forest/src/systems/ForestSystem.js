// src/systems/ForestSystem.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { createRNG, randRange } from '../utils/rng.js';
import { SpatialHash } from '../utils/spatialHash.js';

/**
 * ForestSystem – populate a ring with instanced OBJ trees.
 *
 * Config example:
 * {
 *   seed: 1337,
 *   innerRadius: 80,
 *   outerRadius: 1800,
 *   minSpacing: 8,
 *   maxSpacing: 12,
 *   count: 800,
 *   scale: [0.85, 1.25],
 *   clearings: [ { x:0, z:0, r: 100 } ],
 *   types: [
 *     { name: 'pine', url: '/assets/trees/pine.obj', occluderHeight: 140, occluderRadiusScale: 0.4 },
 *   ]
 * }
 */
export class ForestSystem {
  constructor(scene, config, treeCatalog) {
    this.scene = scene;
    this.cfg = Object.assign({
      seed: 1234,
      innerRadius: 60,
      outerRadius: 1500,
      minSpacing: 8,
      maxSpacing: 12,
      count: 600,
      scale: [0.9, 1.2],
      clearings: [],
      types: [],
      castShadow: true,
      receiveShadow: true,
    }, config);

    this.rng = createRNG(this.cfg.seed);
    this.catalog = treeCatalog;
    this.spatial = new SpatialHash(this.cfg.maxSpacing);
    this.meshes = [];    // InstancedMesh per material & type
    this.occluders = []; // {pos:THREE.Vector3, radius, height}
  }

  async loadTypes() {
    this.typeProtos = [];
    for (const t of this.cfg.types) {
      const proto = await this.catalog.load(t.name, t.url, t.options || {});
      this.typeProtos.push({ cfg: t, proto });
    }
  }

  // Returns true if (x,z) lies in any clearing exclusion zone
  _inClearings(x, z) {
    for (const c of this.cfg.clearings) {
      const dx = x - (c.x || 0);
      const dz = z - (c.z || 0);
      if (Math.hypot(dx, dz) < (c.r || 0)) return true;
    }
    return false;
  }

  // Place points via random+rejection (blue-noise-ish)
  // UPDATED: aggiunto parametro sizePad che incrementa la distanza minima
  _generatePoints(targetCount, sizePad = 0) {
    const pts = [];
    const { innerRadius, outerRadius, minSpacing, maxSpacing } = this.cfg;
    const maxTries = targetCount * 30;

    for (let tries = 0; pts.length < targetCount && tries < maxTries; tries++) {
      // sample in ring con densità uniforme
      const a = this.rng() * Math.PI * 2;
      const r = Math.sqrt(this.rng()) * (outerRadius - innerRadius) + innerRadius;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;

      if (this._inClearings(x, z)) continue;

      // distanza minima “intelligente”: spacing base + pad legato alla taglia del modello
      const spacing = randRange(this.rng, minSpacing, maxSpacing);
      const minDist = spacing + sizePad;

      // check vicini via spatial hash
      let ok = true;
      for (const idx of this.spatial.queryNeighbors(x, z)) {
        const p = this.spatial.points[idx];
        if (!p) continue;
        if (Math.hypot(x - p.x, z - p.z) < minDist) { ok = false; break; }
      }
      if (!ok) continue;

      this.spatial.add(x, z);
      pts.push({ x, z });
    }
    return pts;
  }

  async generate() {
    await this.loadTypes();

    // ===== UPDATED: calcolo sizePad in base al baseRadius del pino =====
    // (versione semplice: assumiamo 1 solo tipo: 'pine' come primo in lista)
    // Se in futuro aggiungi altri tipi, passeremo alla versione "per-istanza".
    const sMin = this.cfg.scale[0], sMax = this.cfg.scale[1];
    const sMed = 0.5 * (sMin + sMax);
    const firstType = this.typeProtos[0];
    const baseRadius = firstType?.proto?.baseRadius || 0;
    const radiusScale = firstType?.cfg?.occluderRadiusScale ?? 0.4;
    // x2 per passare da raggio a diametro, così il pad rappresenta la “larghezza media” della chioma
    const sizePad = baseRadius * radiusScale * sMed * 2.0;

    // Importante: rendiamo il cellSize dello SpatialHash coerente con la nuova soglia
    this.spatial = new SpatialHash(this.cfg.maxSpacing + sizePad);

    // Genera i punti con pad “intelligente”
    const pts = this._generatePoints(this.cfg.count, sizePad);

    // ===== Prepara un InstancedMesh per (type × material) =====
    const buckets = []; // { typeIdx, matIdx, geometry, material, mesh, transforms: [] }
    for (let ti = 0; ti < this.typeProtos.length; ti++) {
      const { proto } = this.typeProtos[ti];
      for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
        const { geometry, material } = proto.geometriesByMaterial[mi];
        buckets.push({ typeIdx: ti, matIdx: mi, geometry, material, transforms: [] });
      }
    }

    // ===== Assegna punti a un tipo random, crea transform & occluder =====
    for (const p of pts) {
      const ti = Math.floor(this.rng() * this.typeProtos.length);
      const { proto, cfg } = this.typeProtos[ti];

      const rotY = this.rng() * Math.PI * 2;
      const s = randRange(this.rng, sMin, sMax);

      for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
        const bucket = buckets.find(b => b.typeIdx === ti && b.matIdx === mi);
        const m = new THREE.Matrix4()
          .makeRotationY(rotY)
          .premultiply(new THREE.Matrix4().makeScale(s, s, s))
          .premultiply(new THREE.Matrix4().makeTranslation(p.x, 0, p.z));
        bucket.transforms.push(m);
      }

      // Occluder (cilindro) – approssima tronco/chioma
      const radius = (proto.baseRadius * (cfg.occluderRadiusScale || 0.4)) * s;
      const height = (cfg.occluderHeight || 120) * s;
      this.occluders.push({ pos: new THREE.Vector3(p.x, 0, p.z), radius, height });
    }

    // ===== Costruisci gli InstancedMesh =====
    const tmp = new THREE.Object3D();
    for (const b of buckets) {
      const count = b.transforms.length;
      if (count === 0) continue;
      const mesh = new THREE.InstancedMesh(b.geometry, b.material, count);
      mesh.castShadow = this.cfg.castShadow;
      mesh.receiveShadow = this.cfg.receiveShadow;

      for (let i = 0; i < count; i++) {
        tmp.matrix.copy(b.transforms[i]);
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      this.scene.add(mesh);
      this.meshes.push(mesh);
    }

    return { count: pts.length, occluders: this.occluders };
  }

  dispose() {
    for (const m of this.meshes) {
      this.scene.remove(m);
      m.geometry?.dispose?.();
      if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose()); else m.material?.dispose?.();
    }
    this.meshes.length = 0;
    this.occluders.length = 0;
    this.spatial = new SpatialHash(this.cfg.maxSpacing);
  }
}



// // MULTIPLE INSTANCES - PINE AND OAK
// src/systems/ForestSystem.js
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
// import { createRNG, randRange } from '../utils/rng.js';
// import { SpatialHash } from '../utils/spatialHash.js';

// /**
//  * ForestSystem – populate a ring with instanced OBJ trees (multi-tipo, raggio variabile).
//  *
//  * Config:
//  * {
//  *   seed: 1337,
//  *   innerRadius: 80, outerRadius: 1800,
//  *   minSpacing: 8, maxSpacing: 12,
//  *   count: 800,
//  *   scale: [0.85, 1.25],
//  *   clearings: [ { x:0, z:0, r: 100 } ],
//  *   types: [
//  *     { name:'pine', url:'/assets/trees/pine.obj', occluderHeight:140, occluderRadiusScale:0.42 },
//  *     // { name:'oak',  url:'/assets/trees/oak.obj',  occluderHeight:160, occluderRadiusScale:0.45 },
//  *   ],
//  *   castShadow:true, receiveShadow:true
//  * }
//  */
// export class ForestSystem {
//   constructor(scene, config, treeCatalog) {
//     this.scene = scene;
//     this.cfg = Object.assign({
//       seed: 1234,
//       innerRadius: 60,
//       outerRadius: 1500,
//       minSpacing: 8,
//       maxSpacing: 12,
//       count: 600,
//       scale: [0.9, 1.2],
//       clearings: [],
//       types: [],
//       castShadow: true,
//       receiveShadow: true,
//     }, config);

//     this.rng = createRNG(this.cfg.seed);
//     this.catalog = treeCatalog;
//     this.meshes = [];    // InstancedMesh per (type × material)
//     this.occluders = []; // {pos:THREE.Vector3, radius, height}
//     this.spatial = new SpatialHash(this.cfg.maxSpacing); // verrà ricalibrato dopo il load
//   }

//   async loadTypes() {
//     this.typeProtos = [];
//     for (const t of this.cfg.types) {
//       const proto = await this.catalog.load(t.name, t.url, t.options || {});
//       this.typeProtos.push({ cfg: t, proto });
//     }
//   }

//   _inClearings(x, z) {
//     for (const c of this.cfg.clearings) {
//       const dx = x - (c.x || 0);
//       const dz = z - (c.z || 0);
//       if (Math.hypot(dx, dz) < (c.r || 0)) return true;
//     }
//     return false;
//   }

//   async generate() {
//     await this.loadTypes();

//     // ==== 1) Calibra il cellSize del SpatialHash per i raggi massimi possibili ====
//     const sMax = this.cfg.scale[1];
//     let maxEffRadius = 0;
//     for (const { cfg, proto } of this.typeProtos) {
//       const eff = (proto.baseRadius || 0) * (cfg.occluderRadiusScale ?? 0.4) * sMax;
//       if (eff > maxEffRadius) maxEffRadius = eff;
//     }
//     // Ogni punto salverà rad = rEff + 0.5*extraSpacing. Quindi rad_max ≈ maxEffRadius + 0.5*maxSpacing.
//     const cellSize = maxEffRadius + 0.5 * this.cfg.maxSpacing + this.cfg.maxSpacing; // un po' di margine
//     this.spatial = new SpatialHash(cellSize);

//     // ==== 2) Sampling con raggio variabile per istanza ====
//     const { innerRadius, outerRadius, minSpacing, maxSpacing, count } = this.cfg;
//     const sMin = this.cfg.scale[0];
//     const triesMax = count * 40;

//     const instances = []; // {x,z, ti, s, rotY, rEff, rad}

//     for (let tries = 0; instances.length < count && tries < triesMax; tries++) {
//       // posizione nel ring (densità uniforme)
//       const a = this.rng() * Math.PI * 2;
//       const r = Math.sqrt(this.rng()) * (outerRadius - innerRadius) + innerRadius;
//       const x = Math.cos(a) * r;
//       const z = Math.sin(a) * r;

//       if (this._inClearings(x, z)) continue;

//       // scegli tipo, scala, rotazione
//       const ti = Math.floor(this.rng() * this.typeProtos.length);
//       const { proto, cfg } = this.typeProtos[ti];
//       const s = randRange(this.rng, sMin, sMax);
//       const rotY = this.rng() * Math.PI * 2;

//       // rEff = raggio fisico (occluder/chIoma) per questo tipo e scala
//       const rEff = (proto.baseRadius || 0) * (cfg.occluderRadiusScale ?? 0.4) * s;

//       // extraSpacing random → rad variabile. Rad = rEff + 0.5*extraSpacing
//       const extra = randRange(this.rng, minSpacing, maxSpacing);
//       const rad = rEff + 0.5 * extra;

//       // collisione variabile: dist >= rad(candidate) + rad(neighbor)
//       let ok = true;
//       for (const idx of this.spatial.queryNeighbors(x, z)) {
//         const q = this.spatial.points[idx]; // {x,z,rad}
//         if (!q) continue;
//         if (Math.hypot(x - q.x, z - q.z) < (rad + q.rad)) { ok = false; break; }
//       }
//       if (!ok) continue;

//       // accetta
//       const idx = this.spatial.add(x, z, { rad });
//       instances.push({ x, z, ti, s, rotY, rEff, rad, idx });
//     }

//     // ==== 3) Prepara i bucket per InstancedMesh (type × material) ====
//     const buckets = []; // { typeIdx, matIdx, geometry, material, transforms: [] }
//     for (let ti = 0; ti < this.typeProtos.length; ti++) {
//       const { proto } = this.typeProtos[ti];
//       for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
//         const { geometry, material } = proto.geometriesByMaterial[mi];
//         buckets.push({ typeIdx: ti, matIdx: mi, geometry, material, transforms: [] });
//       }
//     }

//     // ==== 4) Riempie i bucket con le trasformazioni, crea occluder ====
//     for (const inst of instances) {
//       const { ti, s, rotY, x, z } = inst;
//       const { proto, cfg } = this.typeProtos[ti];

//       for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
//         const bucket = buckets.find(b => b.typeIdx === ti && b.matIdx === mi);
//         const m = new THREE.Matrix4()
//           .makeRotationY(rotY)
//           .premultiply(new THREE.Matrix4().makeScale(s, s, s))
//           .premultiply(new THREE.Matrix4().makeTranslation(x, 0, z));
//         bucket.transforms.push(m);
//       }

//       const radius = inst.rEff;                         // per occluder usiamo il raggio fisico
//       const height = (cfg.occluderHeight || 120) * s;   // altezza proporzionale alla scala
//       this.occluders.push({ pos: new THREE.Vector3(x, 0, z), radius, height });
//     }

//     // ==== 5) Costruisci gli InstancedMesh ====
//     const tmp = new THREE.Object3D();
//     for (const b of buckets) {
//       const count = b.transforms.length;
//       if (count === 0) continue;
//       const mesh = new THREE.InstancedMesh(b.geometry, b.material, count);
//       mesh.castShadow = this.cfg.castShadow;
//       mesh.receiveShadow = this.cfg.receiveShadow;

//       for (let i = 0; i < count; i++) {
//         tmp.matrix.copy(b.transforms[i]);
//         mesh.setMatrixAt(i, tmp.matrix);
//       }
//       mesh.instanceMatrix.needsUpdate = true;

//       this.scene.add(mesh);
//       this.meshes.push(mesh);
//     }

//     return { count: instances.length, occluders: this.occluders };
//   }

//   dispose() {
//     for (const m of this.meshes) {
//       this.scene.remove(m);
//       m.geometry?.dispose?.();
//       if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose()); else m.material?.dispose?.();
//     }
//     this.meshes.length = 0;
//     this.occluders.length = 0;
//     this.spatial = new SpatialHash(this.cfg.maxSpacing);
//   }
// }
