// src/systems/TileForestManager.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { createRNG, randRange } from '../utils/rng.js';
import { SpatialHash } from '../utils/spatialHash.js';

/**
 * TileForestManager
 * - Stream di patch di foresta su griglia di tile quadrati.
 * - Deterministico per tile: seed = hash(globalSeed, tx, tz).
 * - Solo pini (o quello che passi in cfg.types) – uguale schema a ForestSystem.
 *
 * cfg:
 *  {
 *    seed: 2025,
 *    tileSize: 200,        // lato del tile
 *    tilesRadius: 4,       // quanti tile attorno al player (raggio in tile)
 *    minSpacing: 10,
 *    maxSpacing: 14,
 *    scale: [0.9, 1.25],
 *    types: [ { name:'pine', url:'/assets/trees/pine.obj', options:{...}, occluderHeight:140, occluderRadiusScale:0.42 } ],
 *    castShadow: true,
 *    receiveShadow: true,
 *    onTileSpawn?: (tile)=>void, // callback opzionale (es. attach fog ai nuovi materiali)
 *  }
 */
export class TileForestManager {
  constructor(scene, catalog, cfg) {
    this.scene = scene;
    this.catalog = catalog;
    this.cfg = Object.assign({
      seed: 1234,
      tileSize: 200,
      tilesRadius: 4,
      minSpacing: 8,
      maxSpacing: 12,
      scale: [0.9, 1.2],
      types: [],
      castShadow: true,
      receiveShadow: true,
      onTileSpawn: null,
    }, cfg);

    this._loaded = new Map(); // key "tx, tz" -> { meshes[], occluders[], tx, tz }
    this._typeProtos = [];
    this._basePad = 0;        // pad dimensionale (dipende dal modello)
  }

  // hash semplice e stabile per (seed, tx, tz)
  _seedForTile(tx, tz) {
    let h = (this.cfg.seed >>> 0);
    h ^= Math.imul(0x9E3779B1, tx|0);
    h ^= Math.imul(0x85EBCA77, tz|0);
    h ^= h >>> 16;
    return h >>> 0;
  }

  async init() {
    this._typeProtos.length = 0;
    for (const t of this.cfg.types) {
      const proto = await this.catalog.load(t.name, t.url, t.options || {});
      this._typeProtos.push({ cfg: t, proto });
    }

    // calcola un pad dimensionale (diametro medio della chioma) per lo spacing
    const sMin = this.cfg.scale[0], sMax = this.cfg.scale[1];
    const sMed = 0.5 * (sMin + sMax);
    const first = this._typeProtos[0];
    const baseRadius = first?.proto?.baseRadius || 0;
    const radiusScale = first?.cfg?.occluderRadiusScale ?? 0.4;
    this._basePad = baseRadius * radiusScale * sMed * 2.0; // r→diametro
  }

  // update attiva/disattiva tile attorno al player
  async update(playerPos) {
    if (!this._typeProtos.length) await this.init();

    const ts = this.cfg.tileSize;
    const r  = this.cfg.tilesRadius;
    const tx = Math.floor(playerPos.x / ts);
    const tz = Math.floor(playerPos.z / ts);

    // set desiderato
    const wanted = new Set();
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const k = `${tx+dx},${tz+dz}`;
        wanted.add(k);
        if (!this._loaded.has(k)) {
          await this._spawnTile(tx+dx, tz+dz);
        }
      }
    }

    // scarica quelli fuori raggio
    for (const k of Array.from(this._loaded.keys())) {
      if (!wanted.has(k)) this._disposeTileKey(k);
    }
  }

  get activeTileCount() { return this._loaded.size; }

  _tileRect(tx, tz) {
    const ts = this.cfg.tileSize;
    const minX = tx * ts, minZ = tz * ts;
    return { minX, minZ, maxX: minX + ts, maxZ: minZ + ts, centerX: minX + ts*0.5, centerZ: minZ + ts*0.5 };
  }

  async _spawnTile(tx, tz) {
    const key = `${tx},${tz}`;
    if (this._loaded.has(key)) return;

    const rect = this._tileRect(tx, tz);
    const seed = this._seedForTile(tx, tz);
    const rng  = createRNG(seed);

    // ---- genera punti blue-noise nel rettangolo del tile
    const pts = this._generatePointsRect(rng, rect, this._basePad);

    // ---- costruisci InstancedMesh come in ForestSystem
    const buckets = [];
    for (let ti = 0; ti < this._typeProtos.length; ti++) {
      const { proto } = this._typeProtos[ti];
      for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
        const { geometry, material } = proto.geometriesByMaterial[mi];
        buckets.push({ typeIdx: ti, matIdx: mi, geometry, material, transforms: [] });
      }
    }

    const sMin = this.cfg.scale[0], sMax = this.cfg.scale[1];
    const occluders = [];

    for (const p of pts) {
      const ti = Math.floor(rng() * this._typeProtos.length);
      const { proto, cfg } = this._typeProtos[ti];

      const rotY = rng() * Math.PI * 2;
      const s = randRange(rng, sMin, sMax);

      for (let mi = 0; mi < proto.geometriesByMaterial.length; mi++) {
        const bucket = buckets.find(b => b.typeIdx === ti && b.matIdx === mi);
        const m = new THREE.Matrix4()
          .makeRotationY(rotY)
          .premultiply(new THREE.Matrix4().makeScale(s, s, s))
          .premultiply(new THREE.Matrix4().makeTranslation(p.x, 0, p.z));
        bucket.transforms.push(m);
      }

      const radius = (proto.baseRadius * (cfg.occluderRadiusScale || 0.4)) * s;
      const height = (cfg.occluderHeight || 120) * s;
      occluders.push({ pos: new THREE.Vector3(p.x, 0, p.z), radius, height });
    }

    const meshes = [];
    const tmp = new THREE.Object3D();
    for (const b of buckets) {
      const count = b.transforms.length;
      if (!count) continue;
      const mesh = new THREE.InstancedMesh(b.geometry, b.material, count);
      mesh.castShadow = this.cfg.castShadow;
      mesh.receiveShadow = this.cfg.receiveShadow;

      for (let i = 0; i < count; i++) {
        tmp.matrix.copy(b.transforms[i]);
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      this.scene.add(mesh);
      meshes.push(mesh);
    }

    const tile = { key, tx, tz, meshes, occluders, rect };
    this._loaded.set(key, tile);

    // callback (es: collegare la fog ai nuovi materiali)
    this.cfg.onTileSpawn?.(tile);
  }

  _disposeTileKey(key) {
    const t = this._loaded.get(key);
    if (!t) return;
    for (const m of t.meshes) {
      this.scene.remove(m);
      m.geometry?.dispose?.();
      if (Array.isArray(m.material)) m.material.forEach(mm => mm.dispose());
      else m.material?.dispose?.();
    }
    this._loaded.delete(key);
  }

  disposeAll() {
    for (const k of Array.from(this._loaded.keys())) this._disposeTileKey(k);
  }

  // ---------- sampling rettangolo con blue-noise-ish ----------
  _generatePointsRect(rng, rect, sizePad) {
    const { minSpacing, maxSpacing, tileSize } = this.cfg;
    const avgSpacing = 0.5 * (minSpacing + maxSpacing) + sizePad;

    // densità approssimata: 1 punto per area ~ (avgSpacing)^2
    const area = tileSize * tileSize;
    const target = Math.floor(area / (avgSpacing*avgSpacing) * 0.85); // fattore di sicurezza

    const sh = new SpatialHash(avgSpacing);
    const pts = [];
    const maxTries = target * 30;

    for (let tries = 0; pts.length < target && tries < maxTries; tries++) {
      const x = rect.minX + rng() * tileSize;
      const z = rect.minZ + rng() * tileSize;

      const spacing = randRange(rng, minSpacing, maxSpacing);
      const minDist = spacing + sizePad;

      let ok = true;
      for (const idx of sh.queryNeighbors(x, z)) {
        const p = sh.points[idx];
        if (!p) continue;
        if (Math.hypot(x - p.x, z - p.z) < minDist) { ok = false; break; }
      }
      if (!ok) continue;

      sh.add(x, z);
      pts.push({ x, z });
    }
    return pts;
  }
}
