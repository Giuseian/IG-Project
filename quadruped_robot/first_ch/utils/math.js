// Mathematical utilities for 3D graphics

// Vector3 operations
function vec3Add(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vec3Subtract(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vec3Scale(v, s) {
    return [v[0] * s, v[1] * s, v[2] * s];
}

function vec3Length(v) {
    return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function vec3Normalize(v) {
    const len = vec3Length(v);
    if (len === 0) return [0, 0, 0];
    return [v[0] / len, v[1] / len, v[2] / len];
}

function vec3Dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vec3Cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// Matrix4 operations (column-major order)
function mat4Identity() {
    return [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
}

function mat4Translate(mat, x, y, z) {
    mat[12] += mat[0] * x + mat[4] * y + mat[8] * z;
    mat[13] += mat[1] * x + mat[5] * y + mat[9] * z;
    mat[14] += mat[2] * x + mat[6] * y + mat[10] * z;
    mat[15] += mat[3] * x + mat[7] * y + mat[11] * z;
}

function mat4Scale(mat, x, y, z) {
    mat[0] *= x; mat[1] *= x; mat[2] *= x; mat[3] *= x;
    mat[4] *= y; mat[5] *= y; mat[6] *= y; mat[7] *= y;
    mat[8] *= z; mat[9] *= z; mat[10] *= z; mat[11] *= z;
}

function mat4Multiply(a, b) {
    const result = new Array(16);
    
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            result[i * 4 + j] = 0;
            for (let k = 0; k < 4; k++) {
                result[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
            }
        }
    }
    
    // Copy result back to matrix a
    for (let i = 0; i < 16; i++) {
        a[i] = result[i];
    }
}

function mat4Perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    
    return [
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0
    ];
}

function mat4LookAt(eye, center, up) {
    const f = vec3Normalize(vec3Subtract(center, eye));
    const s = vec3Normalize(vec3Cross(f, up));
    const u = vec3Cross(s, f);
    
    return [
        s[0], u[0], -f[0], 0,
        s[1], u[1], -f[1], 0,
        s[2], u[2], -f[2], 0,
        -vec3Dot(s, eye), -vec3Dot(u, eye), vec3Dot(f, eye), 1
    ];
}

function mat4Inverse(mat) {
    const inv = new Array(16);
    
    inv[0] = mat[5] * mat[10] * mat[15] - mat[5] * mat[11] * mat[14] - mat[9] * mat[6] * mat[15] + mat[9] * mat[7] * mat[14] + mat[13] * mat[6] * mat[11] - mat[13] * mat[7] * mat[10];
    inv[4] = -mat[4] * mat[10] * mat[15] + mat[4] * mat[11] * mat[14] + mat[8] * mat[6] * mat[15] - mat[8] * mat[7] * mat[14] - mat[12] * mat[6] * mat[11] + mat[12] * mat[7] * mat[10];
    inv[8] = mat[4] * mat[9] * mat[15] - mat[4] * mat[11] * mat[13] - mat[8] * mat[5] * mat[15] + mat[8] * mat[7] * mat[13] + mat[12] * mat[5] * mat[11] - mat[12] * mat[7] * mat[9];
    inv[12] = -mat[4] * mat[9] * mat[14] + mat[4] * mat[10] * mat[13] + mat[8] * mat[5] * mat[14] - mat[8] * mat[6] * mat[13] - mat[12] * mat[5] * mat[10] + mat[12] * mat[6] * mat[9];
    inv[1] = -mat[1] * mat[10] * mat[15] + mat[1] * mat[11] * mat[14] + mat[9] * mat[2] * mat[15] - mat[9] * mat[3] * mat[14] - mat[13] * mat[2] * mat[11] + mat[13] * mat[3] * mat[10];
    inv[5] = mat[0] * mat[10] * mat[15] - mat[0] * mat[11] * mat[14] - mat[8] * mat[2] * mat[15] + mat[8] * mat[3] * mat[14] + mat[12] * mat[2] * mat[11] - mat[12] * mat[3] * mat[10];
    inv[9] = -mat[0] * mat[9] * mat[15] + mat[0] * mat[11] * mat[13] + mat[8] * mat[1] * mat[15] - mat[8] * mat[3] * mat[13] - mat[12] * mat[1] * mat[11] + mat[12] * mat[3] * mat[9];
    inv[13] = mat[0] * mat[9] * mat[14] - mat[0] * mat[10] * mat[13] - mat[8] * mat[1] * mat[14] + mat[8] * mat[2] * mat[13] + mat[12] * mat[1] * mat[10] - mat[12] * mat[2] * mat[9];
    inv[2] = mat[1] * mat[6] * mat[15] - mat[1] * mat[7] * mat[14] - mat[5] * mat[2] * mat[15] + mat[5] * mat[3] * mat[14] + mat[13] * mat[2] * mat[7] - mat[13] * mat[3] * mat[6];
    inv[6] = -mat[0] * mat[6] * mat[15] + mat[0] * mat[7] * mat[14] + mat[4] * mat[2] * mat[15] - mat[4] * mat[3] * mat[14] - mat[12] * mat[2] * mat[7] + mat[12] * mat[3] * mat[6];
    inv[10] = mat[0] * mat[5] * mat[15] - mat[0] * mat[7] * mat[13] - mat[4] * mat[1] * mat[15] + mat[4] * mat[3] * mat[13] + mat[12] * mat[1] * mat[7] - mat[12] * mat[3] * mat[5];
    inv[14] = -mat[0] * mat[5] * mat[14] + mat[0] * mat[6] * mat[13] + mat[4] * mat[1] * mat[14] - mat[4] * mat[2] * mat[13] - mat[12] * mat[1] * mat[6] + mat[12] * mat[2] * mat[5];
    inv[3] = -mat[1] * mat[6] * mat[11] + mat[1] * mat[7] * mat[10] + mat[5] * mat[2] * mat[11] - mat[5] * mat[3] * mat[10] - mat[9] * mat[2] * mat[7] + mat[9] * mat[3] * mat[6];
    inv[7] = mat[0] * mat[6] * mat[11] - mat[0] * mat[7] * mat[10] - mat[4] * mat[2] * mat[11] + mat[4] * mat[3] * mat[10] + mat[8] * mat[2] * mat[7] - mat[8] * mat[3] * mat[6];
    inv[11] = -mat[0] * mat[5] * mat[11] + mat[0] * mat[7] * mat[9] + mat[4] * mat[1] * mat[11] - mat[4] * mat[3] * mat[9] - mat[8] * mat[1] * mat[7] + mat[8] * mat[3] * mat[5];
    inv[15] = mat[0] * mat[5] * mat[10] - mat[0] * mat[6] * mat[9] - mat[4] * mat[1] * mat[10] + mat[4] * mat[2] * mat[9] + mat[8] * mat[1] * mat[6] - mat[8] * mat[2] * mat[5];
    
    const det = mat[0] * inv[0] + mat[1] * inv[4] + mat[2] * inv[8] + mat[3] * inv[12];
    
    if (det === 0) return mat4Identity();
    
    const invDet = 1.0 / det;
    for (let i = 0; i < 16; i++) {
        inv[i] *= invDet;
    }
    
    return inv;
}

function mat4Transpose(mat) {
    return [
        mat[0], mat[4], mat[8], mat[12],
        mat[1], mat[5], mat[9], mat[13],
        mat[2], mat[6], mat[10], mat[14],
        mat[3], mat[7], mat[11], mat[15]
    ];
}

// Geometry creation functions
function createCylinder(radius, height, segments) {
    const positions = [];
    const normals = [];
    const indices = [];
    
    // Create vertices
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Bottom vertex
        positions.push(x, 0, z);
        normals.push(x / radius, 0, z / radius);
        
        // Top vertex
        positions.push(x, height, z);
        normals.push(x / radius, 0, z / radius);
    }
    
    // Create indices
    for (let i = 0; i < segments; i++) {
        const bottom1 = i * 2;
        const top1 = i * 2 + 1;
        const bottom2 = ((i + 1) % (segments + 1)) * 2;
        const top2 = ((i + 1) % (segments + 1)) * 2 + 1;
        
        // Two triangles per segment
        indices.push(bottom1, bottom2, top1);
        indices.push(top1, bottom2, top2);
    }
    
    // Add caps
    const centerBottom = positions.length / 3;
    positions.push(0, 0, 0);
    normals.push(0, -1, 0);
    
    const centerTop = positions.length / 3;
    positions.push(0, height, 0);
    normals.push(0, 1, 0);
    
    // Bottom cap indices
    for (let i = 0; i < segments; i++) {
        const current = i * 2;
        const next = ((i + 1) % (segments + 1)) * 2;
        indices.push(centerBottom, next, current);
    }
    
    // Top cap indices
    for (let i = 0; i < segments; i++) {
        const current = i * 2 + 1;
        const next = ((i + 1) % (segments + 1)) * 2 + 1;
        indices.push(centerTop, current, next);
    }
    
    return { positions, normals, indices };
}

function createPlane(width, height) {
    const positions = [
        -width/2, 0, -height/2,
         width/2, 0, -height/2,
         width/2, 0,  height/2,
        -width/2, 0,  height/2
    ];
    
    const normals = [
        0, 1, 0,
        0, 1, 0,
        0, 1, 0,
        0, 1, 0
    ];
    
    const indices = [
        0, 1, 2,
        0, 2, 3
    ];
    
    return { positions, normals, indices };
}

function createSphere(radius, widthSegments, heightSegments) {
    const positions = [];
    const normals = [];
    const indices = [];
    
    // Create vertices
    for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;
        const phi = v * Math.PI;
        
        for (let x = 0; x <= widthSegments; x++) {
            const u = x / widthSegments;
            const theta = u * Math.PI * 2;
            
            const px = -radius * Math.cos(theta) * Math.sin(phi);
            const py = radius * Math.cos(phi);
            const pz = radius * Math.sin(theta) * Math.sin(phi);
            
            positions.push(px, py, pz);
            
            const nx = px / radius;
            const ny = py / radius;
            const nz = pz / radius;
            normals.push(nx, ny, nz);
        }
    }
    
    // Create indices
    for (let y = 0; y < heightSegments; y++) {
        for (let x = 0; x < widthSegments; x++) {
            const a = y * (widthSegments + 1) + x;
            const b = a + widthSegments + 1;
            const c = a + 1;
            const d = b + 1;
            
            if (y !== 0) indices.push(a, b, c);
            if (y !== heightSegments - 1) indices.push(c, b, d);
        }
    }
    
    return { positions, normals, indices };
}

// Shader utilities
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

function createShaderProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) {
        return null;
    }
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    
    return program;
}