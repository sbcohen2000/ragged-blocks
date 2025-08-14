import { Vector } from "./vector";
import { Point } from "./point";

/**
 * The type of rectangles. Operations on rectangles assume a
 * coordinate system where positive `x` points to the right and
 * positive `y` points downwards.
 */
export type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/**
 * Construct a new rectangle from the position of its upper-left
 * corner, and its width and height.
 *
 * @param x The x-coordinate of the rectangle's upper-left corner.
 * @param y The y-coordinate of the rectangle's upper-left corner.
 * @param w The width of the rectangle.
 * @param h The height of the rectangle.
 * @returns A new rectangle.
 */
export function fromXYWH(x: number, y: number, w: number, h: number): Rect {
  return {
    left: x,
    right: x + w,
    top: y,
    bottom: y + h
  }
}

/**
 * Clone a rectangle, returning a new rectangle with the same
 * dimensions as the input.
 *
 * @param r The rectangle to clone.
 * @returns A new rectangle, identical to `r`.
 */
export function clone(r: Rect): Rect {
  return { ...r };
}

/**
 * Translate a rectangle by the given offset vector.
 *
 * @param r The rectangle to translate.
 * @param v The vector by which to translate `r`.
 * @returns A new rectangle, identical to `r`, except translated by
 * `v`.
 */
export function translate(r: Rect, v: Vector): Rect {
  return {
    left: r.left + v.dx,
    right: r.right + v.dx,
    top: r.top + v.dy,
    bottom: r.bottom + v.dy
  };
}

/**
 * Find the width of a rectangle.
 *
 * @param r The rectangle for which to find the width.
 * @returns The width of rectangle `r`.
 */
export function width(r: Rect): number {
  return r.right - r.left;
}

/**
 * Find the height of a rectangle.
 *
 * @param r The rectangle for which to find the height.
 * @returns The height of rectangle `r`.
 */
export function height(r: Rect): number {
  return r.bottom - r.top;
}

/**
 * Inflate `r` by `amt`, returning a new `Rect` whose sides are all
 * translated outwards by `amt`.
 *
 * @param r The input rectangle.
 * @param amt The amount to inflate `r`.
 * @returns A new `Rect`, representing `r` inflated by `amt`.
 */
export function inflate(r: Rect, amt: number): Rect {
  return {
    left: r.left - amt,
    right: r.right + amt,
    top: r.top - amt,
    bottom: r.bottom + amt
  };
}

/**
 * Check if two `Rect`s overlap horizontally.
 *
 * @param a The first rectangle to check.
 * @param b The second rectangle to check.
 * @returns `true` if `a` and `b` horizontally overlap, and `false`
 * otherwise.
 */
export function horizontallyOverlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right;
}

/**
 * Check if point `p` is contained within `r` (including edges).
 *
 * @param p The point whose containment to check.
 * @param r The rectangle.
 * @returns `true` if `p` is inside `r` and `false` otherwise.
 */
export function pointInRect(p: Point, r: Rect): boolean {
  if(width(r) === 0 || height(r) === 0) {
    return false;
  } else {
    return r.left <= p.x && p.x <= r.right && r.top <= p.y && p.y <= r.bottom;
  }
}

/**
 * Find a rectangle which tightly encloses the area of rectangles `a`
 * and `b`.
 *
 * @param a The first `Rect`.
 * @param b The second `Rect`.
 * @returns A new `Rect` tightly enclosing `a` and `b`.
 */
export function union(a: Rect, b: Rect): Rect {
  return {
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top),
    bottom: Math.max(a.bottom, b.bottom)
  }
}

/**
 * Find a rectangle which tightly encloses the area of rectangle `a`
 * and point `p`.
 *
 * @param a The `Rect` to enclose.
 * @param p The `Point` to enclose.
 * @returns A new `Rect` tightly enclosing `a` and `p`.
 */
export function expandToInclude(a: Rect, p: Point): Rect {
  return {
    left: Math.min(a.left, p.x),
    right: Math.max(a.right, p.x),
    top: Math.min(a.top, p.y),
    bottom: Math.max(a.bottom, p.y)
  }
}

/**
 * Find the point at the center of the rectangle.
 *
 * @param r The `Rect` whose center point to find.
 * @returns A new `Point` at the center of `r`.
 */
export function centerPoint(r: Rect): Point {
  return {
    x: (r.left + r.right) / 2,
    y: (r.top + r.bottom) / 2
  }
}
