// Vertex Shader for Robotic Creature
attribute vec3 a_position;
attribute vec3 a_normal;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat4 u_normalMatrix;

varying vec3 v_position;
varying vec3 v_normal;
varying vec3 v_worldPosition;

void main() {
    // Transform position to world space
    vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
    v_worldPosition = worldPosition.xyz;
    v_position = worldPosition.xyz;
    
    // Transform normal to world space
    v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
    
    // Final position in clip space
    gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;
}