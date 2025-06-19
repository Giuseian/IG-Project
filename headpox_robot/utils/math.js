// utils/math.js

export const Vec3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  subtract: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (v, s) => [v[0] * s, v[1] * s, v[2] * s],
  normalize: (v) => {
    let len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2);
    return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
  },
  length: (v) => Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2),
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot: (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2],
};

export const Mat4 = {
  identity: () => [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ],

  translate: (m, v) => {
    let [x, y, z] = v;
    let out = m.slice();
    out[12] += x;
    out[13] += y;
    out[14] += z;
    return out;
  },

  scale: (m, v) => {
    let [x, y, z] = v;
    let out = m.slice();
    out[0] *= x; out[5] *= y; out[10] *= z;
    return out;
  },

  orientY: (dir) => {
    const up = [0, 1, 0];
    const z = Vec3.normalize(dir);
    const x = Vec3.normalize(Vec3.cross(up, z));
    const y = Vec3.cross(z, x);

    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      0,    0,    0,    1,
    ];
  },
};

export function createShader(gl, source, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = createShader(gl, vsSource, gl.VERTEX_SHADER);
  const fragmentShader = createShader(gl, fsSource, gl.FRAGMENT_SHADER);

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}
