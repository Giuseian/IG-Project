import {
  identity, translate, rotate, scale, multiply, projection
} from './mat3.js';

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl");
if (!gl) alert("WebGL not supported");

let program, shaderInfo = {}, segBuffer;
let time = 0;

const bodyCenter = [400, 300];
const bodyRadius = 40;

const legs = [
  { angle: -Math.PI / 4, phase: 0 },           // Front-left
  { angle: -3 * Math.PI / 4, phase: Math.PI }, // Front-right
  { angle: Math.PI / 4, phase: Math.PI },      // Back-left
  { angle: 3 * Math.PI / 4, phase: 0 }         // Back-right
];

async function loadShaderSource(url) {
  const res = await fetch(url);
  return res.text();
}

async function init() {
  const vsSource = await loadShaderSource("shaders/vertex.glsl");
  const fsSource = await loadShaderSource("shaders/fragment.glsl");

  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  program = createProgram(vs, fs);
  gl.useProgram(program);

  shaderInfo.a_position = gl.getAttribLocation(program, "a_position");
  shaderInfo.u_matrix = gl.getUniformLocation(program, "u_matrix");
  shaderInfo.u_color = gl.getUniformLocation(program, "u_color");

  segBuffer = createSegmentBuffer();
  gl.clearColor(0.1, 0.1, 0.1, 1.0);

  requestAnimationFrame(render);
}

function compileShader(type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createSegmentBuffer() {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const data = new Float32Array([0, 0, 1, 0]); // unit line
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function solveIK(base, target, len1, len2) {
  const dx = target[0] - base[0];
  const dy = target[1] - base[1];
  const dist = Math.min(Math.hypot(dx, dy), len1 + len2);

  const angleA = Math.acos((len1 ** 2 + dist ** 2 - len2 ** 2) / (2 * len1 * dist));
  const angleB = Math.atan2(dy, dx);
  const jointAngle = angleB - angleA;

  const jointX = base[0] + Math.cos(jointAngle) * len1;
  const jointY = base[1] + Math.sin(jointAngle) * len1;

  return {
    joint: [jointX, jointY],
    foot: target
  };
}

function getLegTarget(base, phase) {
  const stepLength = 30;
  const stepHeight = 20;

  const step = Math.sin(time + phase);
  const lift = Math.max(0, step);

  const x = base[0] + step * stepLength;
  const y = base[1] - lift * stepHeight;

  return [x, y];
}

function drawSegment(pos, angle, length, color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuffer);
  gl.vertexAttribPointer(shaderInfo.a_position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shaderInfo.a_position);

  let mat = projection(canvas.width, canvas.height);
  mat = translate(mat, pos[0], pos[1]);
  mat = rotate(mat, angle);
  mat = scale(mat, length, 5);

  gl.uniformMatrix3fv(shaderInfo.u_matrix, false, mat);
  gl.uniform4fv(shaderInfo.u_color, color);
  gl.drawArrays(gl.LINES, 0, 2);
}

function drawJoint(x, y) {
  const r = 5;
  const points = [];
  for (let i = 0; i <= 20; i++) {
    const angle = i * 2 * Math.PI / 20;
    points.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

  gl.vertexAttribPointer(shaderInfo.a_position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shaderInfo.a_position);

  let mat = projection(canvas.width, canvas.height);
  gl.uniformMatrix3fv(shaderInfo.u_matrix, false, mat);
  gl.uniform4fv(shaderInfo.u_color, [1, 1, 1, 1]);
  gl.drawArrays(gl.LINE_STRIP, 0, points.length / 2);
}

function drawBody() {
  const x = bodyCenter[0];
  const y = bodyCenter[1];
  const r = bodyRadius;
  const segments = 32;
  const angleStep = (2 * Math.PI) / segments;

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    points.push(px, py);
  }

  const bodyBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bodyBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

  gl.vertexAttribPointer(shaderInfo.a_position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(shaderInfo.a_position);

  let mat = projection(canvas.width, canvas.height);
  gl.uniformMatrix3fv(shaderInfo.u_matrix, false, mat);
  gl.uniform4fv(shaderInfo.u_color, [0.3, 0.6, 1, 1]);

  gl.drawArrays(gl.LINE_STRIP, 0, points.length / 2);
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT);
  time += 0.02;

  const len1 = 60;
  const len2 = 60;

  for (const leg of legs) {
    const base = [
      bodyCenter[0] + Math.cos(leg.angle) * bodyRadius,
      bodyCenter[1] + Math.sin(leg.angle) * bodyRadius
    ];

    const target = getLegTarget(base, leg.phase);
    const ik = solveIK(base, target, len1, len2);

    const angle1 = Math.atan2(ik.joint[1] - base[1], ik.joint[0] - base[0]);
    const angle2 = Math.atan2(ik.foot[1] - ik.joint[1], ik.foot[0] - ik.joint[0]);

    drawSegment(base, angle1, len1, [1, 0.5, 0, 1]);       // upper leg
    drawSegment(ik.joint, angle2, len2, [0.2, 1, 0.2, 1]); // lower leg
    drawJoint(base[0], base[1]); // visual joint at connection
  }

  drawBody();
  requestAnimationFrame(render);
}

init();
