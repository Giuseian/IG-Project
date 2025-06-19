precision mediump float;

varying vec3 vNormal;

void main() {
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    vec3 normal = normalize(vNormal);

    float diffuse = max(dot(normal, lightDir), 0.0);
    vec3 baseColor = vec3(0.4, 0.8, 1.0); // light blue tint

    gl_FragColor = vec4(baseColor * diffuse, 1.0);
}
