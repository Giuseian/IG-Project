// Simple 2D spatial hash for (x,z) points to speed up min-distance queries
export class SpatialHash {
  constructor(cellSize = 10) {
    this.cellSize = cellSize;
    this.map = new Map(); // key -> array of indices
    this.points = [];     // [{x,z}]
  }
  _key(ix, iz) { return `${ix},${iz}`; }
  _toCell(x, z) { return [Math.floor(x / this.cellSize), Math.floor(z / this.cellSize)]; }

  add(x, z) {
    const idx = this.points.length;
    this.points.push({ x, z });
    const [ix, iz] = this._toCell(x, z);
    const key = this._key(ix, iz);
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key).push(idx);
    return idx;
  }

  // query neighbors in a 3x3 cells neighborhood around (x,z)
  queryNeighbors(x, z) {
    const [ix, iz] = this._toCell(x, z);
    const res = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = this._key(ix + dx, iz + dz);
        const arr = this.map.get(key);
        if (arr) res.push(...arr);
      }
    }
    return res;
  }
}