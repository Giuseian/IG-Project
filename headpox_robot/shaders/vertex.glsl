attribute vec3 aPosition;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

varying vec3 vNormal;

void main() {
    vec4 worldPosition = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPosition;

    // Assuming Y-up cylinder, world space normal is up
    vNormal = mat3(uModel) * vec3(0.0, 1.0, 0.0);
}
