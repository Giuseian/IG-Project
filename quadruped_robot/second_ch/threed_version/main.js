// // main.js - Draws 1 animated IK leg in 3D
// import { vsSource, fsSource, compileShader, createProgram } from './gl/shaders.js';
// import { createMat4, perspective, lookAt, createBuffer } from './gl/utils.js';
// import { cubeVertices, cubeNormals, cubeIndices } from './meshes/cube.js';
// import { solveIK3D } from './ik/leg3d.js';

// const canvas = document.getElementById("glCanvas");
// const gl = canvas.getContext("webgl");
// if (!gl) alert("WebGL not supported");

// canvas.width = window.innerWidth;
// canvas.height = window.innerHeight;
// gl.viewport(0, 0, canvas.width, canvas.height);

// const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
// const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
// const program = createProgram(gl, vs, fs);
// gl.useProgram(program);

// gl.clearColor(0.1, 0.1, 0.1, 1.0); // Set background color

// // Buffers
// const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeVertices));
// const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeNormals));
// const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices));

// const a_position = gl.getAttribLocation(program, 'a_position');
// const a_normal = gl.getAttribLocation(program, 'a_normal');
// const u_modelViewMatrix = gl.getUniformLocation(program, 'u_modelViewMatrix');
// const u_projectionMatrix = gl.getUniformLocation(program, 'u_projectionMatrix');

// // Matrices
// const projMatrix = createMat4();
// const viewMatrix = createMat4();
// perspective(projMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
// lookAt(viewMatrix, [3, 2, 5], [0, 0, 0], [0, 1, 0]);

// // Final MVP is projection * view * model
// const mvp = createMat4();

// // Basic identity
// function identity() {
//   const out = createMat4();
//   out[0] = out[5] = out[10] = out[15] = 1;
//   return out;
// }

// function normalize(v) {
//   const len = Math.hypot(...v);
//   return v.map(n => n / len);
// }

// function cross(a, b) {
//   return [
//     a[1]*b[2] - a[2]*b[1],
//     a[2]*b[0] - a[0]*b[2],
//     a[0]*b[1] - a[1]*b[0]
//   ];
// }

// function drawSegment(from, to) {
//   const dx = to[0] - from[0];
//   const dy = to[1] - from[1];
//   const dz = to[2] - from[2];
//   const length = Math.sqrt(dx*dx + dy*dy + dz*dz);

//   const dir = normalize([dx, dy, dz]);
//   const up = [0, 1, 0];
//   let axis = cross(up, dir);
//   let angle = Math.acos(up[0]*dir[0] + up[1]*dir[1] + up[2]*dir[2]);
//   if (angle < 0.0001 || isNaN(angle)) {
//     axis = [1, 0, 0]; // avoid nan when aligned
//     angle = 0;
//   }

//   const model = identity();
//   const x = axis[0], y = axis[1], z = axis[2];
//   const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;

//   // Rotation matrix around arbitrary axis (Rodrigues)
//   model[0] = t*x*x + c;
//   model[1] = t*x*y + s*z;
//   model[2] = t*x*z - s*y;

//   model[4] = t*x*y - s*z;
//   model[5] = t*y*y + c;
//   model[6] = t*y*z + s*x;

//   model[8] = t*x*z + s*y;
//   model[9] = t*y*z - s*x;
//   model[10] = t*z*z + c;

//   // Scale leg to match length
//   model[0] *= 0.1;
//   model[1] *= length / 2;
//   model[2] *= 0.1;
//   model[4] *= 0.1;
//   model[5] *= length / 2;
//   model[6] *= 0.1;
//   model[8] *= 0.1;
//   model[9] *= length / 2;
//   model[10] *= 0.1;

//   // Translate to midpoint
//   model[12] = (from[0] + to[0]) / 2;
//   model[13] = (from[1] + to[1]) / 2;
//   model[14] = (from[2] + to[2]) / 2;

//   // Final modelView
//   for (let i = 0; i < 16; i++) mvp[i] = 0;
//   for (let row = 0; row < 4; row++) {
//     for (let col = 0; col < 4; col++) {
//       for (let k = 0; k < 4; k++) {
//         mvp[row + col * 4] += viewMatrix[row + k * 4] * model[k + col * 4];
//       }
//     }
//   }

//   gl.uniformMatrix4fv(u_modelViewMatrix, false, mvp);

//   gl.enableVertexAttribArray(a_position);
//   gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
//   gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);

//   gl.enableVertexAttribArray(a_normal);
//   gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
//   gl.vertexAttribPointer(a_normal, 3, gl.FLOAT, false, 0, 0);

//   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
//   gl.drawElements(gl.TRIANGLES, cubeIndices.length, gl.UNSIGNED_SHORT, 0);
// }

// const base = [0, 0, 0];
// const len1 = 1.0, len2 = 1.0;

// function draw(time) {
//   time *= 0.001;
//   const foot = [Math.sin(time) * 0.5, -1.5 + Math.sin(time * 2) * 0.2, 0];
//   const { joint } = solveIK3D(base, foot, len1, len2);

//   console.log("Base:", base, "Joint:", joint, "Foot:", foot); // Debug positions

//   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//   gl.uniformMatrix4fv(u_projectionMatrix, false, projMatrix);

//   // Draw segments
//   drawSegment(base, joint);
//   drawSegment(joint, foot);

//   requestAnimationFrame(draw);
// }

// draw();



// main.js - Draws 4 animated IK legs in 3D
import { vsSource, fsSource, compileShader, createProgram } from './gl/shaders.js';
import { createMat4, perspective, lookAt, createBuffer } from './gl/utils.js';
import { cubeVertices, cubeNormals, cubeIndices } from './meshes/cube.js';
import { solveIK3D } from './ik/leg3d.js';

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");
if (!gl) alert("WebGL not supported");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);

const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
const program = createProgram(gl, vs, fs);
gl.useProgram(program);

gl.clearColor(0.1, 0.1, 0.1, 1.0); // Set background color

// Buffers
const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeVertices));
const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeNormals));
const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices));

const a_position = gl.getAttribLocation(program, 'a_position');
const a_normal = gl.getAttribLocation(program, 'a_normal');
const u_modelViewMatrix = gl.getUniformLocation(program, 'u_modelViewMatrix');
const u_projectionMatrix = gl.getUniformLocation(program, 'u_projectionMatrix');

// Matrices
const projMatrix = createMat4();
const viewMatrix = createMat4();
perspective(projMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
lookAt(viewMatrix, [3, 2, 5], [0, 0, 0], [0, 1, 0]);

const mvp = createMat4();

function identity() {
  const out = createMat4();
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

function normalize(v) {
  const len = Math.hypot(...v);
  return v.map(n => n / len);
}

function cross(a, b) {
  return [
    a[1]*b[2] - a[2]*b[1],
    a[2]*b[0] - a[0]*b[2],
    a[0]*b[1] - a[1]*b[0]
  ];
}

function drawSegment(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx*dx + dy*dy + dz*dz);

  const dir = normalize([dx, dy, dz]);
  const up = [0, 1, 0];
  let axis = cross(up, dir);
  let angle = Math.acos(up[0]*dir[0] + up[1]*dir[1] + up[2]*dir[2]);
  if (angle < 0.0001 || isNaN(angle)) {
    axis = [1, 0, 0];
    angle = 0;
  }

  const model = identity();
  const x = axis[0], y = axis[1], z = axis[2];
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;

  model[0] = t*x*x + c;
  model[1] = t*x*y + s*z;
  model[2] = t*x*z - s*y;
  model[4] = t*x*y - s*z;
  model[5] = t*y*y + c;
  model[6] = t*y*z + s*x;
  model[8] = t*x*z + s*y;
  model[9] = t*y*z - s*x;
  model[10] = t*z*z + c;

  model[0] *= 0.1; model[1] *= length / 2; model[2] *= 0.1;
  model[4] *= 0.1; model[5] *= length / 2; model[6] *= 0.1;
  model[8] *= 0.1; model[9] *= length / 2; model[10] *= 0.1;

  model[12] = (from[0] + to[0]) / 2;
  model[13] = (from[1] + to[1]) / 2;
  model[14] = (from[2] + to[2]) / 2;

  for (let i = 0; i < 16; i++) mvp[i] = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      for (let k = 0; k < 4; k++) {
        mvp[row + col * 4] += viewMatrix[row + k * 4] * model[k + col * 4];
      }
    }
  }

  gl.uniformMatrix4fv(u_modelViewMatrix, false, mvp);

  gl.enableVertexAttribArray(a_position);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);

  gl.enableVertexAttribArray(a_normal);
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.vertexAttribPointer(a_normal, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, cubeIndices.length, gl.UNSIGNED_SHORT, 0);
}

const len1 = 1.0, len2 = 1.0;
const legs = [
  { base: [-1, 0,  1], phase: 0 },
  { base: [ 1, 0,  1], phase: Math.PI / 2 },
  { base: [-1, 0, -1], phase: Math.PI },
  { base: [ 1, 0, -1], phase: 3 * Math.PI / 2 }
];

function draw(time) {
  time *= 0.001;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(u_projectionMatrix, false, projMatrix);

  for (const { base, phase } of legs) {
    const foot = [
      base[0] + Math.sin(time + phase) * 0.5,
      base[1] - 1.5 + Math.sin((time + phase) * 2) * 0.2,
      base[2]
    ];
    const { joint } = solveIK3D(base, foot, len1, len2);
    drawSegment(base, joint);
    drawSegment(joint, foot);
  }

  requestAnimationFrame(draw);
}

draw();
