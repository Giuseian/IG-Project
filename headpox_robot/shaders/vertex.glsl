attribute vec3 aPosition;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

void main() {
    vec4 worldPosition = uModel * vec4(aPosition, 1.0);
    gl_Position = uProjection * uView * worldPosition;
    gl_PointSize = 8.0; // For drawing foot points
}