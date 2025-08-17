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
 *     { name: 'oak',  url: '/assets/trees/oak.obj',  occluderHeight: 160, occluderRadiusScale: 0.45 },
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
    this.meshes = [];   // InstancedMesh per material & type
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
  _generatePoints(targetCount) {
    const pts = [];
    const { innerRadius, outerRadius, minSpacing, maxSpacing } = this.cfg;
    const maxTries = targetCount * 30;

    for (let tries = 0; pts.length < targetCount && tries < maxTries; tries++) {
      // sample in ring with uniform density
      const a = this.rng() * Math.PI * 2;
      const r = Math.sqrt(this.rng()) * (outerRadius - innerRadius) + innerRadius;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;

      if (this._inClearings(x, z)) continue;

      // spacing vary slightly for natural look
      const spacing = randRange(this.rng, minSpacing, maxSpacing);

      // check neighbors via spatial hash
      let ok = true;
      for (const idx of this.spatial.queryNeighbors(x, z)) {
        const p = this.spatial.points[idx];
        if (!p) continue;
        if (Math.hypot(x - p.x, z - p.z) < spacing) { ok = false; break; }
      }
      if (!ok) continue;

      this.spatial.add(x, z);
      pts.push({ x, z });
    }
    return pts;
  }

  async generate() {
    await this.loadTypes();

    // 1) Choose a type for each instance (weighted evenly here)
    const pts = this._generatePoints(this.cfg.count);

    // Prepare one InstancedMesh per (type × material)
    const buckets = []; // { typeIdx, matIdx, geometry, material, mesh, transforms: [] }
    for (let ti = 0; ti < this.typeProtos.length; ti++) {
      const { proto } = this.typeProtos[ti];
      for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
        const { geometry, material } = proto.geometriesByMaterial[mi];
        buckets.push({ typeIdx: ti, matIdx: mi, geometry, material, transforms: [] });
      }
    }

    // 2) Assign points to random type, create transforms & occluders
    const sMin = this.cfg.scale[0], sMax = this.cfg.scale[1];

    for (const p of pts) {
      const ti = Math.floor(this.rng() * this.typeProtos.length);
      const { proto, cfg } = this.typeProtos[ti];

      const rotY = this.rng() * Math.PI * 2;
      const s = randRange(this.rng, sMin, sMax);

      // One transform per material bucket of this type (so the full tree renders correctly)
      for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
        const bucket = buckets.find(b => b.typeIdx === ti && b.matIdx === mi);
        const m = new THREE.Matrix4()
          .makeRotationY(rotY)
          .premultiply(new THREE.Matrix4().makeScale(s, s, s))
          .premultiply(new THREE.Matrix4().makeTranslation(p.x, 0, p.z));
        bucket.transforms.push(m);
      }

      // Occluder (cylinder) – approximate trunk/canopy
      const radius = (this.typeProtos[ti].proto.baseRadius * (this.typeProtos[ti].cfg.occluderRadiusScale || 0.4)) * s;
      const height = (this.typeProtos[ti].cfg.occluderHeight || 120) * s;
      this.occluders.push({ pos: new THREE.Vector3(p.x, 0, p.z), radius, height });
    }

    // 3) Build InstancedMeshes from buckets
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