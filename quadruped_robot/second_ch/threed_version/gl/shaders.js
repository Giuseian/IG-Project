export const vsSource = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform mat4 u_modelViewMatrix;
  uniform mat4 u_projectionMatrix;
  varying vec3 v_normal;
  void main() {
    gl_Position = u_projectionMatrix * u_modelViewMatrix * vec4(a_position, 1.0);
    v_normal = a_normal;
  }
`;

export const fsSource = `
  precision mediump float;
  varying vec3 v_normal;
  void main() {
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diff = max(dot(normalize(v_normal), lightDir), 0.0);
    gl_FragColor = vec4(vec3(0.2, 0.8, 1.0) * diff, 1.0);
  }
`;

export function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createProgram(gl, vs, fs) {
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}
