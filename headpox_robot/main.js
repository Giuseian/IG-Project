import { createShaderProgram, Vec3, Mat4 } from './utils/math.js';

let canvas, gl, program;
let positionBuffer;
let aPositionLoc, uModelLoc, uViewLoc, uProjectionLoc, uColorLoc;

let time = 0;

const legs = [];
const legLength1 = 0.4;
const legLength2 = 0.4;

// Better positioned leg bases in a hexagon pattern
const baseOffsets = [
  [-0.4, 0,  0.2],  // Left front
  [-0.4, 0,  0.0],  // Left middle  
  [-0.4, 0, -0.2],  // Left back
  [ 0.4, 0,  0.2],  // Right front
  [ 0.4, 0,  0.0],  // Right middle
  [ 0.4, 0, -0.2],  // Right back
];

// Initialize legs with proper spacing
for (let i = 0; i < 6; i++) {
  legs.push({
    base: baseOffsets[i],
    len1: legLength1,
    len2: legLength2,
    joint1: [0, 0, 0],
    foot: [baseOffsets[i][0] + (i < 3 ? -0.6 : 0.6), -0.3, baseOffsets[i][2]],
    phase: i % 2 === 0 ? 0 : Math.PI, // Alternating phase for tripod gait
  });
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
  uModelLoc = gl.getUniformLocation(program, 'uModel');
  uViewLoc = gl.getUniformLocation(program, 'uView');
  uProjectionLoc = gl.getUniformLocation(program, 'uProjection');
  uColorLoc = gl.getUniformLocation(program, 'uColor');

  positionBuffer = gl.createBuffer();

  gl.enable(gl.DEPTH_TEST);
  gl.lineWidth(3.0); // Make lines thicker if supported

  requestAnimationFrame(draw);
}

function draw(timestamp) {
  time = timestamp * 0.001;

  resizeCanvas();

  gl.clearColor(0.1, 0.1, 0.1, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.useProgram(program);

  const aspect = canvas.width / canvas.height;
  const fov = Math.PI / 4;
  const near = 0.1;
  const far = 100;

  const projection = getPerspectiveMatrix(fov, aspect, near, far);
  
  // Better camera position to see all legs
  const view = getLookAtMatrix(
    [2, 2, 2],    // Camera position - further back and higher
    [0, 0, 0],    // Look at center
    [0, 1, 0]     // Up vector
  );

  gl.uniformMatrix4fv(uProjectionLoc, false, new Float32Array(projection));
  gl.uniformMatrix4fv(uViewLoc, false, new Float32Array(view));

  // Draw robot body (simple box)
  drawBody();

  // Update and draw all legs
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    
    // Animate foot position with lifting motion
    const wave = 0.3 * Math.sin(time * 2 + leg.phase);
    const lift = Math.max(0, 0.2 * Math.sin(time * 2 + leg.phase)); // Only positive lift
    
    const target = [
      leg.base[0] + (i < 3 ? -0.6 : 0.6) + wave * 0.2, // Side offset + small wave
      -0.3 + lift, // Ground level + lift
      leg.base[2] + wave * 0.1 // Small forward/back motion
    ];

    // Solve IK for this leg
    const result = solveIK3D(leg.base, target, leg.len1, leg.len2);
    leg.joint1 = result.joint1;
    leg.foot = result.foot;

    // Color legs differently for left/right sides
    const legColor = i < 3 ? [1.0, 0.3, 0.3] : [0.3, 0.3, 1.0]; // Red for left, blue for right
    
    // Draw upper leg segment
    drawSegment(leg.base, leg.joint1, legColor);
    
    // Draw lower leg segment  
    drawSegment(leg.joint1, leg.foot, legColor);
    
    // Draw foot dot
    drawPoint(leg.foot, [1.0, 1.0, 0.0]); // Yellow foot
  }

  requestAnimationFrame(draw);
}

function drawBody() {
  // Draw a simple rectangular body
  const bodyVertices = [
    // Body outline as lines
    -0.3, 0.1, -0.3,   0.3, 0.1, -0.3,  // Back edge
     0.3, 0.1, -0.3,   0.3, 0.1,  0.3,  // Right edge  
     0.3, 0.1,  0.3,  -0.3, 0.1,  0.3,  // Front edge
    -0.3, 0.1,  0.3,  -0.3, 0.1, -0.3,  // Left edge
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(bodyVertices), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix4fv(uModelLoc, false, new Float32Array(Mat4.identity()));
  gl.uniform3fv(uColorLoc, [0.8, 0.8, 0.8]); // Gray body
  
  gl.drawArrays(gl.LINES, 0, 8);
}

function drawSegment(p1, p2, color) {
  const vertices = [
    p1[0], p1[1], p1[2],
    p2[0], p2[1], p2[2]
  ];

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix4fv(uModelLoc, false, new Float32Array(Mat4.identity()));
  gl.uniform3fv(uColorLoc, color);
  
  gl.drawArrays(gl.LINES, 0, 2);
}

function drawPoint(pos, color) {
  const vertices = [pos[0], pos[1], pos[2]];

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPositionLoc);
  gl.vertexAttribPointer(aPositionLoc, 3, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix4fv(uModelLoc, false, new Float32Array(Mat4.identity()));
  gl.uniform3fv(uColorLoc, color);
  
  gl.drawArrays(gl.POINTS, 0, 1);
}

function solveIK3D(base, target, len1, len2) {
  // Get direction to target (ignoring Y for now, solve in XZ plane first)
  let dir = Vec3.subtract(target, base);
  const targetDist = Vec3.length(dir);
  
  // Clamp target to reachable distance
  const maxReach = len1 + len2;
  const minReach = Math.abs(len1 - len2);
  const clampedDist = Math.max(minReach, Math.min(maxReach * 0.99, targetDist));
  
  if (targetDist > 0) {
    dir = Vec3.scale(Vec3.normalize(dir), clampedDist);
  } else {
    dir = [len1 + len2, 0, 0]; // Default extension
  }
  
  const clampedTarget = Vec3.add(base, dir);
  
  // Solve 2D IK in the plane from base to target
  const planeDist = Vec3.length(dir);
  
  // Law of cosines to find joint angle
  const cosAngle = (len1 * len1 + planeDist * planeDist - len2 * len2) / (2 * len1 * planeDist);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  
  // Direction from base to target
  const dirNorm = Vec3.normalize(dir);
  
  // Rotate the first segment by the calculated angle
  // For 3D, we need to rotate around the axis perpendicular to our plane
  const joint1Dir = Vec3.scale(dirNorm, len1);
  
  // Simple approach: lift the joint slightly for more natural look
  const lift = 0.1 * Math.sin(angle * 2); // Slight upward bend
  const joint1 = [
    base[0] + joint1Dir[0] * Math.cos(angle),
    base[1] + lift,
    base[2] + joint1Dir[2] * Math.cos(angle)
  ];

  return {
    joint1,
    foot: clampedTarget
  };
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