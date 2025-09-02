import { Vector } from "./vector";

/**
 * A 2D point.
 */
export type Point = {
  x: number;
  y: number;
};

/**
 * Return a new point which has been translated by `v`.
 *
 * @param p The original `Point`.
 * @param v The `Vector` by which to translate `p`.
 * @returns A new point, `p` + `v`.
 */
export function addVector(p: Point, v: Vector) {
  return { x: p.x + v.dx, y: p.y + v.dy };
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
