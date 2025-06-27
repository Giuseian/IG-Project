attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec4 worldPosition = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPosition;
    
    // Transform normal to world space
    vNormal = mat3(uModel) * aNormal;
    vPosition = worldPosition.xyz;
}