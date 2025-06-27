export const cubeVertices = [
  // Front face
  -0.1, -0.5,  0.1,
   0.1, -0.5,  0.1,
   0.1,  0.5,  0.1,
  -0.1,  0.5,  0.1,

  // Back face
  -0.1, -0.5, -0.1,
   0.1, -0.5, -0.1,
   0.1,  0.5, -0.1,
  -0.1,  0.5, -0.1,
];

export const cubeNormals = [
  // Front normals
  0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
  // Back normals
  0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
  // Sides (reused for simplicity — not per-face accurate)
  1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
  -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
  0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
];

export const cubeIndices = [
  0, 1, 2,  2, 3, 0, // front
  4, 5, 6,  6, 7, 4, // back
  1, 5, 6,  6, 2, 1, // right
  0, 4, 7,  7, 3, 0, // left
  3, 2, 6,  6, 7, 3, // top
  0, 1, 5,  5, 4, 0, // bottom
];