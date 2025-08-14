import { Vector } from "./vector";

/**
 * A 2D point.
 */
export type Point = {
  x: number;
  y: number;
};

/**
 * Modify a point by pairwise-adding the components of a `Vector`
 *
 * @param p The `Point` to modify.
 * @param v The `Vector` by which to modify `p`.
 */
export function addVector(p: Point, v: Vector) {
  p.x += v.dx;
  p.y += v.dy;
}

/**
 * Subtract two points, returning a vector which points from `b` to `a`.
 *
 * @param a The first point.
 * @param b The second point.
 * @returns The vector which, when added to `b`, yields point `a`.
 */
export function subPoints(a: Point, b: Point): Vector {
  return { dx: a.x - b.x, dy: a.y - b.y };
}
