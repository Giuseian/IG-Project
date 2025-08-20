// src/entities/dissolvePatch.js
// -----------------------------------------------------------------------------
// Ghost Dissolve Patch (Three r160+)
// - Procedural FBM dissolve in world-space
// - Thin emissive rim around the dissolve threshold
// - Clean NORMAL path (no forced gl_FragColor)
// - Debug views (NOISE / MASK / EDGE) only when explicitly enabled
// -----------------------------------------------------------------------------

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/**
 * Patch options (all optional).
 * @typedef {Object} DissolveOptions
 * @property {number} [threshold=0.98]     - Initial dissolve threshold [0..1].
 * @property {number} [edgeWidth=0.035]    - Rim thickness in noise units.
 * @property {THREE.Color|number|string} [edgeColor=0x66ffff] - Emissive rim color.
 * @property {number} [noiseScale=1.1]     - FBM domain scale (world-space).
 * @property {number} [flowSpeed=0.6]      - Noise “scroll” speed.
 * @property {boolean} [enableDebugViews=true] - Compile debug views (NOISE/MASK/EDGE).
 */

/**
 * Applies the dissolve patch to a MeshStandardMaterial.
 * - Idempotent: will not patch the same material twice.
 * - Exposes a stable uniform set on mat.userData._ghostUniforms.
 * @param {THREE.MeshStandardMaterial} mat
 * @param {DissolveOptions} [opts]
 */
export function patchGhostMaterial(mat, opts = {}) {
  if (!mat || mat.isMaterial !== true) {
    console.warn('[dissolvePatch] invalid material');
    return;
  }
  if (mat.userData._ghostPatched) {
    // Already patched → just ensure uniforms are present
    return;
  }

  // ---- sensible defaults for delivery
  const threshold   = opts.threshold   ?? 0.98;
  const edgeWidth   = opts.edgeWidth   ?? 0.035;
  const edgeColor   = new THREE.Color(opts.edgeColor ?? 0x66ffff);
  const noiseScale  = opts.noiseScale  ?? 1.1;
  const flowSpeed   = opts.flowSpeed   ?? 0.6;
  const DEBUG_VIEWS = opts.enableDebugViews ?? true;

  // ---- persistent uniforms (stable object; only .value changes at runtime)
  const uniforms = mat.userData._ghostUniforms || {
    uThreshold:   { value: threshold },
    uEdgeWidth:   { value: edgeWidth },
    uEdgeColor:   { value: edgeColor },
    uNoiseScale:  { value: noiseScale },
    uFlowSpeed:   { value: flowSpeed },
    uPulseTime:   { value: 0.0 },
    // float for broader driver compatibility: 0=normal, 1=noise, 2=mask, 3=edge
    uDebugMode:   { value: 0.0 },
  };
  mat.userData._ghostUniforms = uniforms;

  // ---- flags & counters (useful for diagnostics)
  mat.userData._ghostPatched = true;
  mat.userData._dbgCompileCount = 0;

  // ---- make program cache aware of our patch toggles
  const keyBase = 'ghost-dissolve-v1';
  const prevKeyFn = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = function () {
    const k = `${keyBase};debug=${DEBUG_VIEWS ? 1 : 0}`;
    return prevKeyFn ? `${prevKeyFn()};${k}` : k;
  };

  // ---- actual shader patch
  mat.onBeforeCompile = (shader) => {
    mat.userData._dbgCompileCount++;
    Object.assign(shader.uniforms, uniforms);

    // --- VERTEX: robust world position (r160+)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         // [ghost:dissolve] varyings
         varying vec3 vWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         // [ghost:dissolve] world-space position from model matrix
         vWorldPos = (modelMatrix * vec4( transformed, 1.0 )).xyz;`
      );

    // --- FRAGMENT: clearly separated blocks
    const defines = `
      // [ghost:dissolve] build-time toggles
      #define ENABLE_DEBUG_VIEWS ${DEBUG_VIEWS ? 1 : 0}
    `;

    const injectCommon = `
      // [ghost:dissolve] common uniforms & helpers
      varying vec3 vWorldPos;

      uniform float uThreshold;
      uniform float uEdgeWidth;
      uniform vec3  uEdgeColor;
      uniform float uNoiseScale;
      uniform float uFlowSpeed;
      uniform float uPulseTime;
      uniform float uDebugMode; // 0..3

      // Lightweight value noise + FBM (3 octaves)
      float hash(vec3 p){
        p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float vnoise(vec3 p){
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f*f*(3.0-2.0*f);
        float n000 = hash(i + vec3(0,0,0));
        float n100 = hash(i + vec3(1,0,0));
        float n010 = hash(i + vec3(0,1,0));
        float n110 = hash(i + vec3(1,1,0));
        float n001 = hash(i + vec3(0,0,1));
        float n101 = hash(i + vec3(1,0,1));
        float n011 = hash(i + vec3(0,1,1));
        float n111 = hash(i + vec3(1,1,1));
        float nx00 = mix(n000, n100, f.x);
        float nx10 = mix(n010, n110, f.x);
        float nx01 = mix(n001, n101, f.x);
        float nx11 = mix(n011, n111, f.x);
        float nxy0 = mix(nx00, nx10, f.y);
        float nxy1 = mix(nx01, nx11, f.y);
        return mix(nxy0, nxy1, f.z);
      }
      float fbm(vec3 p){
        float a = 0.5;
        float f = 1.0;
        float s = 0.0;
        // 3 octaves: good quality/performance balance
        for (int i = 0; i < 3; i++){
          s += a * vnoise(p * f);
          f *= 2.0;
          a *= 0.5;
        }
        return s;
      }

      // shared debug values for the final override
      float g_n, g_thr, g_w, g_edge;
    `;

    // PRE (compute, then discard only in NORMAL)
    const preBlock = `
      // [ghost:dissolve] domain = world-space + flow on Z
      vec3  p   = vWorldPos * uNoiseScale + vec3(0.0, 0.0, uPulseTime * uFlowSpeed);
      float n   = clamp(fbm(p), 0.0, 1.0);
      float thr = uThreshold;
      float w   = uEdgeWidth;
      float aa  = fwidth(n) * 2.0;

      // symmetric rim around thr (screen-space AA)
      float edge = 1.0 - smoothstep( w, w + aa, abs(n - thr) );

      // export for debug block
      g_n = n; g_thr = thr; g_w = w; g_edge = edge;

      // NORMAL path: cut dissolved body, add emissive rim
      if (uDebugMode < 0.5) {
        if (n < thr - w) discard;
        totalEmissiveRadiance += uEdgeColor * (edge * 2.0);
      }
    `;

    // POST (final override only for debug views)
    const postBlock = `
      #if ENABLE_DEBUG_VIEWS
        // [ghost:dissolve] final override for debugging clarity
        if (uDebugMode > 0.5 && uDebugMode < 1.5) {
          // NOISE
          gl_FragColor = vec4(vec3(g_n), 1.0);
        } else if (uDebugMode > 1.5 && uDebugMode < 2.5) {
          // MASK (what remains)
          float mask = step(g_thr - g_w, g_n);
          gl_FragColor = vec4(vec3(mask), 1.0);
        } else if (uDebugMode > 2.5 && uDebugMode < 3.5) {
          // EDGE (rim only)
          vec3 e = normalize(uEdgeColor);
          gl_FragColor = vec4(e * g_edge, 1.0);
        }
      #endif
    `;

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `${defines}\n#include <common>\n${injectCommon}`)
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>\n${preBlock}`)
      // place at the very end so debug is not altered by tonemapping/fog/encodings
      .replace('#include <dithering_fragment>', `${postBlock}\n#include <dithering_fragment>`);
  };

  // Recommended material flags for transparent dissolve
  mat.transparent = true;
  mat.depthTest   = true;
  mat.depthWrite  = false;

  mat.needsUpdate = true;
}
