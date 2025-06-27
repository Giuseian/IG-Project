export function identity() {
  return [
    1, 0, 0,
    0, 1, 0,
    0, 0, 1
  ];
}

export function translate(m, tx, ty) {
  return multiply(m, [
    1, 0, 0,
    0, 1, 0,
    tx, ty, 1
  ]);
}

export function rotate(m, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return multiply(m, [
    c, s, 0,
   -s, c, 0,
    0, 0, 1
  ]);
}

export function scale(m, sx, sy) {
  return multiply(m, [
    sx, 0, 0,
    0, sy, 0,
    0, 0, 1
  ]);
}

export function multiply(a, b) {
  const result = new Array(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      result[col * 3 + row] =
        a[0 * 3 + row] * b[col * 3 + 0] +
        a[1 * 3 + row] * b[col * 3 + 1] +
        a[2 * 3 + row] * b[col * 3 + 2];
    }
  }
  return result;
}

export function projection(width, height) {
  return [
    2 / width, 0, 0,
    0, -2 / height, 0,
    -1, 1, 1
  ];
}
