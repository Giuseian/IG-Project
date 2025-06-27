// Robot parts and classes
class RobotPart {
    constructor(geometry, color = [0.8, 0.8, 0.8]) {
        this.geometry = geometry;
        this.color = color;
        this.matrix = createMatrix4();
        this.children = [];
        this.vertexBuffer = null;
        this.normalBuffer = null;
        this.indexBuffer = null;
        
        if (geometry) {
            this.setupBuffers();
        }
        
        identity(this.matrix);
    }
    
    setupBuffers() {
        if (!gl) {
            console.error('WebGL context not available when setting up buffers');
            return;
        }
        
        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.geometry.positions, gl.STATIC_DRAW);
        
        this.normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.geometry.normals, gl.STATIC_DRAW);
        
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.geometry.indices, gl.STATIC_DRAW);
    }
    
    addChild(child) {
        this.children.push(child);
    }
    
    render(parentMatrix = null) {
        const worldMatrix = createMatrix4();
        
        if (parentMatrix) {
            multiply(worldMatrix, parentMatrix, this.matrix);
        } else {
            worldMatrix.set(this.matrix);
        }
        
        if (this.geometry) {
            gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_modelMatrix'), false, worldMatrix);
            
            const normalMatrix = createMatrix4();
            invert(normalMatrix, worldMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(program, 'u_normalMatrix'), false, normalMatrix);
            
            gl.uniform3fv(gl.getUniformLocation(program, 'u_color'), this.color);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
            gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
            gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(1);
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
            gl.drawElements(gl.TRIANGLES, this.geometry.indices.length, gl.UNSIGNED_SHORT, 0);
        }
        
        // Render children
        for (const child of this.children) {
            child.render(worldMatrix);
        }
    }
}

class Leg {
    constructor(position, color = [0.6, 0.6, 0.8]) {
        this.position = position;
        this.upperLeg = new RobotPart(createCylinder(0.08, 0.6), color);
        this.lowerLeg = new RobotPart(createCylinder(0.06, 0.5), [0.4, 0.4, 0.6]);
        this.foot = new RobotPart(createSphere(0.08), [0.3, 0.3, 0.5]);
        
        // Set up leg hierarchy
        this.upperLeg.addChild(this.lowerLeg);
        this.lowerLeg.addChild(this.foot);
        
        // Position joints
        translate(this.lowerLeg.matrix, identity(createMatrix4()), [0, -0.55, 0]);
        translate(this.foot.matrix, identity(createMatrix4()), [0, -0.4, 0]);
        
        this.walkPhase = 0;
    }
    
    update(time, gait) {
        const phase = this.walkPhase + time;
        
        // Different gait patterns
        let stepHeight = 0.3;
        let legRotation = 0;
        let kneeRotation = 0;
        
        switch(gait) {
            case 'walk':
                legRotation = Math.sin(phase) * 0.5;
                kneeRotation = Math.max(0, Math.sin(phase * 2)) * 0.8;
                break;
            case 'trot':
                legRotation = Math.sin(phase) * 0.7;
                kneeRotation = Math.max(0, Math.sin(phase * 2)) * 1.0;
                break;
            case 'gallop':
                legRotation = Math.sin(phase) * 0.9;
                kneeRotation = Math.max(0, Math.sin(phase * 3)) * 1.2;
                break;
        }
        
        // Apply rotations
        identity(this.upperLeg.matrix);
        rotateX(this.upperLeg.matrix, this.upperLeg.matrix, legRotation);
        
        identity(this.lowerLeg.matrix);
        translate(this.lowerLeg.matrix, this.lowerLeg.matrix, [0, -0.55, 0]);
        rotateX(this.lowerLeg.matrix, this.lowerLeg.matrix, kneeRotation);
        
        identity(this.foot.matrix);
        translate(this.foot.matrix, this.foot.matrix, [0, -0.4, 0]);
    }
    
    render(parentMatrix) {
        this.upperLeg.render(parentMatrix);
    }
}

class QuadrupedRobot {
    constructor() {
        // Main body
        this.body = new RobotPart(createBox(1.2, 0.4, 0.6), [0.7, 0.7, 0.9]);
        
        // Head
        this.head = new RobotPart(createBox(0.3, 0.3, 0.3), [0.8, 0.8, 1.0]);
        translate(this.head.matrix, identity(createMatrix4()), [0.75, 0.35, 0]);
        this.body.addChild(this.head);
        
        // Eyes
        this.leftEye = new RobotPart(createSphere(0.05), [0.1, 0.8, 0.1]);
        this.rightEye = new RobotPart(createSphere(0.05), [0.1, 0.8, 0.1]);
        translate(this.leftEye.matrix, identity(createMatrix4()), [0.15, 0.1, 0.1]);
        translate(this.rightEye.matrix, identity(createMatrix4()), [0.15, 0.1, -0.1]);
        this.head.addChild(this.leftEye);
        this.head.addChild(this.rightEye);
        
        // Create legs
        this.legs = [
            new Leg('frontLeft', [0.6, 0.6, 0.8]),
            new Leg('frontRight', [0.6, 0.6, 0.8]),
            new Leg('backLeft', [0.5, 0.5, 0.7]),
            new Leg('backRight', [0.5, 0.5, 0.7])
        ];
        
        // Position legs on body
        const legPositions = [
            [0.4, -0.3, 0.4],   // front left
            [0.4, -0.3, -0.4],  // front right
            [-0.4, -0.3, 0.4],  // back left
            [-0.4, -0.3, -0.4]  // back right
        ];
        
        this.legMounts = [];
        this.legs.forEach((leg, i) => {
            const legMount = new RobotPart(null);
            translate(legMount.matrix, identity(createMatrix4()), legPositions[i]);
            legMount.addChild(leg.upperLeg);
            this.body.addChild(legMount);
            this.legMounts.push(legMount);
        });
        
        // Set walk phases for different gaits
        this.legs[0].walkPhase = 0;        // front left
        this.legs[1].walkPhase = Math.PI;  // front right
        this.legs[2].walkPhase = Math.PI;  // back left  
        this.legs[3].walkPhase = 0;        // back right
    }
    
    update(time, gait, height) {
        // Update body height
        identity(this.body.matrix);
        translate(this.body.matrix, this.body.matrix, [0, height, 0]);
        
        // Add subtle body bob
        const bobAmount = Math.sin(time * 4) * 0.05;
        translate(this.body.matrix, this.body.matrix, [0, bobAmount, 0]);
        
        // Update all legs
        this.legs.forEach(leg => {
            leg.update(time, gait);
        });
    }
    
    render() {
        this.body.render();
    }
}