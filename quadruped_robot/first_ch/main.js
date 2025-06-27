// Main application class
class RoboticCreature {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        this.gl = null;
        this.program = null;
        
        // Animation state
        this.startTime = Date.now();
        this.camera = {
            position: [0, 1.5, 3],
            rotation: [-0.4, 0],
            distance: 4.0,
            target: [0, 0, 0]
        };
        
        // Mouse controls
        this.mouse = {
            x: 0, y: 0,
            isDown: false,
            lastX: 0, lastY: 0
        };
        
        // IK parameters
        this.legBase = [0, 0.8, 0];
        this.upperLegLength = 1.0;
        this.lowerLegLength = 0.8;
        this.footTarget = [0, -0.5, 0];
        
        // Smoothing for stable animation
        this.previousJoint = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.initWebGL();
        this.setupEventListeners();
        this.loadShaders();
        this.setupGeometry();
        this.animate();
    }
    
    setupCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        });
    }
    
    initWebGL() {
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }
        
        console.log('WebGL context initialized');
        console.log('WebGL version:', this.gl.getParameter(this.gl.VERSION));
        
        // Enable depth testing
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LEQUAL);
        
        // Set clear color to dark
        this.gl.clearColor(0.1, 0.1, 0.15, 1.0);
        
        // Set viewport
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        console.log('Canvas size:', this.canvas.width, 'x', this.canvas.height);
    }
    
    setupEventListeners() {
        // Mouse controls for camera
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouse.isDown = true;
            this.mouse.lastX = e.clientX;
            this.mouse.lastY = e.clientY;
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.mouse.isDown = false;
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.mouse.isDown) {
                const deltaX = e.clientX - this.mouse.lastX;
                const deltaY = e.clientY - this.mouse.lastY;
                
                this.camera.rotation[1] += deltaX * 0.01;
                this.camera.rotation[0] += deltaY * 0.01;
                
                // Clamp vertical rotation
                this.camera.rotation[0] = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.camera.rotation[0]));
                
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
            }
        });
        
        // Zoom controls with mouse wheel
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            this.camera.distance += e.deltaY * zoomSpeed * 0.01;
            this.camera.distance = Math.max(1.0, Math.min(10.0, this.camera.distance));
        });
        
        // Keyboard controls for better navigation
        document.addEventListener('keydown', (e) => {
            const moveSpeed = 0.1;
            switch(e.key) {
                case 'w': case 'W':
                    this.camera.target[1] += moveSpeed;
                    break;
                case 's': case 'S':
                    this.camera.target[1] -= moveSpeed;
                    break;
                case 'a': case 'A':
                    this.camera.target[0] -= moveSpeed;
                    break;
                case 'd': case 'D':
                    this.camera.target[0] += moveSpeed;
                    break;
                case 'r': case 'R':
                    // Reset camera
                    this.camera.rotation = [-0.4, 0];
                    this.camera.distance = 4.0;
                    this.camera.target = [0, 0, 0];
                    break;
            }
        });
    }
    
    async loadShaders() {
        const vertexShaderSource = `
            attribute vec3 a_position;
            attribute vec3 a_normal;
            
            uniform mat4 u_modelMatrix;
            uniform mat4 u_viewMatrix;
            uniform mat4 u_projectionMatrix;
            uniform mat4 u_normalMatrix;
            
            varying vec3 v_position;
            varying vec3 v_normal;
            
            void main() {
                vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
                v_position = worldPosition.xyz;
                v_normal = (u_normalMatrix * vec4(a_normal, 0.0)).xyz;
                
                gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
            }
        `;
        
        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec3 v_position;
            varying vec3 v_normal;
            
            uniform vec3 u_lightPosition;
            uniform vec3 u_cameraPosition;
            uniform vec3 u_color;
            
            void main() {
                vec3 normal = normalize(v_normal);
                vec3 lightDir = normalize(u_lightPosition - v_position);
                vec3 viewDir = normalize(u_cameraPosition - v_position);
                
                // Ambient
                vec3 ambient = 0.2 * u_color;
                
                // Diffuse
                float diff = max(dot(normal, lightDir), 0.0);
                vec3 diffuse = diff * u_color;
                
                // Specular
                vec3 reflectDir = reflect(-lightDir, normal);
                float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
                vec3 specular = spec * vec3(0.5, 0.5, 0.5);
                
                vec3 result = ambient + diffuse + specular;
                gl_FragColor = vec4(result, 1.0);
            }
        `;
        
        this.program = createShaderProgram(this.gl, vertexShaderSource, fragmentShaderSource);
        this.gl.useProgram(this.program);
        
        // Get attribute and uniform locations
        this.attribLocations = {
            position: this.gl.getAttribLocation(this.program, 'a_position'),
            normal: this.gl.getAttribLocation(this.program, 'a_normal')
        };
        
        this.uniformLocations = {
            modelMatrix: this.gl.getUniformLocation(this.program, 'u_modelMatrix'),
            viewMatrix: this.gl.getUniformLocation(this.program, 'u_viewMatrix'),
            projectionMatrix: this.gl.getUniformLocation(this.program, 'u_projectionMatrix'),
            normalMatrix: this.gl.getUniformLocation(this.program, 'u_normalMatrix'),
            lightPosition: this.gl.getUniformLocation(this.program, 'u_lightPosition'),
            cameraPosition: this.gl.getUniformLocation(this.program, 'u_cameraPosition'),
            color: this.gl.getUniformLocation(this.program, 'u_color')
        };
    }
    
    setupGeometry() {
        // Create cylinder geometry for leg segments
        this.cylinderGeometry = createCylinder(0.03, 1.0, 8);
        
        // Create sphere geometry for joints
        this.sphereGeometry = createSphere(0.06, 8, 6);
        
        // Create ground plane
        this.planeGeometry = createPlane(8, 8);
        
        // Setup buffers
        this.cylinderBuffers = this.createBuffers(this.cylinderGeometry);
        this.sphereBuffers = this.createBuffers(this.sphereGeometry);
        this.planeBuffers = this.createBuffers(this.planeGeometry);
        
        console.log('Geometry created:', {
            cylinderVertices: this.cylinderGeometry.positions.length / 3,
            sphereVertices: this.sphereGeometry.positions.length / 3
        });
    }
    
    createBuffers(geometry) {
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(geometry.positions), this.gl.STATIC_DRAW);
        
        const normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(geometry.normals), this.gl.STATIC_DRAW);
        
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), this.gl.STATIC_DRAW);
        
        return {
            position: positionBuffer,
            normal: normalBuffer,
            index: indexBuffer,
            indexCount: geometry.indices.length
        };
    }
    
    // 2-bone Inverse Kinematics solver - ULTRA STABLE VERSION
    solveIK(base, target, len1, len2) {
        const [bx, by, bz] = base;
        const [tx, ty, tz] = target;
        
        // Vector from base to target
        const dx = tx - bx;
        const dy = ty - by;
        const dz = tz - bz;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Avoid division by zero
        if (distance < 0.001) {
            return {
                joint: [bx, by - len1, bz],
                foot: [bx, by - len1 - len2, bz]
            };
        }
        
        // Clamp distance to reachable range with safety margin
        const maxReach = (len1 + len2) * 0.99;
        const minReach = Math.abs(len1 - len2) * 1.01;
        const clampedDistance = Math.max(minReach, Math.min(maxReach, distance));
        
        // Unit vector pointing to target
        const ux = dx / distance;
        const uy = dy / distance;
        const uz = dz / distance;
        
        // Law of cosines to find angle at base joint
        const cosAngle = (len1*len1 + clampedDistance*clampedDistance - len2*len2) / (2 * len1 * clampedDistance);
        const safeAngle = Math.acos(Math.max(-0.99, Math.min(0.99, cosAngle)));
        
        // For 2D IK in the plane containing base, target, and "up" direction
        // Calculate the perpendicular vector in the plane
        const horizontalDist = Math.sqrt(dx*dx + dz*dz);
        
        if (horizontalDist < 0.001) {
            // Target is directly above or below base
            const jointY = by + (dy > 0 ? len1 : -len1);
            return {
                joint: [bx, jointY, bz],
                foot: [tx, ty, tz]
            };
        }
        
        // Calculate angles for 2D IK
        const horizontalAngle = Math.atan2(dx, dz);
        const verticalAngle = Math.atan2(-dy, horizontalDist);
        
        // Joint position using simple trigonometry
        const jointAngle = verticalAngle + safeAngle;
        const jointX = bx + Math.sin(horizontalAngle) * Math.cos(jointAngle) * len1;
        const jointY = by + Math.sin(jointAngle) * len1;
        const jointZ = bz + Math.cos(horizontalAngle) * Math.cos(jointAngle) * len1;
        
        return {
            joint: [jointX, jointY, jointZ],
            foot: [tx, ty, tz]
        };
    }
    
    animate() {
        const currentTime = Date.now();
        const elapsed = (currentTime - this.startTime) / 1000.0;
        
        // Animate foot target with very slow, smooth motion
        const time = elapsed * 0.15; // Much slower animation
        this.footTarget = [
            Math.sin(time) * 0.5,
            -0.3 + Math.abs(Math.sin(time * 1.1)) * 0.2,
            Math.cos(time * 0.8) * 0.4
        ];
        
        // Solve IK
        const ikResult = this.solveIK(
            this.legBase,
            this.footTarget,
            this.upperLegLength,
            this.lowerLegLength
        );
        
        // Apply smoothing to reduce any remaining jitter
        if (this.previousJoint) {
            const smoothFactor = 0.85;
            ikResult.joint[0] = this.previousJoint[0] * smoothFactor + ikResult.joint[0] * (1 - smoothFactor);
            ikResult.joint[1] = this.previousJoint[1] * smoothFactor + ikResult.joint[1] * (1 - smoothFactor);
            ikResult.joint[2] = this.previousJoint[2] * smoothFactor + ikResult.joint[2] * (1 - smoothFactor);
        }
        this.previousJoint = [...ikResult.joint];
        
        // Debug output
        if (elapsed < 1) {
            console.log('IK Result:', ikResult);
            console.log('Camera position:', this.camera.position);
        }
        
        this.render(ikResult);
        requestAnimationFrame(() => this.animate());
    }
    
    render(ikResult) {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        
        // Setup matrices
        const projectionMatrix = mat4Perspective(
            Math.PI / 4,
            this.canvas.width / this.canvas.height,
            0.1,
            100.0
        );
        
        const viewMatrix = this.getViewMatrix();
        
        // Set uniforms
        this.gl.uniformMatrix4fv(this.uniformLocations.projectionMatrix, false, projectionMatrix);
        this.gl.uniformMatrix4fv(this.uniformLocations.viewMatrix, false, viewMatrix);
        this.gl.uniform3fv(this.uniformLocations.lightPosition, [2.0, 3.0, 2.0]);
        this.gl.uniform3fv(this.uniformLocations.cameraPosition, this.camera.position);
        
        // Draw ground plane
        this.drawGroundPlane();
        
        // Draw leg segments with proper connection
        this.drawLegSegment(this.legBase, ikResult.joint, [0.6, 0.7, 0.9]); // Upper leg - light blue
        this.drawLegSegment(ikResult.joint, ikResult.foot, [0.7, 0.9, 0.6]); // Lower leg - light green
        
        // Draw joints
        this.drawJoint(this.legBase, [0.9, 0.4, 0.4]); // Base joint (bright red)
        this.drawJoint(ikResult.joint, [0.4, 0.9, 0.4]); // Knee joint (bright green)
        this.drawJoint(ikResult.foot, [0.4, 0.4, 0.9]); // Foot joint (bright blue)
    }
    
    getViewMatrix() {
        // Calculate camera position based on spherical coordinates
        const x = this.camera.target[0] + this.camera.distance * Math.sin(this.camera.rotation[1]) * Math.cos(this.camera.rotation[0]);
        const y = this.camera.target[1] + this.camera.distance * Math.sin(this.camera.rotation[0]);
        const z = this.camera.target[2] + this.camera.distance * Math.cos(this.camera.rotation[1]) * Math.cos(this.camera.rotation[0]);
        
        this.camera.position = [x, y, z];
        
        const eye = this.camera.position;
        const center = this.camera.target;
        const up = [0, 1, 0];
        
        return mat4LookAt(eye, center, up);
    }
    
    drawLegSegment(start, end, color) {
        const direction = vec3Subtract(end, start);
        const length = vec3Length(direction);
        
        if (length < 0.001) return; // Skip if too short
        
        const normalizedDir = vec3Normalize(direction);
        
        // Create transformation matrix
        const modelMatrix = mat4Identity();
        
        // Position at start point
        mat4Translate(modelMatrix, start[0], start[1], start[2]);
        
        // Rotate to align with direction
        const up = [0, 1, 0];
        let right = vec3Cross(up, normalizedDir);
        
        // Handle case where direction is parallel to up vector
        if (vec3Length(right) < 0.001) {
            right = [1, 0, 0];
        } else {
            right = vec3Normalize(right);
        }
        
        const actualUp = vec3Normalize(vec3Cross(normalizedDir, right));
        
        const rotationMatrix = [
            right[0], actualUp[0], normalizedDir[0], 0,
            right[1], actualUp[1], normalizedDir[1], 0,
            right[2], actualUp[2], normalizedDir[2], 0,
            0, 0, 0, 1
        ];
        
        mat4Multiply(modelMatrix, rotationMatrix);
        
        // Scale to desired length
        mat4Scale(modelMatrix, 1, length, 1);
        
        this.drawGeometry(this.cylinderBuffers, modelMatrix, color);
    }
    
    drawJoint(position, color) {
        const modelMatrix = mat4Identity();
        mat4Translate(modelMatrix, position[0], position[1], position[2]);
        this.drawGeometry(this.sphereBuffers, modelMatrix, color);
    }
    
    drawGroundPlane() {
        const modelMatrix = mat4Identity();
        mat4Translate(modelMatrix, 0, -1.5, 0);
        mat4Scale(modelMatrix, 1, 1, 1);
        this.drawGeometry(this.planeBuffers, modelMatrix, [0.15, 0.18, 0.22]);
    }
    
    drawGeometry(buffers, modelMatrix, color) {
        // Bind position buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.position);
        this.gl.enableVertexAttribArray(this.attribLocations.position);
        this.gl.vertexAttribPointer(this.attribLocations.position, 3, this.gl.FLOAT, false, 0, 0);
        
        // Bind normal buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffers.normal);
        this.gl.enableVertexAttribArray(this.attribLocations.normal);
        this.gl.vertexAttribPointer(this.attribLocations.normal, 3, this.gl.FLOAT, false, 0, 0);
        
        // Set matrices
        this.gl.uniformMatrix4fv(this.uniformLocations.modelMatrix, false, modelMatrix);
        
        // Calculate normal matrix (inverse transpose of model matrix)
        const normalMatrix = mat4Transpose(mat4Inverse(modelMatrix));
        this.gl.uniformMatrix4fv(this.uniformLocations.normalMatrix, false, normalMatrix);
        
        // Set color
        this.gl.uniform3fv(this.uniformLocations.color, color);
        
        // Draw
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, buffers.index);
        this.gl.drawElements(this.gl.TRIANGLES, buffers.indexCount, this.gl.UNSIGNED_SHORT, 0);
    }
}

// Initialize the application
window.addEventListener('load', () => {
    try {
        new RoboticCreature();
    } catch (error) {
        console.error('Failed to initialize WebGL application:', error);
        document.body.innerHTML = '<div style="color: red; text-align: center; margin-top: 50px;">WebGL not supported or failed to initialize</div>';
    }
});