// // main.js - Draws 4 animated IK legs in 3D with torso
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
// gl.enable(gl.DEPTH_TEST); // Enable depth testing

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

// const mvp = createMat4();

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
//     axis = [1, 0, 0];
//     angle = 0;
//   }

//   const model = identity();
//   const x = axis[0], y = axis[1], z = axis[2];
//   const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;

//   model[0] = t*x*x + c;
//   model[1] = t*x*y + s*z;
//   model[2] = t*x*z - s*y;
//   model[4] = t*x*y - s*z;
//   model[5] = t*y*y + c;
//   model[6] = t*y*z + s*x;
//   model[8] = t*x*z + s*y;
//   model[9] = t*y*z - s*x;
//   model[10] = t*z*z + c;

//   model[0] *= 0.1; model[1] *= length / 2; model[2] *= 0.1;
//   model[4] *= 0.1; model[5] *= length / 2; model[6] *= 0.1;
//   model[8] *= 0.1; model[9] *= length / 2; model[10] *= 0.1;

//   model[12] = (from[0] + to[0]) / 2;
//   model[13] = (from[1] + to[1]) / 2;
//   model[14] = (from[2] + to[2]) / 2;

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

// function drawTorso() {
//   const model = identity();
//   model[0] = 1.5; // scale X
//   model[5] = 0.4; // scale Y (slightly flatter)
//   model[10] = 1.5; // scale Z
//   model[13] = 0.0; // lower to be in line with base of legs

//   // Multiply viewMatrix * model
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


// const len1 = 1.0, len2 = 1.0;

// const torsoY = 0.5;
// const torsoHeight = 0.5;
// const torsoBottomY = torsoY - torsoHeight / 2;

// const legs = [
//   { base: [-1, torsoBottomY,  1], phase: 0 },
//   { base: [ 1, torsoBottomY,  1], phase: Math.PI / 2 },
//   { base: [-1, torsoBottomY, -1], phase: Math.PI },
//   { base: [ 1, torsoBottomY, -1], phase: 3 * Math.PI / 2 }
// ];





// function draw(time) {
//   time *= 0.001;
//   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//   gl.uniformMatrix4fv(u_projectionMatrix, false, projMatrix);

//   drawTorso();

//   for (const { base, phase } of legs) {
//     const foot = [
//       base[0] + Math.sin(time + phase) * 0.5,
//       base[1] - 1.5 + Math.sin((time + phase) * 2) * 0.2,
//       base[2]
//     ];
//     const { joint } = solveIK3D(base, foot, len1, len2);
//     drawSegment(base, joint);
//     drawSegment(joint, foot);
//   }

//   requestAnimationFrame(draw);
// }

// draw();


// // main.js - Draws 4 animated IK legs in 3D with torso
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

// gl.clearColor(0.1, 0.1, 0.1, 1.0);
// gl.enable(gl.DEPTH_TEST);

// const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeVertices));
// const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeNormals));
// const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices));

// const a_position = gl.getAttribLocation(program, 'a_position');
// const a_normal = gl.getAttribLocation(program, 'a_normal');
// const u_modelViewMatrix = gl.getUniformLocation(program, 'u_modelViewMatrix');
// const u_projectionMatrix = gl.getUniformLocation(program, 'u_projectionMatrix');

// const projMatrix = createMat4();
// const viewMatrix = createMat4();
// perspective(projMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
// lookAt(viewMatrix, [3, 2, 5], [0, 0, 0], [0, 1, 0]);

// const mvp = createMat4();

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

// function transformPoint(mat, pt) {
//   const [x, y, z] = pt;
//   return [
//     mat[0] * x + mat[4] * y + mat[8] * z + mat[12],
//     mat[1] * x + mat[5] * y + mat[9] * z + mat[13],
//     mat[2] * x + mat[6] * y + mat[10] * z + mat[14]
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
//     axis = [1, 0, 0];
//     angle = 0;
//   }

//   const model = identity();
//   const x = axis[0], y = axis[1], z = axis[2];
//   const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;

//   model[0] = t*x*x + c;
//   model[1] = t*x*y + s*z;
//   model[2] = t*x*z - s*y;
//   model[4] = t*x*y - s*z;
//   model[5] = t*y*y + c;
//   model[6] = t*y*z + s*x;
//   model[8] = t*x*z + s*y;
//   model[9] = t*y*z - s*x;
//   model[10] = t*z*z + c;

//   model[0] *= 0.1; model[1] *= length / 2; model[2] *= 0.1;
//   model[4] *= 0.1; model[5] *= length / 2; model[6] *= 0.1;
//   model[8] *= 0.1; model[9] *= length / 2; model[10] *= 0.1;

//   model[12] = (from[0] + to[0]) / 2;
//   model[13] = (from[1] + to[1]) / 2;
//   model[14] = (from[2] + to[2]) / 2;

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

// function drawTorso(modelOut) {
//   const model = identity();
//   model[0] = 1.5; // X scale
//   model[5] = 0.5; // Y scale
//   model[10] = 1.5; // Z scale
//   model[13] = 0.5; // Y position

//   if (modelOut) for (let i = 0; i < 16; i++) modelOut[i] = model[i];

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

// const len1 = 1.0, len2 = 1.0;
// const legs = [
//   { offset: [-0.75, 0,  0.75], phase: 0 },           // Changed -0.25 to 0
//   { offset: [ 0.75, 0,  0.75], phase: Math.PI / 2 }, // Changed -0.25 to 0
//   { offset: [-0.75, 0, -0.75], phase: Math.PI },     // Changed -0.25 to 0
//   { offset: [ 0.75, 0, -0.75], phase: 3 * Math.PI / 2 } // Changed -0.25 to 0
// ];

// function draw(time) {
//   time *= 0.001;
//   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//   gl.uniformMatrix4fv(u_projectionMatrix, false, projMatrix);

//   const torsoModel = identity();
//   torsoModel[0] = 1.5;
//   torsoModel[5] = 0.5;
//   torsoModel[10] = 1.5;
//   torsoModel[13] = 0.5;
//   drawTorso(torsoModel);

//   for (const { offset, phase } of legs) {
//     const base = transformPoint(torsoModel, offset);
//     const foot = [
//       base[0] + Math.sin(time + phase) * 0.5,
//       base[1] - 1.5 + Math.sin((time + phase) * 2) * 0.2,
//       base[2]
//     ];
//     const { joint } = solveIK3D(base, foot, len1, len2);
//     drawSegment(base, joint);
//     drawSegment(joint, foot);
//   }

//   requestAnimationFrame(draw);
// }

// draw();



// main.js - Draws 4 animated IK legs in 3D with torso
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

gl.clearColor(0.1, 0.1, 0.1, 1.0);
gl.enable(gl.DEPTH_TEST);

const positionBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeVertices));
const normalBuffer = createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(cubeNormals));
const indexBuffer = createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(cubeIndices));

const a_position = gl.getAttribLocation(program, 'a_position');
const a_normal = gl.getAttribLocation(program, 'a_normal');
const u_modelViewMatrix = gl.getUniformLocation(program, 'u_modelViewMatrix');
const u_projectionMatrix = gl.getUniformLocation(program, 'u_projectionMatrix');

const projMatrix = createMat4();
const viewMatrix = createMat4();
perspective(projMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100);
lookAt(viewMatrix, [5, 3, 5], [0, 0, 0], [0, 1, 0]);

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

function transformPoint(mat, pt) {
  const [x, y, z] = pt;
  return [
    mat[0] * x + mat[4] * y + mat[8] * z + mat[12],
    mat[1] * x + mat[5] * y + mat[9] * z + mat[13],
    mat[2] * x + mat[6] * y + mat[10] * z + mat[14]
  ];
}

function drawLine(from, to) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
  
  if (length < 0.001) return;
  
  // Create transformation matrix
  const model = identity();
  
  // Position at midpoint
  const midX = (from[0] + to[0]) / 2;
  const midY = (from[1] + to[1]) / 2;
  const midZ = (from[2] + to[2]) / 2;
  
  // Direction vector (normalized)
  const dirX = dx / length;
  const dirY = dy / length;
  const dirZ = dz / length;
  
  // Create rotation matrix to align Y-axis with direction vector
  // Since our cube is tall along Y-axis, we want to align Y with our direction
  
  // Find rotation axis (cross product of Y-axis with direction)
  const upX = 0, upY = 1, upZ = 0;
  let axisX = upY * dirZ - upZ * dirY;
  let axisY = upZ * dirX - upX * dirZ;
  let axisZ = upX * dirY - upY * dirX;
  
  const axisLength = Math.sqrt(axisX*axisX + axisY*axisY + axisZ*axisZ);
  
  if (axisLength > 0.001) {
    axisX /= axisLength;
    axisY /= axisLength;
    axisZ /= axisLength;
    
    const dot = upX*dirX + upY*dirY + upZ*dirZ;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    
    // Rodrigues' rotation formula
    model[0] = t*axisX*axisX + c;
    model[1] = t*axisX*axisY + s*axisZ;
    model[2] = t*axisX*axisZ - s*axisY;
    model[4] = t*axisX*axisY - s*axisZ;
    model[5] = t*axisY*axisY + c;
    model[6] = t*axisY*axisZ + s*axisX;
    model[8] = t*axisX*axisZ + s*axisY;
    model[9] = t*axisY*axisZ - s*axisX;
    model[10] = t*axisZ*axisZ + c;
  }
  
  // Apply scaling (your cube is 0.2 × 1.0 × 0.2)
  // Scale to make it thinner and the right length
  const thickness = 0.05;
  for (let i = 0; i < 3; i++) {
    model[i] *= thickness;      // X scale
    model[i+4] *= length;       // Y scale (length)
    model[i+8] *= thickness;    // Z scale
  }
  
  // Set position
  model[12] = midX;
  model[13] = midY;
  model[14] = midZ;

  // Apply view matrix
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

function drawTorso(model) {
  // Use the passed model matrix directly
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
  { offset: [-0.4, -0.5,  0.3], phase: 0 },
  { offset: [ 0.4, -0.5,  0.3], phase: Math.PI / 2 },
  { offset: [-0.4, -0.5, -0.3], phase: Math.PI },
  { offset: [ 0.4, -0.5, -0.3], phase: 3 * Math.PI / 2 }
];

function draw(time) {
  time *= 0.001;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(u_projectionMatrix, false, projMatrix);

  // Create horizontal torso matrix properly
  const torsoModel = identity();
  
  // Rotate 90 degrees around Z-axis to make the tall cube horizontal
  // [cos(-90) -sin(-90) 0]   [0  1  0]
  // [sin(-90)  cos(-90) 0] = [-1 0  0]  
  // [0         0        1]   [0  0  1]
  torsoModel[0] = 0;    torsoModel[4] = 1;     torsoModel[8] = 0;
  torsoModel[1] = -1;   torsoModel[5] = 0;     torsoModel[9] = 0;
  torsoModel[2] = 0;    torsoModel[6] = 0;     torsoModel[10] = 1;
  
  // Scale: make it wide (X), short (Y), deep (Z)
  torsoModel[0] *= 3.0;   // X scale (width) 
  torsoModel[1] *= 3.0;   
  torsoModel[4] *= 0.8;   // Y scale (height)
  torsoModel[5] *= 0.8;   
  torsoModel[10] *= 2.5;  // Z scale (depth)
  
  // Position at Y = 0.4
  torsoModel[13] = 0.4;

  // Draw torso
  drawTorso(torsoModel);

  // Draw legs - calculate attachment points manually instead of using transformPoint
  const torsoWidth = 3.0 * 0.2;  // 0.6
  const torsoHeight = 0.8 * 1.0; // 0.8  
  const torsoDepth = 2.5 * 0.2;  // 0.5
  const torsoY = 0.4;
  
  // Attach legs higher up on the torso sides instead of bottom
  const legAttachY = torsoY - torsoHeight/4; // Attach 1/4 down from center instead of bottom
  
  const legAttachments = [
    [-torsoWidth/2, legAttachY,  torsoDepth/2], // front left
    [ torsoWidth/2, legAttachY,  torsoDepth/2], // front right
    [-torsoWidth/2, legAttachY, -torsoDepth/2], // back left
    [ torsoWidth/2, legAttachY, -torsoDepth/2]  // back right
  ];
  
  legs.forEach(({ phase }, i) => {
    const base = legAttachments[i];
    
    // Add debug sphere to see where attachment points are
    const debugModel = identity();
    debugModel[0] = debugModel[5] = debugModel[10] = 0.1;
    debugModel[12] = base[0];
    debugModel[13] = base[1]; 
    debugModel[14] = base[2];
    drawTorso(debugModel);
    
    const foot = [
      base[0] + Math.sin(time + phase) * 0.5,
      base[1] - 1.5 + Math.sin((time + phase) * 2) * 0.2,
      base[2]
    ];
    const { joint } = solveIK3D(base, foot, len1, len2);
    drawLine(base, joint);
    drawLine(joint, foot);
  });

  requestAnimationFrame(draw);
}

draw();