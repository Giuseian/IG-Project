// src/assets/TreeCatalog.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * TreeCatalog
 * - Carica un .OBJ (eventuali trasformazioni dei figli vengono "cucinate" nelle geometrie).
 * - Applica materiali PBR in base a REGOLE (match su nome oggetto/materiale).
 * - Unisce le geometrie per materiale ⇒ 1 BufferGeometry per materiale (perfetto per InstancedMesh).
 * - Riallinea la base a y=0, calcola baseRadius (utile per spacing/occluder).
 */
export class TreeCatalog {
  constructor() {
    this.loader = new OBJLoader();
    this.prototypes = new Map(); // name -> { geometriesByMaterial: [{ material, geometry }], baseRadius }
  }

  /*
   * @param {string} name      - chiave cache
   * @param {string} url       - percorso OBJ
   * @param {object} opts
   *   - scale: number (uniform)
   *   - defaultColor: number|string (fallback)
   *   - roughness, metalness: number
   *   - keepSourceMaps: boolean (mantieni eventuali map del materiale sorgente)
   *   - rules: [
   *       {
   *         name?: string,
   *         matchObj?: string[] | string,   // substrings per o.name
   *         matchMat?: string[] | string,   // substrings per material.name
   *         color?: string|number,
   *         roughness?: number,
   *         metalness?: number,
   *         emissiveScale?: number,         // 0..1 (moltiplica il base color)
   *         emissiveIntensity?: number,
   *         flatShading?: boolean,
   *         side?: THREE.Side,
   *         transparent?: boolean,
   *         opacity?: number,
   *         keepMap?: boolean               // override per singola rule
   *       }
   *     ]
   */
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

    // Carica il modello
    const obj = await this.loader.loadAsync(url);

    // Bucket per materiale (chiave firma → { material, geoms: [] })
    const byMat = new Map();

    obj.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;

      // 1) Cuoci trasformazioni in world space
      child.updateWorldMatrix(true, false);
      const geom = child.geometry.clone();
      geom.applyMatrix4(child.matrixWorld);

      // 2) Scegli materiale PBR in base alle regole
      const chosen = this._buildMaterialFromRules({
        mesh: child,
        sourceMat: Array.isArray(child.material) ? child.material[0] : child.material,
        rules,
        defaults: { defaultColor, roughness, metalness, keepSourceMaps }
      });

      // 3) Firma del materiale (evita merge di bucket "diversi")
      const key = this._materialSignature(chosen);

      if (!byMat.has(key)) byMat.set(key, { material: chosen, geoms: [] });
      byMat.get(key).geoms.push(geom);
    });

    // 4) Merge per materiale + riallineo base a y=0 + normal + scale
    const geometriesByMaterial = [];
    let baseRadius = 1;

    for (const { material, geoms } of byMat.values()) {
      const merged = BufferGeometryUtils.mergeGeometries(geoms, false);
      // bbox per riallineo+radius
      merged.computeBoundingBox();
      const bb = merged.boundingBox;
      const widthX = bb.max.x - bb.min.x;
      const widthZ = bb.max.z - bb.min.z;
      baseRadius = Math.max(baseRadius, 0.5 * Math.hypot(widthX, widthZ));

      // sposta su y=0 (base)
      merged.translate(0, -bb.min.y, 0);

      if (scale !== 1) merged.scale(scale, scale, scale);

      // normali ok per PBR
      merged.computeVertexNormals();

      geometriesByMaterial.push({ material, geometry: merged });
    }

    const proto = { geometriesByMaterial, baseRadius: baseRadius * scale };
    this.prototypes.set(name, proto);
    return proto;
  }

  /* ================= Helpers ================= */

  _toArray(x) {
    if (!x) return [];
    return Array.isArray(x) ? x : [x];
  }

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

    // emissive = baseColor * emissiveScale (se fornito), altrimenti nessuna tinta
    const emissiveScale = rule.emissiveScale ?? 0.0;
    const emissiveColor = color.clone().multiplyScalar(emissiveScale);
    const emissiveIntensity = rule.emissiveIntensity ?? 0.0;

    // Gestione texture: opzionale e solo se desiderato (può ridurre i merge)
    const keepMap = rule.keepMap ?? defaults.keepSourceMaps ?? false;
    const map = keepMap ? (sourceMat?.map || null) : null;

    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      flatShading,
      side,
      transparent,
      opacity,
      map
    });
    if (emissiveIntensity > 0 || emissiveScale > 0) {
      mat.emissive.copy(emissiveColor);
      mat.emissiveIntensity = emissiveIntensity;
    }
    return mat;
  }

  _materialSignature(mat) {
    // Nota: includiamo poche proprietà chiave per favorire il merge.
    // Se tieni le mappe, includi anche l'UUID della map per separare correttamente i bucket.
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



// Esempio di preload nel tuo setupForest:
// await catalog.load('pine', '/assets/trees/pine.obj', {
//   scale: 1.0,
//   // se vuoi ignorare eventuali texture del materiale sorgente:
//   keepSourceMaps: false,
//   rules: [
//     { // tronco
//       name: 'trunk',
//       matchObj: ['trunk','材质','cylinder'],
//       matchMat: ['trunk','材质'],
//       color: '#B28C72',
//       roughness: 0.95,
//       metalness: 0.0,
//       emissiveScale: 0.5,
//       emissiveIntensity: 0.08,
//       flatShading: true
//     },
//     { // chioma/ago
//       name: 'leaves',
//       matchObj: ['leaves','leaf','ico','pine','材质.001'],
//       matchMat: ['leaf','材质.001'],
//       color: '#7FA36B',
//       roughness: 0.95,
//       metalness: 0.0,
//       emissiveScale: 0.5,
//       emissiveIntensity: 0.08,
//       flatShading: true
//     },
//     { // fallback
//       name: 'other',
//       color: '#BFBFBF',
//       roughness: 0.95,
//       metalness: 0.0,
//       emissiveScale: 0.4,
//       emissiveIntensity: 0.04,
//       flatShading: true
//     }
//   ]
// });
