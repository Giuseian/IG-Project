// Load shaders (use bundler or manually inline if not using module loader)
import vertexShaderSource from './vertex.glsl?raw';
import fragmentShaderSource from './fragment.glsl?raw';

const canvas = document.getElementById("glcanvas");
const gl = canvas.getContext("webgl");

if (!gl) throw new Error("WebGL not supported");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0.1, 0.1, 0.1, 1);

// === Shader Compilation ===
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
  }
  return shader;
}

function createProgram(gl, vertexSrc, fragmentSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
  }
  return program;
}

// === IK Solver ===
function solveIK(base, target, len1, len2) {
  const dx = target[0] - base[0];
  const dy = target[1] - base[1];
  const dist = Math.min(Math.hypot(dx, dy), len1 + len2);

  const angleA = Math.acos((len1**2 + dist**2 - len2**2) / (2 * len1 * dist));
  const angleB = Math.atan2(dy, dx);

  const joint = [
    base[0] + len1 * Math.cos(angleB - angleA),
    base[1] + len1 * Math.sin(angleB - angleA)
  ];

  return { joint, foot: target };
}

// === Animate Target ===
function animateTarget(t) {
  return [Math.sin(t * 0.001) * 0.5, -0.5];
}

// === Drawing Line ===
function drawLine(gl, program, a_position, u_matrix, u_color, p1, p2, color) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...p1, ...p2]), gl.STATIC_DRAW);

  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix3fv(u_matrix, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
  gl.uniform4fv(u_color, color);

  gl.drawArrays(gl.LINES, 0, 2);
}

// === Main Program ===
const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
gl.useProgram(program);

const a_position = gl.getAttribLocation(program, 'a_position');
const u_matrix = gl.getUniformLocation(program, 'u_matrix');
const u_color = gl.getUniformLocation(program, 'u_color');

const base = [0, 0];
const len1 = 0.5, len2 = 0.5;

function render(time) {
  gl.clear(gl.COLOR_BUFFER_BIT);

  const foot = animateTarget(time);
  const { joint } = solveIK(base, foot, len1, len2);

  drawLine(gl, program, a_position, u_matrix, u_color, base, joint, [0.8, 0.2, 0.2, 1]);
  drawLine(gl, program, a_position, u_matrix, u_color, joint, foot, [0.2, 0.8, 0.2, 1]);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
