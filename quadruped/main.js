// Main application code - Fixed matrix functions
let gl, program, canvas;
let animationRunning = true;
let time = 0;

// Camera controls
let cameraDistance = 8;
let cameraAngleX = 0.0;
let cameraAngleY = 0.0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Robot parts
let robotBody, robotHead, robotEyes, robotNose, robotTail;
let robotUpperLegs, robotLowerLegs, robotFeet;
let ground;

// Matrix functions - properly structured
function createMatrix4() {
    return new Float32Array(16);
}

function identity(out) {
    out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
    return out;
}

function translate(out, a, v) {
    const x = v[0], y = v[1], z = v[2];
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
    out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
    out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    return out;
}

function rotateX(out, a, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    
    out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
    out[4] = a10 * c + a20 * s;
    out[5] = a11 * c + a21 * s;
    out[6] = a12 * c + a22 * s;
    out[7] = a13 * c + a23 * s;
    out[8] = a20 * c - a10 * s;
    out[9] = a21 * c - a11 * s;
    out[10] = a22 * c - a12 * s;
    out[11] = a23 * c - a13 * s;
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    return out;
}

function rotateY(out, a, rad) {
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    
    out[0] = a00 * c - a20 * s;
    out[1] = a01 * c - a21 * s;
    out[2] = a02 * c - a22 * s;
    out[3] = a03 * c - a23 * s;
    out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
    out[8] = a00 * s + a20 * c;
    out[9] = a01 * s + a21 * c;
    out[10] = a02 * s + a22 * c;
    out[11] = a03 * s + a23 * c;
    out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15];
    return out;
}

function simpleInvert(out, matrix) {
    for (let i = 0; i < 16; i++) {
        out[i] = matrix[i];
    }
    return out;
}

// Shaders
const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_modelMatrix;
    uniform mat4 u_normalMatrix;
    
    varying vec3 v_normal;
    varying vec3 v_position;
    
    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
        
        v_normal = mat3(u_normalMatrix) * a_normal;
        v_position = worldPosition.xyz;
    }
`;

const fragmentShaderSource = `
    precision mediump float;
    
    varying vec3 v_normal;
    varying vec3 v_position;
    
    uniform vec3 u_color;
    uniform vec3 u_lightPosition;
    uniform vec3 u_cameraPosition;
    
    void main() {
        vec3 normal = normalize(v_normal);
        vec3 lightDirection = normalize(u_lightPosition - v_position);
        
        float ambient = 0.3;
        float diffuse = max(dot(normal, lightDirection), 0.0);
        
        float lighting = ambient + diffuse;
        gl_FragColor = vec4(u_color * lighting, 1.0);
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    console.log('Shader compiled successfully:', type === gl.VERTEX_SHADER ? 'vertex' : 'fragment');
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program link error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    
    console.log('Shader program linked successfully');
    return program;
}

// Geometry functions
function createCube(width, height, depth) {
    const w = width / 2, h = height / 2, d = depth / 2;
    
    const positions = new Float32Array([
        // Front face
        -w, -h,  d,  w, -h,  d,  w,  h,  d, -w,  h,  d,
        // Back face
        -w, -h, -d, -w,  h, -d,  w,  h, -d,  w, -h, -d,
        // Top face
        -w,  h, -d, -w,  h,  d,  w,  h,  d,  w,  h, -d,
        // Bottom face
        -w, -h, -d,  w, -h, -d,  w, -h,  d, -w, -h,  d,
        // Right face
         w, -h, -d,  w,  h, -d,  w,  h,  d,  w, -h,  d,
        // Left face
        -w, -h, -d, -w, -h,  d, -w,  h,  d, -w,  h, -d
    ]);
    
    const normals = new Float32Array([
        // Front face
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        // Back face
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // Top face
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        // Bottom face
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
        // Right face
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // Left face
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0
    ]);
    
    const indices = new Uint16Array([
        0, 1, 2, 0, 2, 3,       // front
        4, 5, 6, 4, 6, 7,       // back
        8, 9, 10, 8, 10, 11,    // top
        12, 13, 14, 12, 14, 15, // bottom
        16, 17, 18, 16, 18, 19, // right
        20, 21, 22, 20, 22, 23  // left
    ]);
    
    return createGeometry(positions, normals, indices);
}

function createGeometry(positions, normals, indices) {
    return {
        vertexBuffer: createBuffer(positions),
        normalBuffer: createBuffer(normals),
        indexBuffer: createIndexBuffer(indices),
        indexCount: indices.length
    };
}

function createBuffer(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

function createIndexBuffer(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

function createRobotParts() {
    // More realistic proportions
    robotBody = createCube(1.5, 0.6, 0.8);
    robotHead = createCube(0.4, 0.35, 0.5);
    
    // Eyes and nose
    robotEyes = [
        createCube(0.08, 0.08, 0.08),
        createCube(0.08, 0.08, 0.08)
    ];
    robotNose = createCube(0.06, 0.04, 0.08);
    
    // Realistic leg structure
    robotUpperLegs = [
        createCube(0.12, 0.5, 0.12),
        createCube(0.12, 0.5, 0.12),
        createCube(0.12, 0.5, 0.12),
        createCube(0.12, 0.5, 0.12)
    ];
    
    robotLowerLegs = [
        createCube(0.08, 0.4, 0.08),
        createCube(0.08, 0.4, 0.08),
        createCube(0.08, 0.4, 0.08),
        createCube(0.08, 0.4, 0.08)
    ];
    
    robotFeet = [
        createCube(0.15, 0.08, 0.25),
        createCube(0.15, 0.08, 0.25),
        createCube(0.15, 0.08, 0.25),
        createCube(0.15, 0.08, 0.25)
    ];
    
    // Tail
    robotTail = createCube(0.06, 0.06, 0.3);
    
    // Ground
    ground = createCube(20, 0.2, 20);
    
    console.log('Realistic robot parts created');
}

function renderPart(part, modelMatrix, color) {
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_modelMatrix'), false, modelMatrix);
    
    const normalMatrix = createMatrix4();
    simpleInvert(normalMatrix, modelMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_normalMatrix'), false, normalMatrix);
    
    gl.uniform3fv(gl.getUniformLocation(program, 'u_color'), color);
    
    // Bind position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, part.vertexBuffer);
    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(positionLocation);
    
    // Bind normal buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, part.normalBuffer);
    const normalLocation = gl.getAttribLocation(program, 'a_normal');
    gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(normalLocation);
    
    // Bind index buffer and draw
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part.indexBuffer);
    gl.drawElements(gl.TRIANGLES, part.indexCount, gl.UNSIGNED_SHORT, 0);
}

function renderRobot() {
    // Render ground
    const groundMatrix = createMatrix4();
    identity(groundMatrix);
    translate(groundMatrix, groundMatrix, [0, -1.2, 0]);
    renderPart(ground, groundMatrix, [0.15, 0.4, 0.15]);
    
    // Render robot body
    const bodyMatrix = createMatrix4();
    identity(bodyMatrix);
    renderPart(robotBody, bodyMatrix, [0.2, 0.3, 0.5]);
    
    // Render robot head
    const headMatrix = createMatrix4();
    identity(headMatrix);
    translate(headMatrix, headMatrix, [0.6, 0.1, 0]);
    renderPart(robotHead, headMatrix, [0.3, 0.4, 0.6]);
    
    // Render robot eyes
    const eyePositions = [
        [0.8, 0.15, -0.12],
        [0.8, 0.15, 0.12]
    ];
    
    robotEyes.forEach((eye, i) => {
        const eyeMatrix = createMatrix4();
        identity(eyeMatrix);
        translate(eyeMatrix, eyeMatrix, eyePositions[i]);
        renderPart(eye, eyeMatrix, [0.1, 0.8, 0.1]);
    });
    
    // Render nose
    const noseMatrix = createMatrix4();
    identity(noseMatrix);
    translate(noseMatrix, noseMatrix, [0.85, 0.05, 0]);
    renderPart(robotNose, noseMatrix, [0.1, 0.1, 0.1]);
    
    // Render tail (with simple animation)
    const tailMatrix = createMatrix4();
    identity(tailMatrix);
    translate(tailMatrix, tailMatrix, [-0.8, 0.2, 0]);
    const tailWag = Math.sin(time * 3) * 0.2;
    rotateY(tailMatrix, tailMatrix, tailWag);
    renderPart(robotTail, tailMatrix, [0.25, 0.35, 0.55]);
    
    // Render simplified legs
    const legPositions = [
        [0.4, -0.5, -0.3],   // front left
        [0.4, -0.5, 0.3],    // front right
        [-0.4, -0.5, -0.3],  // back left
        [-0.4, -0.5, 0.3]    // back right
    ];
    
    // Simple leg animation
    for (let i = 0; i < 4; i++) {
        const legMatrix = createMatrix4();
        identity(legMatrix);
        translate(legMatrix, legMatrix, legPositions[i]);
        
        const legPhase = time * 1.5 + (i % 2) * Math.PI;
        const legRotation = Math.sin(legPhase) * 0.3;
        rotateX(legMatrix, legMatrix, legRotation);
        
        renderPart(robotUpperLegs[i], legMatrix, [0.15, 0.25, 0.4]);
    }
}

function init() {
    console.log('Starting initialization...');
    
    canvas = document.getElementById('canvas');
    gl = canvas.getContext('webgl');
    
    if (!gl) {
        alert('WebGL not supported');
        return;
    }
    
    console.log('WebGL context created');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setupWebGL();
    setupShaders();
    setupControls();
    createRobotParts();
    
    render();
}

function setupWebGL() {
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.1, 0.2, 0.4, 1.0);
}

function setupShaders() {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
        console.error('Failed to create shaders');
        return;
    }
    
    program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) {
        console.error('Failed to create program');
        return;
    }
    
    gl.useProgram(program);
    console.log('Shaders setup complete');
}

function setupControls() {
    console.log('Setting up controls...');
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
        console.log('Mouse DOWN at:', e.clientX, e.clientY);
        e.preventDefault();
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            
            cameraAngleY += deltaX * 0.01;
            cameraAngleX += deltaY * 0.01;
            cameraAngleX = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, cameraAngleX));
            
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
        e.preventDefault();
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'grab';
            console.log('Mouse UP - stopped dragging');
        }
    });
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        cameraDistance += e.deltaY * 0.01;
        cameraDistance = Math.max(2, Math.min(20, cameraDistance));
        console.log('Zoom:', cameraDistance.toFixed(1));
    });
    
    canvas.style.cursor = 'grab';
    console.log('Controls setup complete');
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

function updateCamera() {
    const projectionMatrix = createMatrix4();
    const viewMatrix = createMatrix4();
    
    // Perspective matrix
    const aspect = canvas.width / canvas.height;
    const fov = 45 * Math.PI / 180;
    const near = 0.1;
    const far = 100;
    
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1 / (near - far);
    
    identity(projectionMatrix);
    projectionMatrix[0] = f / aspect;
    projectionMatrix[5] = f;
    projectionMatrix[10] = (far + near) * rangeInv;
    projectionMatrix[11] = -1;
    projectionMatrix[14] = near * far * rangeInv * 2;
    projectionMatrix[15] = 0;
    
    // Camera position using spherical coordinates
    const cameraX = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    const cameraY = Math.sin(cameraAngleX) * cameraDistance;
    const cameraZ = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    
    const eye = [cameraX, cameraY, cameraZ];
    const target = [0, 0, 0];
    const up = [0, 1, 0];
    
    // Build view matrix
    const zAxis = [
        eye[0] - target[0],
        eye[1] - target[1], 
        eye[2] - target[2]
    ];
    const zLength = Math.sqrt(zAxis[0] * zAxis[0] + zAxis[1] * zAxis[1] + zAxis[2] * zAxis[2]);
    zAxis[0] /= zLength;
    zAxis[1] /= zLength;
    zAxis[2] /= zLength;
    
    const xAxis = [
        up[1] * zAxis[2] - up[2] * zAxis[1],
        up[2] * zAxis[0] - up[0] * zAxis[2],
        up[0] * zAxis[1] - up[1] * zAxis[0]
    ];
    const xLength = Math.sqrt(xAxis[0] * xAxis[0] + xAxis[1] * xAxis[1] + xAxis[2] * xAxis[2]);
    xAxis[0] /= xLength;
    xAxis[1] /= xLength;
    xAxis[2] /= xLength;
    
    const yAxis = [
        zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
        zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
        zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0]
    ];
    
    identity(viewMatrix);
    viewMatrix[0] = xAxis[0];
    viewMatrix[1] = yAxis[0];
    viewMatrix[2] = zAxis[0];
    viewMatrix[4] = xAxis[1];
    viewMatrix[5] = yAxis[1];
    viewMatrix[6] = zAxis[1];
    viewMatrix[8] = xAxis[2];
    viewMatrix[9] = yAxis[2];
    viewMatrix[10] = zAxis[2];
    viewMatrix[12] = -(xAxis[0] * eye[0] + xAxis[1] * eye[1] + xAxis[2] * eye[2]);
    viewMatrix[13] = -(yAxis[0] * eye[0] + yAxis[1] * eye[1] + yAxis[2] * eye[2]);
    viewMatrix[14] = -(zAxis[0] * eye[0] + zAxis[1] * eye[1] + zAxis[2] * eye[2]);
    viewMatrix[15] = 1;
    
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_viewMatrix'), false, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_projectionMatrix'), false, projectionMatrix);
    
    gl.uniform3fv(gl.getUniformLocation(program, 'u_lightPosition'), [5, 10, 5]);
    gl.uniform3fv(gl.getUniformLocation(program, 'u_cameraPosition'), [cameraX, cameraY, cameraZ]);
}

function render() {
    try {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        
        if (animationRunning) {
            time += 0.016;
        }
        
        updateCamera();
        renderRobot();
    } catch (error) {
        console.error('Render error:', error);
        animationRunning = false;
    }
    
    requestAnimationFrame(render);
}

// Control functions
function toggleAnimation() {
    animationRunning = !animationRunning;
    console.log('Animation toggled:', animationRunning);
}

function resetCamera() {
    cameraDistance = 8;
    cameraAngleX = 0.0;
    cameraAngleY = 0.0;
    console.log('Camera reset');
}

function changeGait(gait) {
    console.log('Gait changed to:', gait);
}

window.addEventListener('load', init);