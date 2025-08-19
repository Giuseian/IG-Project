// // src/shaders/dissolvePatch.js
// import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// export function patchGhostMaterial(material) {
//   const prev = material.onBeforeCompile;

//   material.onBeforeCompile = (shader) => {
//     // keep earlier patches (e.g., fog)
//     prev?.(shader);

//     // runtime uniforms (so we can update from JS)
//     shader.uniforms.uPulseTime = { value: 0.0 };
//     shader.uniforms.uThreshold = { value: 0.0 };
//     shader.uniforms.uEdgeColor = { value: new THREE.Color(0x66ffff) };
//     shader.uniforms.uEdgeWidth = { value: 0.02 };

//     // --- harden: inject GLSL uniform declarations at the top ---
//     const header = `
// uniform float uPulseTime;
// uniform float uThreshold;
// uniform vec3  uEdgeColor;
// uniform float uEdgeWidth;
// `;
//     if (!shader.fragmentShader.includes('uPulseTime')) {
//       shader.fragmentShader = header + shader.fragmentShader;
//     }

//     // subtle emissive "breathing" so we see the patch working
//     shader.fragmentShader = shader.fragmentShader.replace(
//       '#include <emissivemap_fragment>',
//       `
//       #include <emissivemap_fragment>
//       totalEmissiveRadiance *= (1.0 + 0.05 * sin(uPulseTime * 2.0));
//       `
//     );

//     // keep a handle to uniforms for updates in Ghost.update()
//     material.userData._ghostUniforms = shader.uniforms;
//   };

//   material.needsUpdate = true;
// }

// src/shaders/dissolvePatch.js
// Tiny onBeforeCompile patch: inject uniforms + a subtle emissive "breathing".
// (No dissolve yet — we only prep uniforms.)

// src/shaders/dissolvePatch.js
export function patchGhostMaterial(mat) {
  mat.onBeforeCompile = (shader) => {
    // uniforms we’ll animate later
    shader.uniforms.uPulseTime  = { value: 0.0 };
    shader.uniforms.uThreshold  = { value: 0.25 };
    shader.uniforms.uEdgeColor  = { value: { x: 0.6, y: 1.0, z: 1.0 } };
    shader.uniforms.uEdgeWidth  = { value: 0.03 };

    // declare uniforms
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uPulseTime;
       uniform float uThreshold;
       uniform vec3  uEdgeColor;
       uniform float uEdgeWidth;
      `
    );

    // tiny emissive "breathing" so we can see the patch is live (no discard yet)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       totalEmissiveRadiance *= (1.0 + 0.05 * sin(uPulseTime * 2.0));
      `
    );

    // store refs so Ghost.update() can drive them
    mat.userData._ghostUniforms = {
      uPulseTime:  shader.uniforms.uPulseTime,
      uThreshold:  shader.uniforms.uThreshold,
      uEdgeColor:  shader.uniforms.uEdgeColor,
      uEdgeWidth:  shader.uniforms.uEdgeWidth,
    };
  };

  // ensure the material recompiles with our patch
  mat.needsUpdate = true;
  return mat;
}
