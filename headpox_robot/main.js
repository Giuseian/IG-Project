import { createShaderProgram, Vec3, Mat4 } from './utils/math.js';

let canvas, gl, program;
let positionBuffer, normalBuffer, indexBuffer;
let aPositionLoc, aNormalLoc, uModelLoc, uViewLoc, uProjectionLoc, uColorLoc, uLightDirLoc;

let time = 0;
let cameraAngle = 0; // Manual camera control instead of auto-rotation

const legs = [];
const legLength1 = 0.5;  // Longer upper leg
const legLength2 = 0.4;  // Lower leg

// Leg attachment points ON the robot body edges
const baseOffsets = [
  // Left side legs (attached to body edge)
  [-0.6, 0.15,  0.3],  // Left front
  [-0.6, 0.15,  0.0],  // Left middle  
  [-0.6, 0.15, -0.3],  // Left back
  // Right side legs (attached to body edge)
  [ 0.6, 0.15,  0.3],  // Right front
  [ 0.6, 0.15,  0.0],  // Right middle
  [ 0.6, 0.15, -0.3],  // Right back
];

// Initialize legs with realistic positioning
for (let i = 0; i < 6; i++) {
  legs.push({
    base: baseOffsets[i],
    len1: legLength1,
    len2: legLength2,
    joint1: [0, 0, 0],
    foot: [baseOffsets[i][0] * 1.8, -0.6, baseOffsets[i][2] * 1.5], // Initial foot position
    phase: (i % 2) * Math.PI, // Alternating phases for tripod gait
    group: i % 2, // 0 or 1 for tripod gait groups
  });
}

// Geometry generators (same as before)
function createCylinder(radius, height, segments = 12) {
  const vertices = [];
  const normals = [];
  const indices = [];
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    vertices.push(x, 0, z);
    normals.push(x, 0, z);
    
    vertices.push(x, height, z);
    normals.push(x, 0, z);
  }
  
  for (let i = 0; i < segments; i++) {
    const bottom1 = i * 2;
    const top1 = i * 2 + 1;
    const bottom2 = ((i + 1) % (segments + 1)) * 2;
    const top2 = ((i + 1) % (segments + 1)) * 2 + 1;
    
    indices.push(bottom1, top1, bottom2);
    indices.push(bottom2, top1, top2);
  }
  
  return { vertices, normals, indices };
}

function createBox(width, height, depth) {
  const w = width / 2, h = height / 2, d = depth / 2;
  
  const vertices = [
    -w, -h,  d,   w, -h,  d,   w,  h,  d,  -w,  h,  d,
    -w, -h, -d,  -w,  h, -d,   w,  h, -d,   w, -h, -d,
    -w,  h, -d,  -w,  h,  d,   w,  h,  d,   w,  h, -d,
    -w, -h, -d,   w, -h, -d,   w, -h,  d,  -w, -h,  d,
     w, -h, -d,   w,  h, -d,   w,  h,  d,   w, -h,  d,
    -w, -h, -d,  -w, -h,  d,  -w,  h,  d,  -w,  h, -d
  ];
  
  const normals = [
     0,  0,  1,   0,  0,  1,   0,  0,  1,   0,  0,  1,
     0,  0, -1,   0,  0, -1,   0,  0, -1,   0,  0, -1,
     0,  1,  0,   0,  1,  0,   0,  1,  0,   0,  1,  0,
     0, -1,  0,   0, -1,  0,   0, -1,  0,   0, -1,  0,
     1,  0,  0,   1,  0,  0,   1,  0,  0,   1,  0,  0,
    -1,  0,  0,  -1,  0,  0,  -1,  0,  0,  -1,  0,  0
  ];
  
  const indices = [
     0,  1,  2,   0,  2,  3,
     4,  5,  6,   4,  6,  7,
     8,  9, 10,   8, 10, 11,
    12, 13, 14,  12, 14, 15,
    16, 17, 18,  16, 18, 19,
    20, 21, 22,  20, 22, 23
  ];
  
  return { vertices, normals, indices };
}

function createSphere(radius, segments = 16) {
  const vertices = [];
  const normals = [];
  const indices = [];
  
  for (let lat = 0; lat <= segments; lat++) {
    const theta = (lat * Math.PI) / segments;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);
    
    for (let lon = 0; lon <= segments; lon++) {
      const phi = (lon * 2 * Math.PI) / segments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);
      
      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;
      
      vertices.push(x * radius, y * radius, z * radius);
      normals.push(x, y, z);
    }
  }
  
  for (let lat = 0; lat < segments; lat++) {
    for (let lon = 0; lon < segments; lon++) {
      const first = lat * (segments + 1) + lon;
      const second = first + segments + 1;
      
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }
  
  return { vertices, normals, indices };
}

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
  aNormalLoc = gl.getAttribLocation(program, 'aNormal');
  uModelLoc = gl.getUniformLocation(program, 'uModel');
  uViewLoc = gl.getUniformLocation(program, 'uView');
  uProjectionLoc = gl.getUniformLocation(program, 'uProjection');
  uColorLoc = gl.getUniformLocation(program, 'uColor');
  uLightDirLoc = gl.getUniformLocation(program, 'uLightDir');

  positionBuffer = gl.createBuffer();
  normalBuffer = gl.createBuffer();
  indexBuffer = gl.createBuffer();

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);

  // Add mouse controls for camera
  addCameraControls();

  requestAnimationFrame(draw);
}

function addCameraControls() {
  let isDragging = false;
  let lastMouseX = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMouseX;
      cameraAngle += deltaX * 0.01;
      lastMouseX = e.clientX;
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    switch(e.key) {
      case 'ArrowLeft':
        cameraAngle -= 0.1;
        break;
      case 'ArrowRight':
        cameraAngle += 0.1;
        break;
    }
  });
}

function draw(timestamp) {
  time = timestamp * 0.001;

  resizeCanvas();

  gl.clearColor(0.1, 0.1, 0.15, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  const aspect = canvas.width / canvas.height;
  const fov = Math.PI / 4;
  const near = 0.1;
  const far = 100;

  const projection = getPerspectiveMatrix(fov, aspect, near, far);
  
  // Fixed camera position (no auto-rotation)
  const cameraRadius = 4;
  const cameraHeight = 2.5;
  const cameraX = Math.cos(cameraAngle) * cameraRadius;
  const cameraZ = Math.sin(cameraAngle) * cameraRadius;
  
  const view = getLookAtMatrix(
    [cameraX, cameraHeight, cameraZ],
    [0, 0, 0],
    [0, 1, 0]
  );

  gl.uniformMatrix4fv(uProjectionLoc, false, new Float32Array(projection));
  gl.uniformMatrix4fv(uViewLoc, false, new Float32Array(view));
  gl.uniform3fv(uLightDirLoc, [0.5, 1.0, 0.3]);

  // Draw robot body first
  drawRobotBody();

  // Update and draw all legs with tripod gait
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    
    // Tripod gait animation
    const gaitSpeed = 1.5;
    const stepHeight = 0.3;
    const stepLength = 0.4;
    
    // Each group alternates
    const phaseOffset = leg.group * Math.PI;
    const gaitPhase = (time * gaitSpeed + phaseOffset) % (2 * Math.PI);
    
    // Determine if leg is in stance (supporting) or swing (moving) phase
    const isSwinging = gaitPhase < Math.PI;
    
    let targetX, targetY, targetZ;
    
    if (isSwinging) {
      // Swing phase - lift foot and move it forward
      const swingProgress = gaitPhase / Math.PI;
      const liftHeight = Math.sin(swingProgress * Math.PI) * stepHeight;
      const forwardProgress = (swingProgress - 0.5) * stepLength;
      
      targetX = leg.base[0] * 1.8 + forwardProgress;
      targetY = -0.6 + liftHeight;
      targetZ = leg.base[2] * 1.5;
    } else {
      // Stance phase - keep foot planted and move body forward
      const stanceProgress = (gaitPhase - Math.PI) / Math.PI;
      const backwardProgress = stanceProgress * stepLength;
      
      targetX = leg.base[0] * 1.8 + stepLength * 0.5 - backwardProgress;
      targetY = -0.6;
      targetZ = leg.base[2] * 1.5;
    }

    const target = [targetX, targetY, targetZ];

    // Solve IK for this leg
    const result = solveIK3D(leg.base, target, leg.len1, leg.len2);
    leg.joint1 = result.joint1;
    leg.foot = result.foot;

    // Different colors for left/right sides
    const legColor = i < 3 ? [0.8, 0.3, 0.2] : [0.2, 0.3, 0.8];
    
    // Draw leg segments - thicker for more realistic look
    drawCylinder(leg.base, leg.joint1, 0.05, legColor);
    drawCylinder(leg.joint1, leg.foot, 0.04, legColor);
    
    // Draw joints
    drawSphere(leg.base, 0.06, [0.4, 0.4, 0.4]);
    drawSphere(leg.joint1, 0.05, [0.3, 0.3, 0.3]);
    drawSphere(leg.foot, 0.04, [1.0, 0.8, 0.2]);
  }

  requestAnimationFrame(draw);
}

function drawRobotBody() {
  // Main chassis - bigger and more realistic
  const bodyGeometry = createBox(1.2, 0.3, 0.8);
  const bodyColor = [0.2, 0.2, 0.2];
  
  drawMesh(bodyGeometry, Mat4.translate(Mat4.identity(), [0, 0.15, 0]), bodyColor);
  
  // Top sensor platform
  const topGeometry = createBox(0.8, 0.1, 0.5);
  const topColor = [0.3, 0.3, 0.3];
  drawMesh(topGeometry, Mat4.translate(Mat4.identity(), [0, 0.35, 0]), topColor);
  
  // Front sensor dome
  const domeGeometry = createSphere(0.08, 12);
  const domeColor = [0.1, 0.6, 0.9];
  drawMesh(domeGeometry, Mat4.translate(Mat4.identity(), [0.4, 0.35, 0]), domeColor);
  
  // Side sensors
  drawMesh(domeGeometry, Mat4.translate(Mat4.identity(), [0, 0.35, 0.3]), [0.9, 0.2, 0.2]);
  drawMesh(domeGeometry, Mat4.translate(Mat4.identity(), [0, 0.35, -0.3]), [0.9, 0.2, 0.2]);
}

function drawCylinder(p1, p2, radius, color) {
  const cylinderGeometry = createCylinder(radius, 1, 16);
  const transform = computeCylinderTransform(p1, p2, radius);
  drawMesh(cylinderGeometry, transform, color);
}

function drawSphere(pos, radius, color) {
  const sphereGeometry = createSphere(radius, 12);
  const transform = Mat4.scale(Mat4.translate(Mat4.identity(), pos), [1, 1, 1]);
  drawMesh(sphereGeometry, transform, color);
}

function drawMesh(geometry, transform, color) {
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.vertices), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aNormalLoc);
  gl.vertexAttribPointer(aNormalLoc, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.DYNAMIC_DRAW);

  gl.uniformMatrix4fv(uModelLoc, false, new Float32Array(transform));
  gl.uniform3fv(uColorLoc, color);

  gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
}

function computeCylinderTransform(p1, p2, radius) {
  const mid = Vec3.scale(Vec3.add(p1, p2), 0.5);
  const dir = Vec3.subtract(p2, p1);
  const len = Vec3.length(dir);
  
  let mat = Mat4.identity();
  mat = Mat4.translate(mat, mid);
  
  if (len > 0.001) {
    const dirNorm = Vec3.normalize(dir);
    const up = [0, 1, 0];
    const right = Vec3.normalize(Vec3.cross(up, dirNorm));
    const forward = Vec3.cross(dirNorm, right);
    
    const rotMat = [
      right[0], dirNorm[0], forward[0], 0,
      right[1], dirNorm[1], forward[1], 0,
      right[2], dirNorm[2], forward[2], 0,
      0, 0, 0, 1
    ];
    
    mat = Mat4.multiply(mat, rotMat);
  }
  
  mat = Mat4.scale(mat, [radius, len, radius]);
  return mat;
}

function solveIK3D(base, target, len1, len2) {
  let dir = Vec3.subtract(target, base);
  const targetDist = Vec3.length(dir);
  
  const maxReach = len1 + len2;
  const minReach = Math.abs(len1 - len2);
  const clampedDist = Math.max(minReach, Math.min(maxReach * 0.95, targetDist));
  
  if (targetDist > 0.001) {
    dir = Vec3.scale(Vec3.normalize(dir), clampedDist);
  } else {
    dir = [clampedDist, 0, 0];
  }
  
  const clampedTarget = Vec3.add(base, dir);
  const planeDist = Vec3.length(dir);
  
  // Law of cosines for the angle at the base joint
  const cosAngle = (len1 * len1 + planeDist * planeDist - len2 * len2) / (2 * len1 * planeDist);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  
  // Calculate joint position
  const dirNorm = Vec3.normalize(dir);
  const joint1 = Vec3.add(base, Vec3.scale(dirNorm, len1 * Math.cos(angle)));
  
  // Add some Y offset for more natural leg bending
  joint1[1] += len1 * Math.sin(angle) * 0.5;

  return {
    joint1,
    foot: clampedTarget
  };
}

// Matrix multiplication utility
Mat4.multiply = function(a, b) {
  const result = new Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] = 
        a[i * 4 + 0] * b[0 * 4 + j] +
        a[i * 4 + 1] * b[1 * 4 + j] +
        a[i * 4 + 2] * b[2 * 4 + j] +
        a[i * 4 + 3] * b[3 * 4 + j];
    }
  }
  return result;
};

function resizeCanvas() {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;
  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

function getPerspectiveMatrix(fov, aspect, near, far) {
  const f = 1.0 / Math.tan(fov / 2);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0
  ];
}

function getLookAtMatrix(eye, center, up) {
  const f = Vec3.normalize(Vec3.subtract(center, eye));
  const s = Vec3.normalize(Vec3.cross(f, up));
  const u = Vec3.cross(s, f);

  return [
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -Vec3.dot(s, eye), -Vec3.dot(u, eye), Vec3.dot(f, eye), 1
  ];
}

init();