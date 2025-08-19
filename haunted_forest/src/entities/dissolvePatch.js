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
