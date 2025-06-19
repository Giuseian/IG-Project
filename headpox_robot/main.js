import { createShaderProgram, Vec3, Mat4 } from './utils/math.js';

let canvas, gl, program;
let positionBuffer;
let aPositionLoc, uModelLoc, uViewLoc, uProjectionLoc;

let time = 0;

const leg = {
  base: [0, 0, 0],
  len1: 0.4,
  len2: 0.4,
  joint1: [0, 0, 0],
  foot: [0.5, 0, 0.2],
};

async function init() {
  canvas = document.getElementById('glcanvas');
  gl = canvas.getContext('webgl');

  if (!gl) {
    alert('WebGL not supported');
    return;
  }

  const vsSource = await fetch('./shaders/vertex.glsl').then(res => res.text());
  const fsSource = await fetch('./shaders/fragment.glsl').then(res => res.text());

  program = createShaderProgram(gl, vsSource, fsSource);
  gl.useProgram(program);

  aPositionLoc = gl.getAttribLocation(program, 'aPosition');
  uModelLoc = gl.getUniformLocation(program, 'uModel');
  uViewLoc = gl.getUniformLocation(program, 'uView');
  uProjectionLoc = gl.getUniformLocation(program, 'uProjection');

  // Cylinder mesh: simple 2D line as placeholder
  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0, 0,
    0, 1, 0,
  ]), gl.STATIC_DRAW);

  gl.enable(gl.DEPTH_TEST);

  requestAnimationFrame(draw);
}

function draw(timestamp) {
  time = timestamp * 0.001;

  resizeCanvas();

  gl.clearColor(0.1, 0.1, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  // Update leg target and joint
  const target = [0.5 + 0.2 * Math.sin(time), 0, 0.3];
  const result = solveIK3D(leg.base, target, leg.len1, leg.len2);
  leg.joint1 = result.joint1;
  leg.foot = result.foot;

  // View and projection setup
  const projection = Mat4.identity(); // Replace with real perspective later
  const view = Mat4.identity(); // Replace with real view matrix later

  gl.uniformMatrix4fv(uProjectionLoc, false, new Float32Array(projection));
  gl.uniformMatrix4fv(uViewLoc, false, new Float32Array(view));

  // Draw thigh
  drawSegment(leg.base, leg.joint1);

  // Draw shin
  drawSegment(leg.joint1, leg.foot);

  requestAnimationFrame(draw);
}

function drawSegment(p1, p2) {
  const transform = computeCylinderTransform(p1, p2);

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix4fv(uModelLoc, false, new Float32Array(transform));
  gl.drawArrays(gl.LINES, 0, 2);
}

function solveIK3D(base, target, len1, len2) {
  let dir = Vec3.subtract(target, base);
  dir[1] = 0;
  const dist = Math.min(Vec3.length(dir), len1 + len2);
  const angleToTarget = Math.atan2(dir[2], dir[0]);
  const angleA = Math.acos((len1**2 + dist**2 - len2**2) / (2 * len1 * dist));
  const totalAngle1 = angleToTarget - angleA;

  const joint1 = [
    base[0] + Math.cos(totalAngle1) * len1,
    base[1],
    base[2] + Math.sin(totalAngle1) * len1,
  ];

  return {
    joint1,
    foot: target
  };
}

function computeCylinderTransform(p1, p2) {
  const mid = Vec3.scale(Vec3.add(p1, p2), 0.5);
  const dir = Vec3.subtract(p2, p1);
  const len = Vec3.length(dir);
  let mat = Mat4.identity();
  mat = Mat4.translate(mat, mid);
  mat = Mat4.orientY(dir);
  mat = Mat4.scale(mat, [0.05, len / 2, 0.05]);
  return mat;
}

function resizeCanvas() {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

init();
