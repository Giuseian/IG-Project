// Main application code - Clean version with working camera
let gl, program, canvas;
let animationRunning = true;
let time = 0;

// Camera controls
let cameraDistance = 8;
let cameraAngleX = 0.0; // Start level
let cameraAngleY = 0.0; // Start facing forward
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Robot parts
let robotBody, robotHead, robotLegs, ground, robotEyes;

// Matrix functions
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

function simpleInvert(out, matrix) {
    // Simple matrix inversion for our use case
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

function createCylinder(radius, height) {
    const segments = 12;
    const positions = [];
    const normals = [];
    const indices = [];
    
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Top vertex
        positions.push(x, height / 2, z);
        normals.push(x / radius, 0, z / radius);
        
        // Bottom vertex
        positions.push(x, -height / 2, z);
        normals.push(x / radius, 0, z / radius);
    }
    
    for (let i = 0; i < segments; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = ((i + 1) % (segments + 1)) * 2;
        const d = c + 1;
        
        indices.push(a, b, c);
        indices.push(b, d, c);
    }
    
    return createGeometry(
        new Float32Array(positions),
        new Float32Array(normals),
        new Uint16Array(indices)
    );
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
    robotBody = createCube(2, 0.8, 1.2);
    robotHead = createCube(0.6, 0.6, 0.6);
    robotEyes = [
        createCube(0.1, 0.1, 0.1),
        createCube(0.1, 0.1, 0.1)
    ];
    robotLegs = [
        createCylinder(0.1, 1.2),
        createCylinder(0.1, 1.2),
        createCylinder(0.1, 1.2),
        createCylinder(0.1, 1.2)
    ];
    ground = createCube(20, 0.2, 20);
    console.log('Robot parts created');
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
    translate(groundMatrix, groundMatrix, [0, -1.5, 0]);
    renderPart(ground, groundMatrix, [0.2, 0.5, 0.2]);
    
    // Render robot body
    const bodyMatrix = createMatrix4();
    identity(bodyMatrix);
    renderPart(robotBody, bodyMatrix, [0.3, 0.5, 0.8]);
    
    // Render robot head
    const headMatrix = createMatrix4();
    identity(headMatrix);
    translate(headMatrix, headMatrix, [0, 0.8, 0]);
    renderPart(robotHead, headMatrix, [0.5, 0.7, 1.0]);
    
    // Render robot eyes
    const eyePositions = [
        [-0.15, 0.9, 0.25],
        [0.15, 0.9, 0.25]
    ];
    
    robotEyes.forEach((eye, i) => {
        const eyeMatrix = createMatrix4();
        identity(eyeMatrix);
        translate(eyeMatrix, eyeMatrix, eyePositions[i]);
        renderPart(eye, eyeMatrix, [0.1, 0.8, 0.1]);
    });
    
    // Render robot legs with animation
    const legPositions = [
        [-0.5, -0.8, 0.3],   // front left
        [0.5, -0.8, 0.3],    // front right
        [-0.5, -0.8, -0.3],  // back left
        [0.5, -0.8, -0.3]    // back right
    ];
    
    robotLegs.forEach((leg, i) => {
        const legMatrix = createMatrix4();
        identity(legMatrix);
        translate(legMatrix, legMatrix, legPositions[i]);
        
        // Walking animation
        const legPhase = time * 2 + (i % 2) * Math.PI;
        const legRotation = Math.sin(legPhase) * 0.3;
        rotateX(legMatrix, legMatrix, legRotation);
        
        renderPart(leg, legMatrix, [0.2, 0.3, 0.6]);
    });
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
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        canvas.style.cursor = 'grabbing';
        console.log('Mouse down - starting drag');
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            
            // Horizontal rotation (left/right mouse movement)
            cameraAngleY -= deltaX * 0.01; // Negative for natural rotation
            
            // Vertical rotation (up/down mouse movement)
            cameraAngleX -= deltaY * 0.01; // Negative for natural rotation
            
            // Clamp vertical rotation to prevent flipping
            cameraAngleX = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, cameraAngleX));
            
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });
    
    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
        console.log('Mouse up - stopped dragging');
    });
    
    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        cameraDistance += e.deltaY * 0.01;
        cameraDistance = Math.max(2, Math.min(20, cameraDistance));
        console.log('Zoom:', cameraDistance);
    });
    
    // Set initial cursor
    canvas.style.cursor = 'grab';
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
    
    // Proper orbit camera - calculate camera position
    const cameraX = Math.cos(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    const cameraY = Math.sin(cameraAngleX) * cameraDistance;
    const cameraZ = Math.sin(cameraAngleY) * Math.cos(cameraAngleX) * cameraDistance;
    
    // Target point (where we're looking)
    const targetX = 0;
    const targetY = 0;
    const targetZ = 0;
    
    // Calculate look direction
    const lookX = targetX - cameraX;
    const lookY = targetY - cameraY;
    const lookZ = targetZ - cameraZ;
    
    // Normalize look direction
    const lookLength = Math.sqrt(lookX * lookX + lookY * lookY + lookZ * lookZ);
    const lookXNorm = lookX / lookLength;
    const lookYNorm = lookY / lookLength;
    const lookZNorm = lookZ / lookLength;
    
    // Up vector
    const upX = 0, upY = 1, upZ = 0;
    
    // Right vector (cross product of look and up)
    const rightX = lookYNorm * upZ - lookZNorm * upY;
    const rightY = lookZNorm * upX - lookXNorm * upZ;
    const rightZ = lookXNorm * upY - lookYNorm * upX;
    
    // Recalculate up vector (cross product of right and look)
    const upXNew = rightY * lookZNorm - rightZ * lookYNorm;
    const upYNew = rightZ * lookXNorm - rightX * lookZNorm;
    const upZNew = rightX * lookYNorm - rightY * lookXNorm;
    
    // Build view matrix
    identity(viewMatrix);
    
    // Rotation part
    viewMatrix[0] = rightX;
    viewMatrix[1] = upXNew;
    viewMatrix[2] = -lookXNorm;
    viewMatrix[3] = 0;
    
    viewMatrix[4] = rightY;
    viewMatrix[5] = upYNew;
    viewMatrix[6] = -lookYNorm;
    viewMatrix[7] = 0;
    
    viewMatrix[8] = rightZ;
    viewMatrix[9] = upZNew;
    viewMatrix[10] = -lookZNorm;
    viewMatrix[11] = 0;
    
    // Translation part
    viewMatrix[12] = -(rightX * cameraX + rightY * cameraY + rightZ * cameraZ);
    viewMatrix[13] = -(upXNew * cameraX + upYNew * cameraY + upZNew * cameraZ);
    viewMatrix[14] = -(-lookXNorm * cameraX + -lookYNorm * cameraY + -lookZNorm * cameraZ);
    viewMatrix[15] = 1;
    
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_viewMatrix'), false, viewMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_projectionMatrix'), false, projectionMatrix);
    
    gl.uniform3fv(gl.getUniformLocation(program, 'u_lightPosition'), [5, 10, 5]);
    gl.uniform3fv(gl.getUniformLocation(program, 'u_cameraPosition'), [cameraX, cameraY, cameraZ]);
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    if (animationRunning) {
        time += 0.016;
    }
    
    updateCamera();
    renderRobot();
    
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