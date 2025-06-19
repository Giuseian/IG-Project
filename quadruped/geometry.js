// Geometry creation functions
function createBox(width, height, depth) {
    const w = width / 2;
    const h = height / 2;
    const d = depth / 2;
    
    const positions = [
        // Front face
        -w, -h, d, w, -h, d, w, h, d, -w, h, d,
        // Back face
        -w, -h, -d, -w, h, -d, w, h, -d, w, -h, -d,
        // Top face
        -w, h, -d, -w, h, d, w, h, d, w, h, -d,
        // Bottom face
        -w, -h, -d, w, -h, -d, w, -h, d, -w, -h, d,
        // Right face
        w, -h, -d, w, h, -d, w, h, d, w, -h, d,
        // Left face
        -w, -h, -d, -w, -h, d, -w, h, d, -w, h, -d
    ];
    
    const normals = [
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
    ];
    
    const indices = [
        0, 1, 2, 0, 2, 3,       // front
        4, 5, 6, 4, 6, 7,       // back
        8, 9, 10, 8, 10, 11,    // top
        12, 13, 14, 12, 14, 15, // bottom
        16, 17, 18, 16, 18, 19, // right
        20, 21, 22, 20, 22, 23  // left
    ];
    
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices)
    };
}

function createCylinder(radius, height, segments = 16) {
    const positions = [];
    const normals = [];
    const indices = [];
    
    // Create vertices
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
    
    // Create side faces
    for (let i = 0; i < segments; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = ((i + 1) % (segments + 1)) * 2;
        const d = c + 1;
        
        // Two triangles per quad
        indices.push(a, b, c);
        indices.push(b, d, c);
    }
    
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices)
    };
}

function createSphere(radius, segments = 16) {
    const positions = [];
    const normals = [];
    const indices = [];
    
    // Create vertices
    for (let lat = 0; lat <= segments; lat++) {
        const theta = lat * Math.PI / segments;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        
        for (let lon = 0; lon <= segments; lon++) {
            const phi = lon * 2 * Math.PI / segments;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);
            
            const x = cosPhi * sinTheta;
            const y = cosTheta;
            const z = sinPhi * sinTheta;
            
            positions.push(radius * x, radius * y, radius * z);
            normals.push(x, y, z);
        }
    }
    
    // Create indices
    for (let lat = 0; lat < segments; lat++) {
        for (let lon = 0; lon < segments; lon++) {
            const first = lat * (segments + 1) + lon;
            const second = first + segments + 1;
            
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }
    
    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        indices: new Uint16Array(indices)
    };
}