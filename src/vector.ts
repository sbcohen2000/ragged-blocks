/**
 * A 2-dimensional vector.
 */
export type Vector = {
  dx: number;
  dy: number;
};

/**
 * Construct a zero vector.
 *
 * @returns A zero vector.
 */
export function zero(): Vector {
  return { dx: 0, dy: 0 };
}

/**
 * Construct a new vector which is the component-wise sum of the
 * argument vectors.
 *
 * @param lhs The first addend.
 * @param rhs The second addend.
 * @returns A new `Vector`, the sum of `lhs` and `rhs`.
 */
export function add(lhs: Vector, rhs: Vector): Vector {
  return { dx: lhs.dx + rhs.dx, dy: lhs.dy + rhs.dy };
}

/**
 * Construct a new vector which is the component-wise scaling of
 * the argument and the scaling parameter, `t`.
 *
 * @param v The vector to be scaled.
 * @param t The scaling factor.
 * @returns a new vector representing the scaling of `v` by `t`.
 */
export function scale(v: Vector, t: number): Vector {
  return { dx: v.dx * t, dy: v.dy * t };
}

/**
 * Compute the magnitude of the vector formed by taking the cross
 * product of `a` and `b`, supposing that they were embedded in the 2d
 * plane.
 *
 * @param a The first vector.
 * @param b The second vector.
 * @returns The magnitude of `a` cross `b`.
 */
export function cross(a: Vector, b: Vector): number {
  return a.dx * b.dy - b.dx * a.dy;
}

/**
 * Find the magnitude of a vector.
 *
 * @param a The vector whose magnitude to find.
 * @returns The magnitude of `a`.
 */
export function magnitude(a: Vector): number {
  return Math.sqrt(a.dx * a.dx + a.dy * a.dy);
}

/**
 * Return a new vector which has the same direction as `a` but unit
 * magnitude.
 *
 * @param a The vector to normalize.
 * @returns A new vector with `a`'s direction but unit magnitude.
 */
export function normalize(a: Vector): Vector {
  return scale(a, 1 / magnitude(a));
}
