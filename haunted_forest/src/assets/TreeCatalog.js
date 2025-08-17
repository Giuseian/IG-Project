import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OBJLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import * as BufferGeometryUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

// Loads .OBJ trees and prepares instancing-friendly prototypes
export class TreeCatalog {
  constructor() {
    this.loader = new OBJLoader();
    this.prototypes = new Map(); // name -> { geometriesByMaterial: [{material, geometry}], baseRadius }
  }

  async load(name, url, opts = {}) {
    if (this.prototypes.has(name)) return this.prototypes.get(name);
    const { defaultColor = 0x2e7d32, roughness = 0.8, metalness = 0.0, scale = 1.0 } = opts;

    const obj = await this.loader.loadAsync(url);

    // Collect meshes by material signature so we can create one InstancedMesh per material.
    const byMat = new Map(); // key -> { material, geoms: [] }
    obj.traverse((child) => {
      if (child.isMesh && child.geometry) {
        // Clone geometry in world space
        child.updateWorldMatrix(true, false);
        const geom = child.geometry.clone();
        geom.applyMatrix4(child.matrixWorld);

        // Normalize material to a MeshStandardMaterial (fallback if missing)
        let mat = child.material;
        if (!mat || Array.isArray(mat)) {
          mat = new THREE.MeshStandardMaterial({ color: defaultColor, roughness, metalness });
        }
        const key = `${mat.uuid}|${mat.name||''}|${mat.color?.getHexString?.()||''}`;
        if (!byMat.has(key)) byMat.set(key, { material: mat, geoms: [] });
        byMat.get(key).geoms.push(geom);
      }
    });

    // Merge geometries per-material; recenter Y so base sits at y=0; apply uniform scale.
    const geometriesByMaterial = [];
    let baseRadius = 1;

    for (const { material, geoms } of byMat.values()) {
      const merged = BufferGeometryUtils.mergeGeometries(geoms, false);
      merged.computeBoundingBox();
      const bb = merged.boundingBox;
      const height = bb.max.y - bb.min.y;
      baseRadius = Math.max(baseRadius, Math.hypot(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5);

      // move so trunk base sits on y=0
      const yShift = -bb.min.y;
      merged.translate(0, yShift, 0);

      if (scale !== 1) merged.scale(scale, scale, scale);

      // Ensure normals
      merged.computeVertexNormals();

      // Convert material to standard if not already (keeps color); set receiveShadow/cast via InstancedMesh
      const matStd = new THREE.MeshStandardMaterial({
        color: material.color?.clone?.() || new THREE.Color(defaultColor),
        roughness: material.roughness ?? roughness,
        metalness: material.metalness ?? metalness,
        transparent: material.transparent || false,
        opacity: material.opacity ?? 1.0,
      });

      geometriesByMaterial.push({ material: matStd, geometry: merged });
    }

    const proto = { geometriesByMaterial, baseRadius };
    this.prototypes.set(name, proto);
    return proto;
  }
}