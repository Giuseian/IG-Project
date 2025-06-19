import { createShaderProgram, Vec3, Mat4 } from './utils/math.js';

let canvas, gl, program;
let positionBuffer, normalBuffer, indexBuffer;
let aPositionLoc, aNormalLoc, uModelLoc, uViewLoc, uProjectionLoc, uColorLoc, uLightDirLoc;

let time = 0;
let cameraAngle = 0;

const robot = {
  body: {
    position: [0, 0, 0],
    width: 1.0,
    height: 0.15,
    depth: 0.4
  },
  legs: []
};


// Create 6 legs attached to the robot body
function initializeRobot() {
  // Hip positions exactly on the body edges
  const bodyHalfWidth = robot.body.width / 2;
  const bodyHalfDepth = robot.body.depth / 2;
  const hipHeight = robot.body.height / 2;
  
  const legConfigs = [
    // Left side legs (x = -bodyHalfWidth)
    { side: 'left', position: [-bodyHalfWidth, hipHeight, bodyHalfDepth * 0.8] },    // Front
    { side: 'left', position: [-bodyHalfWidth, hipHeight, 0] },                     // Middle
    { side: 'left', position: [-bodyHalfWidth, hipHeight, -bodyHalfDepth * 0.8] },  // Back
    // Right side legs (x = +bodyHalfWidth)  
    { side: 'right', position: [bodyHalfWidth, hipHeight, bodyHalfDepth * 0.8] },   // Front
    { side: 'right', position: [bodyHalfWidth, hipHeight, 0] },                     // Middle
    { side: 'right', position: [bodyHalfWidth, hipHeight, -bodyHalfDepth * 0.8] },  // Back
  ];
  
  robot.legs = [];
  
  for (let i = 0; i < 6; i++) {
    const config = legConfigs[i];
    const sideMultiplier = config.side === 'left' ? -1 : 1;
    
    const hip = config.position;
    const foot = [
      hip[0] + sideMultiplier * 0.3, // Extend outward from body
      hip[1] - 0.25,                 // Down to ground
      hip[2]                         // Same Z as hip
    ];
    const knee = [
      hip[0] + sideMultiplier * 0.15, // Halfway outward
      (hip[1] + foot[1]) * 0.5,       // Halfway down
      hip[2]                          // Same Z
    ];
    
    robot.legs.push({
      id: i,
      side: config.side,
      hip: hip,
      knee: knee,
      foot: foot,
      color: config.side === 'left' ? [0.9, 0.2, 0.2] : [0.2, 0.2, 0.9]
    });
  }
}

function createBox(width, height, depth) {
  const w = width / 2, h = height / 2, d = depth / 2;
  
  const vertices = [
    // Front face
    -w, -h,  d,   w, -h,  d,   w,  h,  d,  -w,  h,  d,
    // Back face
    -w, -h, -d,  -w,  h, -d,   w,  h, -d,   w, -h, -d,
    // Top face
    -w,  h, -d,  -w,  h,  d,   w,  h,  d,   w,  h, -d,
    // Bottom face
    -w, -h, -d,   w, -h, -d,   w, -h,  d,  -w, -h,  d,
    // Right face
     w, -h, -d,   w,  h, -d,   w,  h,  d,   w, -h,  d,
    // Left face
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

function createSphere(radius, segments = 12) {
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
  try {
    canvas = document.getElementById('glcanvas');
    gl = canvas.getContext('webgl');

    if (!gl) {
      alert('WebGL not supported');
      return;
    }

    const vsSource = await fetch('./shaders/vertex.glsl').then(res => res.text());
    const fsSource = await fetch('./shaders/fragment.glsl').then(res => res.text());

    program = createShaderProgram(gl, vsSource, fsSource);
    if (!program) {
      console.error('Failed to create shader program');
      return;
    }
    
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

    // Initialize the robot
    initializeRobot();
    
    addControls();
    requestAnimationFrame(draw);
    
    console.log('Robot initialized with', robot.legs.length, 'legs');
    console.log('First leg hip position:', robot.legs[0].hip);
    
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

function addControls() {
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
}

function draw(timestamp) {
  try {
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
    
    const cameraRadius = 2.5;
    const cameraHeight = 1.5;
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

    // Draw robot
    drawRobot();

    requestAnimationFrame(draw);
  } catch (error) {
    console.error('Draw error:', error);
  }
}

function drawRobot() {
  // Draw main body
  const bodyGeometry = createBox(robot.body.width, robot.body.height, robot.body.depth);
  const bodyColor = [0.2, 0.2, 0.25];
  const bodyTransform = Mat4.translate(Mat4.identity(), robot.body.position);
  drawMesh(bodyGeometry, bodyTransform, bodyColor);
  
  // Draw top platform
  const topGeometry = createBox(robot.body.width * 0.7, robot.body.height * 0.5, robot.body.depth * 0.6);
  const topColor = [0.15, 0.15, 0.2];
  const topTransform = Mat4.translate(Mat4.identity(), [0, robot.body.height, 0]);
  drawMesh(topGeometry, topTransform, topColor);
  
  // Draw front sensor
  const sensorGeometry = createSphere(0.04);
  const sensorColor = [0.1, 0.7, 0.9];
  const sensorTransform = Mat4.translate(Mat4.identity(), [robot.body.width * 0.4, robot.body.height * 0.8, 0]);
  drawMesh(sensorGeometry, sensorTransform, sensorColor);
  
  // FIRST: Draw hip joints on the body to show attachment points
  for (let i = 0; i < robot.legs.length; i++) {
    const leg = robot.legs[i];
    drawSphere(leg.hip, 0.04, [0.7, 0.7, 0.7]); // Visible hip joints
  }
  
  // THEN: Draw all legs starting from those hip joints
  for (let i = 0; i < robot.legs.length; i++) {
    drawLeg(robot.legs[i]);
  }
}

function drawLeg(leg) {
  // DON'T draw hip joint again (already drawn in drawRobot)
  
  // Draw upper leg segment - MUST start exactly from leg.hip
  drawLine(leg.hip, leg.knee, leg.color, 0.03);
  
  // Draw knee joint
  drawSphere(leg.knee, 0.025, [0.4, 0.4, 0.4]);
  
  // Draw lower leg segment - from knee to foot
  drawLine(leg.knee, leg.foot, leg.color, 0.025);
  
  // Draw foot
  drawSphere(leg.foot, 0.035, [1.0, 0.8, 0.2]);
  
  // DEBUG: Print leg positions to console
  if (leg.id === 0) { // Only print first leg to avoid spam
    console.log(`Leg ${leg.id}: Hip=${leg.hip}, Knee=${leg.knee}, Foot=${leg.foot}`);
  }
}

function drawLine(p1, p2, color, thickness = 0.02) {
  const dir = Vec3.subtract(p2, p1);
  const len = Vec3.length(dir);
  
  if (len < 0.001) return;
  
  const mid = Vec3.scale(Vec3.add(p1, p2), 0.5);
  const lineGeometry = createBox(thickness, len, thickness);
  
  let transform = Mat4.translate(Mat4.identity(), mid);
  
  const dirNorm = Vec3.normalize(dir);
  if (Math.abs(dirNorm[1]) < 0.999) {
    const angle = Math.acos(Math.max(-1, Math.min(1, dirNorm[1])));
    const axis = Vec3.normalize(Vec3.cross([0, 1, 0], dirNorm));
    if (Vec3.length(axis) > 0.001) {
      transform = Mat4.multiply(transform, getRotationMatrix(axis, angle));
    }
  }
  
  drawMesh(lineGeometry, transform, color);
}

function drawSphere(pos, radius, color) {
  const sphereGeometry = createSphere(radius);
  const transform = Mat4.translate(Mat4.identity(), pos);
  drawMesh(sphereGeometry, transform, color);
}

function drawMesh(geometry, transform, color) {
  try {
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
  } catch (error) {
    console.error('Draw mesh error:', error);
  }
}

function getRotationMatrix(axis, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const [x, y, z] = axis;
  
  return [
    c + x*x*(1-c),   x*y*(1-c) - z*s, x*z*(1-c) + y*s, 0,
    y*x*(1-c) + z*s, c + y*y*(1-c),   y*z*(1-c) - x*s, 0,
    z*x*(1-c) - y*s, z*y*(1-c) + x*s, c + z*z*(1-c),   0,
    0,               0,               0,               1
  ];
}

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