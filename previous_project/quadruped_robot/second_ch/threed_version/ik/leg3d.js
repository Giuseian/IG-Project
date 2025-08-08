// Simple 2-bone IK solver in 3D (returns joint and foot positions)
export function solveIK3D(base, target, len1, len2) {
  const dx = target[0] - base[0];
  const dy = target[1] - base[1];
  const dz = target[2] - base[2];

  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const clampedDist = Math.min(dist, len1 + len2 - 0.001);

  const angleA = Math.acos((len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist));

  const dir = [dx / dist, dy / dist, dz / dist];

  const joint = [
    base[0] + Math.cos(angleA) * len1 * dir[0],
    base[1] + Math.cos(angleA) * len1 * dir[1],
    base[2] + Math.cos(angleA) * len1 * dir[2]
  ];

  return { joint, foot: target };
}
