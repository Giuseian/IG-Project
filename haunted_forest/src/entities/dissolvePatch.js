// // src/shaders/dissolvePatch.js
// export function patchGhostMaterial(mat) {
//   mat.onBeforeCompile = (shader) => {
//     // uniforms we’ll animate later
//     shader.uniforms.uPulseTime  = { value: 0.0 };
//     shader.uniforms.uThreshold  = { value: 0.25 };
//     shader.uniforms.uEdgeColor  = { value: { x: 0.6, y: 1.0, z: 1.0 } };
//     shader.uniforms.uEdgeWidth  = { value: 0.03 };

//     // declare uniforms
//     shader.fragmentShader = shader.fragmentShader.replace(
//       '#include <common>',
//       `#include <common>
//        uniform float uPulseTime;
//        uniform float uThreshold;
//        uniform vec3  uEdgeColor;
//        uniform float uEdgeWidth;
//       `
//     );

//     // tiny emissive "breathing" so we can see the patch is live (no discard yet)
//     shader.fragmentShader = shader.fragmentShader.replace(
//       '#include <emissivemap_fragment>',
//       `#include <emissivemap_fragment>
//        totalEmissiveRadiance *= (1.0 + 0.05 * sin(uPulseTime * 2.0));
//       `
//     );

//     // store refs so Ghost.update() can drive them
//     mat.userData._ghostUniforms = {
//       uPulseTime:  shader.uniforms.uPulseTime,
//       uThreshold:  shader.uniforms.uThreshold,
//       uEdgeColor:  shader.uniforms.uEdgeColor,
//       uEdgeWidth:  shader.uniforms.uEdgeWidth,
//     };
//   };

//   // ensure the material recompiles with our patch
//   mat.needsUpdate = true;
//   return mat;
// }


// // src/entities/dissolvePatch.js  - working 
// export function patchGhostMaterial(mat) {
//   // 1) CREA SUBITO i riferimenti alle uniform (ancor prima della compilazione)
//   const uniformRefs = {
//     uPulseTime: { value: 0.0 },
//     // parti "dissolto": 1.0 → in appearing scenderà a 0.25
//     uThreshold: { value: 1.0 },
//     uEdgeColor: { value: { x: 0.6, y: 1.0, z: 1.0 } },
//     uEdgeWidth: { value: 0.03 },
//   };
//   // esponi i riferimenti subito: ora Ghost._getThreshold() li vede
//   mat.userData._ghostUniforms = uniformRefs;

//   // 2) Patching shader: collega quelle stesse uniform al programma
//   mat.onBeforeCompile = (shader) => {
//     // collega i riferimenti esistenti
//     shader.uniforms.uPulseTime = uniformRefs.uPulseTime;
//     shader.uniforms.uThreshold = uniformRefs.uThreshold;
//     shader.uniforms.uEdgeColor = uniformRefs.uEdgeColor;
//     shader.uniforms.uEdgeWidth = uniformRefs.uEdgeWidth;

//     // dichiara uniform nel frammento
//     shader.fragmentShader = shader.fragmentShader.replace(
//       '#include <common>',
//       `#include <common>
//        uniform float uPulseTime;
//        uniform float uThreshold;
//        uniform vec3  uEdgeColor;
//        uniform float uEdgeWidth;
//       `
//     );

//     // piccolo "respiro" sull'emissive (niente discard ancora; Step 7)
//     shader.fragmentShader = shader.fragmentShader.replace(
//       '#include <emissivemap_fragment>',
//       `#include <emissivemap_fragment>
//        totalEmissiveRadiance *= (1.0 + 0.05 * sin(uPulseTime * 2.0));
//       `
//     );
//   };

//   // forza ricompilazione con la patch
//   mat.needsUpdate = true;
//   return mat;
// }


// src/entities/dissolvePatch.js
export function patchGhostMaterial(mat) {
  // 1) uniform condivise (esposte subito)
  const uniformRefs = {
    uPulseTime: { value: 0.0 },
    uThreshold: { value: 1.0 },                 // partire "dissolto"
    uEdgeColor: { value: { x: 0.6, y: 1.0, z: 1.0 } },
    uEdgeWidth: { value: 0.03 },
  };
  mat.userData._ghostUniforms = uniformRefs;

  // 2) patch dello shader
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPulseTime = uniformRefs.uPulseTime;
    shader.uniforms.uThreshold = uniformRefs.uThreshold;
    shader.uniforms.uEdgeColor = uniformRefs.uEdgeColor;
    shader.uniforms.uEdgeWidth = uniformRefs.uEdgeWidth;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform float uPulseTime;
       uniform float uThreshold;
       uniform vec3  uEdgeColor;
       uniform float uEdgeWidth;
      `
    );

    // "respiro" dell'emissive (più visibile di prima)
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
       // ampiezza 0.15, un po' più veloce
       totalEmissiveRadiance *= (1.0 + 0.15 * sin(uPulseTime * 3.2));
      `
    );
  };

  mat.needsUpdate = true;
  return mat;
}
