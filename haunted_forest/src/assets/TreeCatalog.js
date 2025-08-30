// src/assets/TreeCatalog.js 
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * TreeCatalog
 * - Carica un .OBJ
 * - Se la mesh ha più materiali, SPLIT per geometry.groups (uno per materiale)
 * - Applica regole PBR per ogni sotto-pezzo
 * - Merge per materiale -> geometrie pronte per InstancedMesh
 * - Riallineo base a y=0 e calcolo baseRadius
 */
export class TreeCatalog {
  constructor() {
    this.loader = new OBJLoader();
    this.prototypes = new Map(); // name -> { geometriesByMaterial: [{ material, geometry }], baseRadius }
  }

  async load(name, url, opts = {}) {
    if (this.prototypes.has(name)) return this.prototypes.get(name);

    const {
      scale = 1.0,
      defaultColor = 0x2e7d32,
      roughness = 0.9,
      metalness = 0.0,
      keepSourceMaps = false,
      rules = []
    } = opts;

    const obj = await this.loader.loadAsync(url);

    // firmaMat -> { material, geoms: [] }
    const byMat = new Map();

    obj.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;

      child.updateWorldMatrix(true, false);

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      const groups = (child.geometry.groups && child.geometry.groups.length)
        ? child.geometry.groups
        : [{ start: 0, count: (child.geometry.index ? child.geometry.index.count : child.geometry.attributes.position.count), materialIndex: 0 }];

      for (const g of groups) {
        const srcMat = mats[Math.min(g.materialIndex ?? 0, mats.length - 1)] || mats[0];

        // --- estrai la sotto-geometria del gruppo (non indicizzata) ---
        const sub = this._extractGroupGeometry(child.geometry, g.start, g.count);

        // porta in spazio mondo (cucina le trasformazioni del nodo)
        sub.applyMatrix4(child.matrixWorld);

        // materiale PBR secondo regole
        const chosen = this._buildMaterialFromRules({
          mesh: child,
          sourceMat: srcMat,
          rules,
          defaults: { defaultColor, roughness, metalness, keepSourceMaps }
        });

        const key = this._materialSignature(chosen);
        if (!byMat.has(key)) byMat.set(key, { material: chosen, geoms: [] });
        byMat.get(key).geoms.push(sub);
      }
    });

    // Merge per materiale + riallineo base a y=0 + normals + scale
    const geometriesByMaterial = [];
    let baseRadius = 1;

    for (const { material, geoms } of byMat.values()) {
      const merged = BufferGeometryUtils.mergeGeometries(geoms, false);

      merged.computeBoundingBox();
      const bb = merged.boundingBox;
      const widthX = bb.max.x - bb.min.x;
      const widthZ = bb.max.z - bb.min.z;
      baseRadius = Math.max(baseRadius, 0.5 * Math.hypot(widthX, widthZ));

      // base su y=0
      merged.translate(0, -bb.min.y, 0);

      if (scale !== 1) merged.scale(scale, scale, scale);

      merged.computeVertexNormals();

      geometriesByMaterial.push({ material, geometry: merged });
    }

    const proto = { geometriesByMaterial, baseRadius: baseRadius * scale };
    this.prototypes.set(name, proto);
    return proto;
  }

  /* ---------------- helpers ---------------- */

  // Estrae un sotto-range di una geometry in base a (start,count) sugli INDICI.
  // Converte a non-indicizzata per poter fare un semplice slice degli attributi.
  _extractGroupGeometry(geom, start, count) {
    const non = geom.index ? geom.toNonIndexed() : geom;
    const g = new THREE.BufferGeometry();
    for (const name in non.attributes) {
      const src = non.attributes[name];
      const itemSize = src.itemSize;
      const begin = start * itemSize;
      const end = (start + count) * itemSize;
      const arr = src.array.slice(begin, end);
      g.setAttribute(name, new THREE.BufferAttribute(arr, itemSize, src.normalized));
    }
    // copia le UV2/3 se presenti
    if (non.attributes.uv2) {
      const src = non.attributes.uv2;
      const arr = src.array.slice(start * src.itemSize, (start + count) * src.itemSize);
      g.setAttribute('uv2', new THREE.BufferAttribute(arr, src.itemSize, src.normalized));
    }
    if (non.attributes.uv3) {
      const src = non.attributes.uv3;
      const arr = src.array.slice(start * src.itemSize, (start + count) * src.itemSize);
      g.setAttribute('uv3', new THREE.BufferAttribute(arr, src.itemSize, src.normalized));
    }
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  _toArray(x) { return !x ? [] : (Array.isArray(x) ? x : [x]); }
  _matchAny(subs, target) {
    if (!target) return false;
    const low = String(target).toLowerCase();
    for (const s of this._toArray(subs)) {
      const needle = String(s).toLowerCase();
      if (needle && low.includes(needle)) return true;
    }
    return false;
  }
  _pickRule(mesh, sourceMat, rules) {
    const objName = mesh?.name || '';
    const matName = sourceMat?.name || '';
    for (const r of rules) {
      const okObj = r.matchObj ? this._matchAny(r.matchObj, objName) : false;
      const okMat = r.matchMat ? this._matchAny(r.matchMat, matName) : false;
      if (okObj || okMat) return r;
    }
    return null;
  }
  _colorFrom(c, fallback) {
    const color = new THREE.Color();
    if (c != null) color.set(c);
    else if (fallback != null) color.set(fallback);
    else color.set(0xffffff);
    return color;
  }
  _buildMaterialFromRules({ mesh, sourceMat, rules, defaults }) {
    const rule = this._pickRule(mesh, sourceMat, rules) || {};
    const color = this._colorFrom(rule.color, sourceMat?.color ?? defaults.defaultColor);
    const roughness = rule.roughness ?? sourceMat?.roughness ?? defaults.roughness ?? 0.9;
    const metalness = rule.metalness ?? sourceMat?.metalness ?? defaults.metalness ?? 0.0;
    const flatShading = rule.flatShading ?? false;
    const side = rule.side ?? THREE.DoubleSide;
    const transparent = rule.transparent ?? sourceMat?.transparent ?? false;
    const opacity = rule.opacity ?? sourceMat?.opacity ?? 1.0;

    const emissiveScale = rule.emissiveScale ?? 0.0;
    const emissiveColor = color.clone().multiplyScalar(emissiveScale);
    const emissiveIntensity = rule.emissiveIntensity ?? 0.0;

    const keepMap = rule.keepMap ?? defaults.keepSourceMaps ?? false;
    const map = keepMap ? (sourceMat?.map || null) : null;

    const mat = new THREE.MeshStandardMaterial({
      color, roughness, metalness, flatShading, side, transparent, opacity, map
    });
    if (emissiveIntensity > 0 || emissiveScale > 0) {
      mat.emissive.copy(emissiveColor);
      mat.emissiveIntensity = emissiveIntensity;
    }
    return mat;
  }
  _materialSignature(mat) {
    const c = mat.color?.getHexString?.() || '';
    const e = mat.emissive?.getHexString?.() || '';
    const m = (mat.metalness ?? 0).toFixed(3);
    const r = (mat.roughness ?? 0).toFixed(3);
    const f = mat.flatShading ? 1 : 0;
    const s = mat.side ?? THREE.FrontSide;
    const t = mat.transparent ? 1 : 0;
    const o = (mat.opacity ?? 1).toFixed(3);
    const ei = (mat.emissiveIntensity ?? 0).toFixed(3);
    const mapId = mat.map?.uuid || '';
    return `c:${c}|e:${e}|ei:${ei}|m:${m}|r:${r}|f:${f}|s:${s}|t:${t}|o:${o}|map:${mapId}`;
  }
}

