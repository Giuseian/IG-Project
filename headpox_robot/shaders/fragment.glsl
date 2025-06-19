precision mediump float;

uniform vec3 uColor;
uniform vec3 uLightDir;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(uLightDir);
    
    // Ambient light
    float ambient = 0.3;
    
    // Diffuse lighting
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    // Simple specular highlight
    vec3 viewDir = normalize(-vPosition);
    vec3 reflectDir = reflect(-lightDir, normal);
    float specular = pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * 0.3;
    
    vec3 finalColor = uColor * (ambient + diffuse) + vec3(specular);
    gl_FragColor = vec4(finalColor, 1.0);
}