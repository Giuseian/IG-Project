// Fragment Shader for Robotic Creature
precision mediump float;

varying vec3 v_position;
varying vec3 v_normal;
varying vec3 v_worldPosition;

uniform vec3 u_lightPosition;
uniform vec3 u_cameraPosition;
uniform vec3 u_color;

void main() {
    // Normalize interpolated normal
    vec3 normal = normalize(v_normal);
    
    // Calculate lighting vectors
    vec3 lightDir = normalize(u_lightPosition - v_worldPosition);
    vec3 viewDir = normalize(u_cameraPosition - v_worldPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    
    // Ambient lighting (base illumination)
    vec3 ambient = 0.3 * u_color;
    
    // Diffuse lighting (Lambert's law)
    float diffuseStrength = max(dot(normal, lightDir), 0.0);
    vec3 diffuse = diffuseStrength * u_color * 0.7;
    
    // Specular lighting (Phong reflection)
    float specularStrength = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);
    vec3 specular = specularStrength * vec3(0.4, 0.4, 0.5);
    
    // Rim lighting for robotic aesthetic
    float rimPower = 2.0;
    float rimStrength = 1.0 - max(dot(viewDir, normal), 0.0);
    rimStrength = pow(rimStrength, rimPower);
    vec3 rimColor = vec3(0.1, 0.2, 0.3) * rimStrength * 0.3;
    
    // Combine all lighting components
    vec3 finalColor = ambient + diffuse + specular + rimColor;
    
    // Add slight metallic sheen
    finalColor = mix(finalColor, finalColor * 1.2, 0.1);
    
    gl_FragColor = vec4(finalColor, 1.0);
}