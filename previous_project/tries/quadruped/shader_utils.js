// 3D Shader source code for the robot
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
        vec3 viewDirection = normalize(u_cameraPosition - v_position);
        vec3 reflectDirection = reflect(-lightDirection, normal);
        
        // Ambient
        float ambient = 0.3;
        
        // Diffuse
        float diffuse = max(dot(normal, lightDirection), 0.0);
        
        // Specular
        float specular = pow(max(dot(viewDirection, reflectDirection), 0.0), 32.0) * 0.5;
        
        float lighting = ambient + diffuse + specular;
        gl_FragColor = vec4(u_color * lighting, 1.0);
    }
`;

// Shader utilities
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