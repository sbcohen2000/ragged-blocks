import assert from "./assert";
import { Point, subPoints } from "./point";
import { Rect, expandToInclude, union, width, height } from "./rect";
import { Svg, Render, SVGStyle, BorderStyle, DEFAULT_BORDER_STYLE } from "./render";
import { cross } from "./vector";

/**
 * A path is a list of points. It is implicitly closed.
 */
export type Path = Point[];

/**
 * A polygon is a list of paths.
 */
export type Polygon = Path[];

type Edge = [Point, Point];

/**
 * Construct a new path with the same points as `path`, but retaining
 * no reference to the original.
 *
 * @param path The path to clone.
 * @returns A new `Path`.
 */
export function clonePath(path: Path): Path {
  return path.map(p => ({...p}));
}

/**
 * Construct a new polygon with the same paths as `polygon`, but
 * retaining no reference to the original.
 *
 * @param polygon The polygon to clone.
 * @returns A new `Polygon`.
 */
export function clonePolygon(polygon: Polygon): Polygon {
  return polygon.map(clonePath);
}

/**
 * Construct a new counter clockwise wound path from the given
 * rectangle.
 *
 * @param r The rectangle whose boundary path to calculate.
 * @returns A new `Path` with the same boundary as `r`.
 */
export function pathOfRect(r: Rect): Path {
  return [
    { x: r.left, y: r.top },
    { x: r.left, y: r.bottom },
    { x: r.right, y: r.bottom },
    { x: r.right, y: r.top }
  ]
}

/**
 * Return an iterator over the edges of a `Path`.
 *
 * @param path The `Path` over which to iterate.
 * @returns An iterator over the edges of `path`.
 */
export function* pathEdges(path: Path): IterableIterator<Edge> {
  for(let i = 0; i < path.length; ++i) {
    const j = (i + 1) % path.length;

    yield [path[i], path[j]];
  }
}

/**
 * Check if a `Path` is wound counter-clockwise.
 * https://stackoverflow.com/a/1165943
 *
 * @param path The `Path` to check.
 * @returns `true` if `path` is wound counter-clockwise, and `false`
 * otherwise.
 */
export function isPathCCW(path: Path): boolean {
  let sum = 0;
  for(const [a, b] of pathEdges(path)) {
    sum += (b.x - a.x) * (b.y + a.y);
  }

  // Note that this is the inverse of the normal rule, since we're
  // operating in a context where the y-axis has been flipped.
  return sum > 0;
}

type EachTripleIterationDecision
  = { type: "None" }
  | {
    type: "Delete",
    deletePrev?: boolean,
    deleteCurt?: boolean,
    deleteNext?: boolean
  } | { type: "Stop" };

/**
 * Iterate over each point in the `Path`, also yielding the point's
 * left and right neighbors.
 *
 * @param path The `Path` over which to iterate.
 * @param f The function to evaluate over each point and its
 * neighbors. The function may return an `EachTripleIterationDecision`
 * which decides how the iteration will proceed.
 */
export function eachTripleInPath(
  path: Path,
  f: (prev: Point, curt: Point, next: Point) => EachTripleIterationDecision
) {
  if(path.length <= 2) {
    return;
  }

  for(let i = path.length - 1; i >= 0; --i) {
    const l = path.length;
    const prev = path[i];
    const curt = path[(i + 1) % l];
    const next = path[(i + 2) % l];

    const decision = f(prev, curt, next);
    switch(decision.type) {
      case "Delete": {
        const idxs: number[] = [];
        if(decision.deleteNext) idxs.push((i + 2) % l);
        if(decision.deleteCurt) idxs.push((i + 1) % l);
        if(decision.deletePrev) idxs.push(i);

        idxs.sort((a, b) => b - a); // Sort in descending order
        for(const idx of idxs) {
          path.splice(idx, 1);

          if(idx < i) {
            --i;
          }
        }
      } break;
      case "Stop": return;
      case "None": break;
    }
  }
}

type EachRectiSegmentIterationDecision<A>
  = { type: "None" }              // Continue the iteration.
  | { type: "Return", value: A }  // Stop the iteration, returning a value.
  | {
    type: "Delete",
    deleteA?: boolean,
    deleteB?: boolean,
    deleteC?: boolean,
    deleteD?: boolean
  };

/**
 * Iterate over each `RectiSegment` in the `Path`, also yielding the
 * segment's left and right neighbors.
 *
 * This function assumes that `Path` is a proper rectilinear path.
 *
 * @param path The `Path` over which to iterate.
 * @param f The function to evaluate over each segment and its
 * neighbors. The function may return an
 * `EachRectiSegmentIterationDecision` which decides how the iteration
 * will proceed.
 */
export function eachRectiSegmentTriple<A>(
  path: Path,
  f: (prev: RectiSegment, curt: RectiSegment, next: RectiSegment) => EachRectiSegmentIterationDecision<A>
): A | null {
  if(path.length <= 2) {
    return null;
  }

  for(let i = path.length - 1; i >= 0; --i) {
    const l = path.length;
    const a = path[i];
    const b = path[(i + 1) % l];
    const c = path[(i + 2) % l];
    const d = path[(i + 3) % l];

    const ab = mkRectiSegment(a, b);
    const bc = mkRectiSegment(b, c);
    const cd = mkRectiSegment(c, d);

    const decision = f(ab, bc, cd);
    switch(decision.type) {
      case "None": break;
      case "Return": return decision.value;
      case "Delete": {
        const idxs: number[] = [];
        if(decision.deleteD) idxs.push((i + 3) % l);
        if(decision.deleteC) idxs.push((i + 2) % l);
        if(decision.deleteB) idxs.push((i + 1) % l);
        if(decision.deleteA) idxs.push(i);

        idxs.sort((a, b) => b - a); // Sort in descending order
        for(const idx of idxs) {
          path.splice(idx, 1);

          if(idx < i) {
            --i;
          }
        }
      } break;
    }
  }

  return null;
}

/**
 * Get an iterator over the `RectiSegment`s of a `Path`.
 *
 * @param path The `Path` to iterate over.
 * @returns An iterator over the `RectiSegment`s in `path`.
 */
export function* eachRectiSegment(path: Path): IterableIterator<RectiSegment> {
  if(path.length < 2) {
    return;
  }

  for(let i = 0; i < path.length; ++i) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    yield mkRectiSegment(a, b);
  }
}

type RectiSegmentGuts = {
  begin: number;
  end: number;
  /**
   * The "cross axis" coordinate. For example, if this is a Horz
   * segment, then this is the segment's y-coordinate.
   */
  seg: number;

  /**
   * Pointer to the point at the beginning of the segment.
   */
  beginP: Point;
  /**
   * Pointer to the point at the end of the segment.
   */
  endP: Point;
};

type HorizontalRectiSegment = {
  dir: "Horz";
} & RectiSegmentGuts;

type VerticalRectiSegment = {
  dir: "Vert";
} & RectiSegmentGuts;

export type RectiSegment = HorizontalRectiSegment | VerticalRectiSegment;

/**
 * Given two axis-aligned points, construct a `RectiSegment`. If the
 * points are not axis aligned, then this function throws an error.
 *
 * @param begin The beginning point.
 * @param end The ending point.
 * @returns A new `RectiSegment`.
 */
function mkRectiSegment(begin: Point, end: Point): RectiSegment {
  const dx = Math.abs(begin.x - end.x);
  const dy = Math.abs(begin.y - end.y);

  if(dx > 0.001 && dy > 0.001) {
    throw new Error(`Non axis-aligned points in mkRectiSegment (${begin.x}, ${begin.y}) -- (${end.x}, ${end.y})`);
  }

  if(dx < dy) {
    return {
      dir: "Vert",
      begin: begin.y,
      end: end.y,
      seg: begin.x,
      beginP: begin,
      endP: end
    };
  } else {
    return {
      dir: "Horz",
      begin: begin.x,
      end: end.x,
      seg: begin.y,
      beginP: begin,
      endP: end
    };
  }
}

/**
 * Construct a rectangle from the edges of two rectilinear segments.
 *
 * @param a The first `RectiSegment`.
 * @param b The second `RectiSegment`.
 * @returns A rectangle, two of whose edges are `a` and `b`.
 * @throws If `a` and `b` are both horizontal or vertical rectilinear
 * segments.
 */
function rectOfRectiSegments(a: RectiSegment, b: RectiSegment): Rect {
  if(a.dir === "Horz") {
    assert(b.dir === "Vert");

    return {
      left: Math.min(a.begin, a.end),
      right: Math.max(a.begin, a.end),
      top: Math.min(b.begin, b.end),
      bottom: Math.max(b.begin, b.end)
    };
  } else {
    assert(b.dir === "Horz");

    return {
      left: Math.min(b.begin, b.end),
      right: Math.max(b.begin, b.end),
      top: Math.min(a.begin, a.end),
      bottom: Math.max(a.begin, a.end)
    };
  }
}

type Direction = "East" | "North" | "West" | "South";

/**
 * Find the `Direction` of a `RectiSegment`.
 *
 * @param seg The `RectiSegment` whose direction to find.
 * @returns The `Direction` of `seg`.
 */
function directionOfSegment(seg: RectiSegment): Direction {
  if(seg.dir === "Horz") {
    return seg.begin < seg.end ? "East" : "West";
  } else {
    return seg.begin < seg.end ? "South" : "North";
  }
}

/**
 * Find the length of a `RectiSegment`.
 *
 * @param seg The `RectiSegment` whose length to find.
 * @returns The length of `seg`.
 */
function lengthOfSegment(seg: RectiSegment): number {
  return Math.abs(seg.begin - seg.end);
}

type Corner
  = "EastSouth"  // CW
  | "SouthWest"  // CW
  | "WestNorth"  // CW
  | "NorthEast"  // CW
  | "SouthEast"  // CCW
  | "WestSouth"  // CCW
  | "NorthWest"  // CCW
  | "EastNorth"; // CCW

/**
 * Find the `Corner` corresponding to a movement first by `a`, then by
 * `b`. This function throws an error if `a` and `b` don't form a
 * valid corner (e.g. (East, East), or (East, West) and so on).
 *
 * @param a The first `Direction`.
 * @param b The second `Direction`.
 * @returns The `Corner` corresponding to moving by `a`, then `b`.
 */
function cornerFromDirections(a: Direction, b: Direction): Corner {
  switch(a) {
    case "East": {
      switch(b) {
        case "South": return "EastSouth";
        case "North": return "EastNorth";
      }
    } break;
    case "North": {
      switch(b) {
        case "East": return "NorthEast";
        case "West": return "NorthWest";
      }
    } break;
    case "West": {
      switch(b) {
        case "North": return "WestNorth";
        case "South": return "WestSouth";
      }
    } break;
    case "South": {
      switch(b) {
        case "West": return "SouthWest";
        case "East": return "SouthEast";
      }
    } break;
  }

  throw new Error(`Invalid corner (${a}, ${b})`);
}

/**
 * Offset the edges in a rectilinear `Path` by `amt`, returning a new
 * `Path`.
 *
 * @param amt The amount by which to offset each segment in `path`.
 * @param path The `Path` to offset.
 * @returns A new `Path`, the same as `path`, but each edge offset by
 * `amt`.
 */
export function offsetPath(amt: number, path: Path): Path {
  const out: Path = [];

  eachTripleInPath(path, (a, b, c): EachTripleIterationDecision => {
    const ab = subPoints(b, a);
    const cb = subPoints(b, c);
    const bisector = {
      dx: (ab.dx + cb.dx) / Math.abs(ab.dx + cb.dx) * amt,
      dy: (ab.dy + cb.dy) / Math.abs(ab.dy + cb.dy) * amt,
    };
    const s = isTurnCW(a, b, c) ? -1 : 1;

    out.push({ x: b.x + bisector.dx * s, y: b.y + bisector.dy * s });
    return { type: "None" };
  });

  out.reverse();
  return out;
}

/**
 * @see `offsetPath`.
 *
 * Offset the edges of each rectilinear `Path` in a `Polygon` by `amt`.
 *
 * @param amt The amount by which to offset each segment in `polygon`.
 * @param polygon The `Polygon` to offset.
 * @returns A new `Polygon`, the same as `polygon`, but where each
 * edge in each of the polygon's paths have been offset by `amt`.
 */
export function offsetPolygon(amt: number, polygon: Polygon): Polygon {
  return polygon.map(path => offsetPath(amt, path));
}

/**
 * Test if the point `p` horizontally overlaps `seg`.
 *
 * @param p The point to test.
 * @param seg The horizontal segment to test.
 * @returns `true` if `p` horizontally overlaps `seg`, and `false`
 * otherwise.
 */
function horzSegmentOverlaps(p: Point, seg: HorizontalRectiSegment): boolean {
  const leftmost = Math.min(seg.begin, seg.end);
  const rightmost = Math.max(seg.begin, seg.end);
  return leftmost <= p.x && p.x <= rightmost;
}

/**
 * Test if the point `p` vertically overlaps `seg`.
 *
 * @param p The point to test.
 * @param seg The vertical segment to test.
 * @returns `true` if `p` vertically overlaps `seg`, and `false`
 * otherwise.
 */
function vertSegmentOverlaps(p: Point, seg: VerticalRectiSegment): boolean {
  const topmost = Math.min(seg.begin, seg.end);
  const bottommost = Math.max(seg.begin, seg.end);
  return topmost <= p.y && p.y <= bottommost;
}

/**
 * Test if the point `p` vertically overlaps `seg` and `seg` occurs
 * strictly to the right of `p`.
 *
 * @param p The point to test.
 * @param seg The vertical segment to test.
 * @returns `true` if `p` vertically overlaps `seg` and `seg` occurs
 * strictly to the right of `p`.
 */
function vertSegmentToRightOfP(p: Point, seg: VerticalRectiSegment): boolean {
  return vertSegmentOverlaps(p, seg) && p.x < seg.seg;
}

/**
 * Test if point `p` resides on `seg`.
 *
 * @param p The point to test.
 * @param seg The `RectiSegment` to check.
 * @returns `true` if `p` resides on `seg` and `false` otherwise.
 */
function pointOnRectiSegmentEdge(p: Point, seg: RectiSegment): boolean {
  if(seg.dir === "Horz") {
    return p.y === seg.seg && horzSegmentOverlaps(p, seg);
  } else {
    return p.x === seg.seg && vertSegmentOverlaps(p, seg);
  }
}

/**
 * Test if point `p` resides on an edge of `path`. `path` is assumed
 * to be rectilinear.
 *
 * @param p The point to test.
 * @param path The path whose edges to check.
 * @returns `true` if `p` resides on an edge of `path` and `false`
 * otherwise.
 */
function pointOnPathEdge(p: Point, path: Path): boolean {
  for(const seg of eachRectiSegment(path)) {
    if(pointOnRectiSegmentEdge(p, seg)) {
      return true;
    }
  }
  return false;
}

/**
 * Return one of `a` or `b`, whichever is not equal to `x`.  If
 * neither is equal to `x`, then an error is raised.
 */
function notEqual(a: number, b: number, x: number): number {
  if(a === x) return b;
  else if(b === x) return a;
  else throw new Error("notEqual");
}

/**
 * Count the number of times a ray cast rightwards from point `p`
 * crosses the vertical segments of the rectilinear path `Path`.
 *
 * This function assumes that `path` is a proper rectilinear path; the
 * horizontal and vertical segments should alternate (i.e. there
 * should never be two adjacent vertical or horizontal segments).
 */
function countHorzRayPathIntersections(p: Point, path: Path): number {
  // Based on: https://stackoverflow.com/a/74365627

  let intersections = 0;
  eachRectiSegmentTriple(path, (a, b, c): EachRectiSegmentIterationDecision<null> => {
    if(a.dir === "Vert" && b.dir === "Horz" && c.dir === "Vert") {

      if(vertSegmentToRightOfP(p, a)) {
        intersections += 1;
      }
      // Calculate an adjustment factor for point `p' to determine if
      // it lies inside or outside the polygon. There are two cases to
      // consider:
      //
      //           |    |        |
      //    p      |    |        |
      //     . - - +----+ - - -  +----+ - - - >
      //                              |
      //                              |
      //
      //            (-2)          (-1)
      //         Not counted  Counted once

      // Test that `b` occurs strictly to the right of `p`, and that
      // `p` is colinear with `b`.
      if(p.x < Math.min(b.begin, b.end) && b.seg === p.y) {
        // Find the y-coordinate of segment `a` which is not equal to
        // the y-coordinate of `p`.
        const aExtreme = notEqual(a.begin, a.end, p.y);
        // Find the y-coorindate of segment `c` which is not equal to
        // the y-coordinate of `p`.
        const cExtreme = notEqual(c.begin, c.end, p.y);

        // `aSide` and `bSide` are `true` if they are _above_ `p`, and
        // `false` otherwise.
        const aSide = aExtreme < p.y;
        const cSide = cExtreme < p.y;

        // Differentiate between case 1 and 2.
        intersections += aSide === cSide ? -2 : -1;
      }
    } else if(a.dir === "Vert" && vertSegmentToRightOfP(p, a)) {
      intersections += 1;
    }

    return { type: "None" };
  });
  return intersections;
}

/**
 * Check if a number is odd.
 *
 * @param n The number to check.
 * @returns `true` if `n` is odd, and `false` otherwise.
 */
function isOdd(n: number): boolean {
  return n % 2 !== 0;
}

/**
 * Test if point `p` is inside `path`. `path` is assumed to be
 * rectilinear.
 *
 * @param p The point to check.
 * @param path The `Path` which `p` will be checked against.
 * @param includeEdges A flag which determines if points residing on
 * an edge of `path` will be considered inside `path` or not.
 * @returns `true` if `p` is inside `path` and `false` otherwise.
 */
export function pointInPath(p: Point, path: Path, includeEdges: "IncludeEdges" | "ExcludeEdges"): boolean {
  const inPath = isOdd(countHorzRayPathIntersections(p, path));
  if(includeEdges === "IncludeEdges") {
    return pointOnPathEdge(p, path) || inPath;
  } else {
    return !pointOnPathEdge(p, path) && inPath;
  }
}

/**
 * Test if point `p` is inside `polygon`. `polygon` is assumed to be
 * rectilinear, and points on the edge of the polygon are considered
 * to be _inside_ the polygon.
 *
 * @param p The point to check.
 * @param polygon The `Polygon` which `p` will be checked against.
 * @returns `true` if `p` is inside `polygon` and `false` otherwise.
 */
export function pointInPolygon(p: Point, polygon: Polygon): boolean {
  if(polygon.some(path => pointOnPathEdge(p, path))) {
    return true;
  }

  let sum = 0;
  for(const path of polygon) {
    sum += countHorzRayPathIntersections(p, path);
  }
  return isOdd(sum);
}

/**
 * Check if a rectangle intersects a path (edges excluded).
 *
 * @param rect The rectangle.
 * @param path The path.
 * @returns `true` if `rect` interescts `path` and `false` otherwise.
 */
export function rectIntersectsPath(rect: Rect, path: Path): boolean {
  return rectPathIntersectionArea(rect, path) > 0.0001;
}

/**
 * Check if a rectangle is entirely contained within a path.
 *
 * @param rect The rectangle.
 * @param path The path.
 * @returns `true` if `rect` is entirely contained within `path` and
 * `false` otherwise.
 */
export function rectContainedWithinPath(rect: Rect, path: Path): boolean {
  const rectArea = width(rect) * height(rect);
  const isectArea = rectPathIntersectionArea(rect, path);
  return Math.abs(rectArea - isectArea) < 0.0001;
}

/**
 * Check if a rectangle intersects any of the paths in a polygon.
 *
 * @param rect The rectangle.
 * @param polygon The polygon.
 * @returns `true` if `rect` intersects some path in `polygon` and
 * `false` otherwise.
 */
function rectIntersectsAnyPath(rect: Rect, polygon: Polygon): boolean {
  return polygon.some(path => rectIntersectsPath(rect, path));
}

/**
 * Check if a rectangle is contained entirely within one of the paths
 * in a polygon.
 *
 * @param rect The rectangle.
 * @parab polygon The polygon.
 * @returns `true` if `rect` is entirely contained within some path of
 * the `polygon`.
 */
function rectContainedWithinSome(rect: Rect, polygon: Polygon): boolean {
  return polygon.some(path => rectContainedWithinPath(rect, path));
}

type Interval = [number, number];

/**
 * Test if two intervals intersect.
 *
 * @param a The first interval.
 * @param b The second interval.
 * @returns `true` if `a` and `b` intersect, and `false` otherwise.
 */
function intervalsIntersect(a: Interval, b: Interval): boolean {
  const [b1, e1] = a;
  const [b2, e2] = b;

  return b1 <= e2 && b2 <= e1;
}

/**
 * Calculate the area that a path and a rectangle intersect.
 *
 * @param rect The rectangle.
 * @param path The path.
 * @returns The area of intersection between `rect` and `path`.
 */
export function rectPathIntersectionArea(rect: Rect, path: Path): number {
  // Algorithm:
  //
  // 1. Sweep a line through every horizontal segment of `p`, keeping
  //    those which horizontally overlap some part of `r`.
  // 2. Clamp the intervals to the sides of `r`.
  // 3. Calculate the area from the top of the interval to the bottom
  //    of the rectangle, adding it to the total if the interval is
  //    from the top of a shape, and subtracting it if it's from the
  //    bottom.
  // 4. If the area is above zero, then there's an intersection.

  type Side = "Top" | "Bottom";
  type SweepEvent = {
    /**
     * Does this sweep event correspond to a segment at the top or
     * bottom of `p` or `r`?
     */
    side: Side;
    /**
     * The y-coordinate of the interval.
     */
    yCoordinate: number;
    /**
     * The interval of x-coordinates covered by this horizontal
     * segment.
     */
    interval: Interval;
  };

  const events: SweepEvent[] = [];

  // Add sweep events due to `p`.
  for(const seg of eachRectiSegment(path)) {
    const interval: Interval = [Math.min(seg.begin, seg.end), Math.max(seg.begin, seg.end)];
    if(seg.dir === "Vert" || !intervalsIntersect([rect.left, rect.right], interval)) {
      continue;
    }

    events.push({
      side: directionOfSegment(seg) === "West" ? "Top" : "Bottom",
      yCoordinate: seg.seg,
      // Truncate each interval overlapping `r` to touch at least one
      // side of `r`.
      interval: [Math.max(interval[0], rect.left), Math.min(interval[1], rect.right)]
    });
  }

  const cmpEvents = (a: SweepEvent, b: SweepEvent): number => {
    if(a.yCoordinate === b.yCoordinate) {
      if(a.side === b.side) {
        return 0;
      } else if(a.side === "Top") {
        return -1;
      } else {
        return 1;
      }
    } else {
      return a.yCoordinate - b.yCoordinate;
    }
  };

  events.sort(cmpEvents);

  let area: number = 0;
  for(const event of events) {
    // Clamp the event's yCoordinate to the top and bottom of the
    // rectangle.
    event.yCoordinate = Math.max(rect.top, Math.min(rect.bottom, event.yCoordinate));

    const intervalArea =
          Math.abs(event.interval[0] - event.interval[1])
            * Math.abs(rect.bottom - event.yCoordinate);

    area += event.side === "Top" ? intervalArea : -intervalArea;
  }

  return area;
}

/**
 * Find the "opening" direction of an antiknob. The opening direction
 * is the direction that the back face of the antiknob should be
 * translated to close the antiknob.
 *
 * @param a The first corner.
 * @param b The second corner.
 * @returns The opening direction of the antiknob, or `null` if the
 * corners don't constitute an antiknob.
 */
function antiknobDirection(a: Corner, b: Corner): Direction | null {
  if(a === "WestNorth" && b === "NorthEast") return "East";
  if(a === "SouthWest" && b === "WestNorth") return "North";
  if(a === "EastSouth" && b === "SouthWest") return "West";
  if(a === "NorthEast" && b === "EastSouth") return "South";
  return null;
}

/**
 * Find the maximum value of a segment along the given direction.
 *
 * @param d The `Direction` to maximize.
 * @param seg The `Segment` along which to search.
 * @returns The maximum value (a number) along dir.
 */
function valueAlongDirection(d: Direction, seg: RectiSegment): number {
  switch(d) {
    case "East": {
      if(seg.dir === "Horz") {
        return Math.max(seg.begin, seg.end);
      } else {
        return seg.seg;
      }
    }
    case "West": {
      if(seg.dir === "Horz") {
        return Math.min(seg.begin, seg.end);
      } else {
        return seg.seg;
      }
    }
    case "North": {
      if(seg.dir === "Horz") {
        return seg.seg;
      } else {
        return Math.min(seg.begin, seg.end);
      }
    }
    case "South": {
      if(seg.dir === "Horz") {
        return seg.seg;
      } else {
        return Math.max(seg.begin, seg.end);
      }
    }
  }
}

/**
 * Try to remove antiknobs from `path`.
 *
 * @param path The `Path` to remove antiknobs from.
 * @param keepInside A `Polygon` to stay inside of. Simplifications
 * which would cause the `path` to leave `keepInside` will be ignored.
 * @param keepOutside A `Polygon` to keep outside of. Simplifications
 * which would cause the `path` to overlap any of the paths in
 * `keepOutside` will be ignored.
 * @returns `true` if at least one antiknob was removed, and `false`
 * otherwise.
 */
export function tryToRemoveAntiknobs(path: Path, keepInside?: Polygon, keepOutside?: Polygon): boolean {
  //          ^
  //          |
  //  +---c---+
  //  |       ^ far value
  //  b
  //  |
  //  +-a--+
  //       |
  //       v
  //       ^
  //  ^    near value
  //  back value
  let atLeastOneRemoved = false;
  eachRectiSegmentTriple(path, (a, b, c) => {
    const aDir = directionOfSegment(a);
    const bDir = directionOfSegment(b);
    const cDir = directionOfSegment(c);
    const ab = cornerFromDirections(aDir, bDir);
    const bc = cornerFromDirections(bDir, cDir);
    const backDir = antiknobDirection(ab, bc);

    // The corners ab and bc don't constitute an antiknob. We should
    // try some other corners.
    if(backDir === null) {
      return { type: "None" };
    }

    const nearValue = valueAlongDirection(backDir, a);
    const backValue = valueAlongDirection(backDir, b);
    const farValue  = valueAlongDirection(backDir, c);

    // Find the distance of each segment to the back face.
    const dNearBack = Math.abs(backValue - nearValue);
    const dFarBack  = Math.abs(backValue - farValue);

    // Find a rectangle which covers the area which will be covered by
    // the polygon once the antiknob is removed. We need to check that
    // this area:
    //   1. Doesn't intersect any part of the existing polygon,
    //   2. Is entirely inside the `keepInside` polygon, and
    //   3. Is entirely outside the `keepOut` polygon.
    const newArea = dNearBack < dFarBack
      ? rectOfRectiSegments(a, b)
      : rectOfRectiSegments(b, c);

    if(rectIntersectsPath(newArea, path)) {
      // The simplification would cause the path to intersect
      // itself. So we'll try somewhere else.
      return { type: "None" };
    }

    if(keepOutside && rectIntersectsAnyPath(newArea, keepOutside)) {
      // The simplification would intersect the `keepOutside` polygon,
      // so we'll try somewhere else.
      return { type: "None" };
    }

    if(keepInside && !rectContainedWithinSome(newArea, keepInside)) {
      // The simplification would cause the polygon to exit the
      // `keepInside` polygon, so we'll try somewhere else.
      return { type: "None" };
    }

    atLeastOneRemoved = true;
    if(dNearBack === dFarBack) {
      // Then, near value and far value are the same, so we should
      // remove all nodes in the antiknob.
      return {
        type: "Delete",
        deleteA: true,
        deleteB: true,
        deleteC: true,
        deleteD: true
      };
    } else if(dNearBack < dFarBack) {
      //      ^          ^
      //      |          |
      // +--O-+       +--+  O = newNodePos
      // |       ==>  |
      // |            |
      // +--+         |
      //    |         |
      //    v         v
      if(a.dir === "Horz") {
        a.beginP.y = c.seg;
      } else {
        a.beginP.x = c.seg;
      }
      return { type: "Delete", deleteB: true, deleteC: true };
    } else {
      //    ^         ^
      //    |         |
      // +--+         |
      // |       ==>  |
      // |            |
      // +--O-+       +--+   O = newNodePos
      //      |          |
      //      v          v
      if(c.dir === "Horz") {
        c.endP.y = a.seg;
      } else {
        c.endP.x = a.seg;
      }
      return { type: "Delete", deleteB: true, deleteC: true };
    }
  });

  return atLeastOneRemoved;
}

/**
 * Test if the turn defined by points `a` `b` and `c` constitute a
 * clockwise turn.
 *
 * @param a The first point.
 * @param b The second point.
 * @param c The third point.
 * @returns `true` if the corner formed by segments `ab` and `bc` form
 * a clockwise turn.
 */
function isTurnCW(a: Point, b: Point, c: Point): boolean {
  return cross(subPoints(b, a), subPoints(c, b)) > 0;
}

/**
 * Try to remove clockwise corners from `path`.
 *
 * @param path The `Path` to remove clockwise corners from.
 * @param keepInside A `Polygon` to stay inside of. Simplifications
 * which would cause the `path` to leave `keepInside` will be ignored.
 * @param keepOutside A `Polygon` to keep outside of. Simplifications
 * which would cause the `path` to overlap any of the paths in
 * `keepOutside` will be ignored.
 * @returns `true` if at least one corner was removed, and `false`
 * otherwise.
 */
export function tryToRemoveClockwiseCorners(path: Path, keepInside?: Polygon, keepOutside?: Polygon): boolean {
  let atLeastOneRemoved = false;
  eachTripleInPath(path, (a, b, c) => {
    // This turn isn't clockwise, so skip it and try to find a
    // different clockwise corner.
    if(!isTurnCW(a, b, c)) {
      return { type: "None" };
    }

    const ab = mkRectiSegment(a, b);
    const bc = mkRectiSegment(b, c);

    // Find a rectangle which covers the area which will be covered by
    // the polygon once the corner is removed. We need to check that
    // this area:
    //   1. Doesn't intersect any part of the existing polygon,
    //   2. Is entirely inside the `keepInside` polygon, and
    //   3. Is entirely outside the `keepOut` polygon.
    const newArea =  rectOfRectiSegments(ab, bc);

    if(rectIntersectsPath(newArea, path)) {
      // The simplification would cause the path to intersect
      // itself. So we'll try somewhere else.
      return { type: "None" };
    }

    if(keepOutside && rectIntersectsAnyPath(newArea, keepOutside)) {
      // The simplification would intersect the `keepOutside` polygon,
      // so we'll try somewhere else.
      return { type: "None" };
    }

    if(keepInside && !rectContainedWithinSome(newArea, keepInside)) {
      // The simplification would cause the polygon to exit the
      // `keepInside` polygon, so we'll try somewhere else.
      return { type: "None" };
    }

    // Calculate a vector by which we can offset point `b` turning it
    // "inside out."
    //
    //         c                c  b
    //  ------+          ------+--+
    //        |                   |
    //        +--+ a  ==>         + a
    //       b   |                |
    //           |                |
    //
    // We can accomplish the above transformation of `b` by always
    // moving _opposite_ the segment ab and _along_ the direction of
    // the segment bc.

    let dx, dy;
    if(ab.dir === "Horz") {
      assert(bc.dir === "Vert");
      dx = ab.begin - ab.end;
      dy = bc.end - bc.begin;
    } else {
      assert(bc.dir === "Horz");
      dx = bc.end - bc.begin;
      dy = ab.begin - ab.end;
    }

    // Move point b.
    b.x += dx;
    b.y += dy;

    // Delete its neighbors.
    atLeastOneRemoved = true;
    return {
      type: "Delete",
      deletePrev: true,
      deleteNext: true
    }
  });
  return atLeastOneRemoved;
}

/**
 * Simplify a `path`, ensuring that the path stays within `keepInside`
 * and outside of `keepOutside`.
 *
 * @param keepInside The polygon to keep `path` inside of.
 * @param keepOutside The polygon to keep `path` outside of.
 * @path path The path to simplify.
 */
function simplifyPath(keepInside: Polygon, keepOutside: Polygon, path: Path) {
  while(
    tryToRemoveAntiknobs(path, keepInside, keepOutside) ||
      tryToRemoveClockwiseCorners(path, keepInside, keepOutside))
    {}
}

/**
 * Simplify the polygons in `polygons`, ensuring that none of them
 * intersect each other and also stay inside `keepInside`.
 *
 * @param keepInside The polygon to keep `polygons` inside of.
 * @param polygons The polygons to simplify.
 */
export function simplifyPolygons(keepInside: Polygon, polygons: Polygon[]) {
  const allPaths: Path[] = polygons.flat();

  for(let i = 0; i < allPaths.length; ++i) {
    // Form a `keepOutside` polygon of each of the _other_ paths in
    // `polygons`.
    const keepOutside: Polygon = [];

    for(let j = 0; j < allPaths.length; ++j) {
      if(i !== j) {
        keepOutside.push(allPaths[j]);
      }
    }

    simplifyPath(keepInside, keepOutside, allPaths[i]);
  }
}

/**
 * Calculate the bounding box of a `Path`.
 *
 * @param path The `Path` whose bounding box to calculate.
 * @returns A `Rect` representing `path`'s bounding box, or `null` if
 * `path` is empty.
 */
export function boundingBoxOfPath(path: Path): Rect | null {
  if(path.length === 0) {
    return null;
  }

  const firstPoint = path[0];
  let bbox: Rect = {
    left: firstPoint.x,
    top: firstPoint.y,
    right: firstPoint.x,
    bottom: firstPoint.y
  };

  for(let i = 1; i < path.length; ++i) {
    bbox = expandToInclude(bbox, path[i]);
  }

  return bbox;
}

/**
 * Return a point representing `p` translated along `dir` by `amt`.
 *
 * @param p The point to translate.
 * @param dir The direction to translate `p`.
 * @param amt The amount to translate `p` along `dir`.
 */
function translateAlongDirection(p: Point, dir: Direction, amt: number): Point {
  const out = {...p};
  switch(dir) {
    case "North": out.y -= amt; break;
    case "East":  out.x += amt; break;
    case "South": out.y += amt; break;
    case "West":  out.x -= amt; break;
  }
  return out;
}

/**
 * Check if a segment should be drawn based on the properties of the
 * `BorderStyle`.
 *
 * @param seg The segment to query.
 * @param border The border properties.
 * @returns `true` if `seg` should be drawn, and `false` otherwise.
 */
function shouldDrawSegment(seg: RectiSegment, border: BorderStyle): boolean {
  switch(directionOfSegment(seg)) {
    case "North": return border.borderRight;
    case "East":  return border.borderBottom;
    case "South": return border.borderLeft;
    case "West":  return border.borderTop;
  }
}

/**
 * Construct an SVG path string corresponding to the given `path`.
 *
 * @param path The path to convert to an SVG path string.
 * @param border The properties of the border.
 * @returns An SVG path string.
 */
function pathStringOfPath(path: Path, border: Partial<BorderStyle>): string {
  let borderNonPartial = {...DEFAULT_BORDER_STYLE, ...border};

  path = offsetPath(borderNonPartial.borderOffset, path);

  /**
   * Keep track of if this path should continue from the previous
   * triple, or start anew.
   */
  let pathContinues: boolean = false;

  /**
   * The output path string under construction.
   */
  let out: string = "";

  for(let i = 0; i < path.length; ++i) {
    const a = path[(i + 0) % path.length];
    const b = path[(i + 1) % path.length];
    const c = path[(i + 2) % path.length];

    const ab = mkRectiSegment(a, b);
    const bc = mkRectiSegment(b, c);
    const abDir = directionOfSegment(ab);
    const bcDir = directionOfSegment(bc);

    const shouldDrawAB = shouldDrawSegment(ab, borderNonPartial);
    const shouldDrawBC = shouldDrawSegment(bc, borderNonPartial);

    const abLen  = lengthOfSegment(ab);
    const bcLen = lengthOfSegment(bc);

    // Find the actual radius of the corner, ensuring that we don't try
    // to generate a radius which is larger than half the length of one
    // of the adjoining segments.
    const actualRadius = Math.min(borderNonPartial.borderRadius, Math.min(abLen, bcLen) / 2);

    if(!pathContinues) {
      // If the path is not continuing, then we need to issue a move
      // command before drawing any more segments.
      const p = translateAlongDirection(a, abDir, actualRadius);
      out += `M ${p.x} ${p.y} `;
    }

    if(shouldDrawAB && shouldDrawBC) {
      pathContinues = true;

      if(actualRadius === 0) {
        // If the radius is zero, just draw a line immediately to point `b`.
        out += `L ${b.x} ${b.y} `
      } else {
        // Find points representing the begining and end of the corner arc.
        const arcBegin: Point = translateAlongDirection(b, abDir, -actualRadius);
        const arcEnd:   Point = translateAlongDirection(b, bcDir,  actualRadius);

        out += `L ${arcBegin.x} ${arcBegin.y} A ${actualRadius} ${actualRadius} 0 0 ${isTurnCW(a, b, c) ? "1" : "0"} ${arcEnd.x} ${arcEnd.y} `;
      }
    } else if(shouldDrawAB) {
      // Just AB is drawn, so don't build a rounded corner. Also
      // record the fact that we've stopped drawing the path.
      pathContinues = false;
      const p = translateAlongDirection(b, abDir, -actualRadius);
      out += `L ${p.x} ${p.y} `;
    } else {
      // Don't draw anything.
      pathContinues = false;
    }
  };

  return out + (pathContinues ? " Z" : "");
}

export class PolygonRendering extends Render {
  polygon: Polygon;

  constructor(polygon: Polygon) {
    super();
    this.polygon = polygon;
  }

  render(svg: Svg, sty: SVGStyle) {
    for(const path of this.polygon) {
      if(path.length <= 2) {
        continue;
      }

      // Choose the radius of the fill to be the radius of the nearest
      // border, adjusted by the offset of said border.
      let nearestBorder: Partial<BorderStyle> | undefined = undefined;
      for(const border of sty.borders) {
        if(nearestBorder === undefined) {
          nearestBorder = border;
        } else if(border.borderOffset === undefined) {
          nearestBorder = border;
          break;
        } else if(border.borderOffset < nearestBorder.borderOffset!) {
          nearestBorder = border;
        }
      }

      const borderRadius = Math.max(
        (nearestBorder?.borderRadius ?? 0) - (nearestBorder?.borderOffset ?? 0),
        0
      );

      // Draw fill
      svg
        .path(pathStringOfPath(path, { ...DEFAULT_BORDER_STYLE, borderRadius }))
        .fill(sty.fill ?? "none");
      // Draw borders
      for(const border of sty.borders) {
        svg
          .path(pathStringOfPath(path, border))
          .stroke(border.borderStroke)
          .strokeWidth(border.borderWidth)
          .fill("none");
      }
    }
  }

  boundingBox(): Rect | null {
    let bbox: Rect | null = null;

    for(const path of this.polygon) {
      const bboxOfPath = boundingBoxOfPath(path);
      if(bboxOfPath === null) {
        continue;
      }

      if(bbox === null) {
        bbox = bboxOfPath;
      } else {
        bbox = union(bboxOfPath, bbox);
      }
    }

    return bbox;
  }
}
