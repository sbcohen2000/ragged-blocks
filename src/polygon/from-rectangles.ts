import assert from "../assert";
import { IntervalTree } from "@sbcohen/containers";
import { Point } from "../point";
import { Polygon, Path } from "../polygon";
import { Rect, width, height } from "../rect";

export type Interval = [number, number];

/**
 * Test if two intervals intersect.
 *
 * @param a The first interval.
 * @param b The second interval.
 * @returns `true` if `a` and `b` intersect, and `false` otherwise.
 */
export function intervalsIntersect(a: Interval, b: Interval): boolean {
  const [b1, e1] = a;
  const [b2, e2] = b;

  return b1 <= e2 && b2 <= e1;
}

/**
 * Subtract interval `b` from interval `a`, yielding a new interval
 * set.
 *
 * @param a The minuend.
 * @param b The subtrahend.
 * @returns A new interval set.
 */
export function subIntervalInterval(a: Interval, b: Interval): Interval[] {
  if(!intervalsIntersect(a, b)) {
    return [[...a]];
  }

  const [b1, e1] = a;
  const [b2, e2] = b;

  if(b2 <= b1 && e2 >= e1) {
    return [];
  } else if(e2 >= e1) {
    return [[b1, b2]];
  } else if(b2 <= b1) {
    return [[e2, e1]];
  } else {
    return [[b1, b2], [e2, e1]];
  }
}

/**
 * Subtract interval `b` from every interval in `as`.
 *
 * @param as The minuends.
 * @param b The subtrahend.
 * @returns A new interval set.
 */
export function subIntervalsInterval(as: Interval[], b: Interval): Interval[] {
  return as.flatMap(a => subIntervalInterval(a, b));
}

/**
 * Subtract the intervals `bs` from the interval `a`.
 *
 * @param a The minuend.
 * @param bs The subtrahends.
 * @returns A new interval set.
 */
export function subIntervalIntervals(a: Interval, bs: Interval[]): Interval[] {
  return bs.reduce((as, b) => subIntervalsInterval(as, b), [a]);
}

type IntervalSet = Map<number, Interval>;

/**
 * Add an interval to the interval set, returning the set of intervals
 * which weren't already present in the set.
 *
 * @param interval The new interval.
 * @param index The index to associate with the new interval.
 * @param intervalSet The interval set which will recieve `interval`.
 * @returns The set of intervals which are "new" to `intervalSet`.
 */
function addInterval(interval: Interval, index: number, intervalSet: IntervalSet): Interval[] {
  const notCovered = subIntervalIntervals(interval, [...intervalSet.values()]);
  intervalSet.set(index, interval);
  return notCovered;
}

/**
 * Delete an interval from the interval set, returning the set of
 * intervals which are no longer covered by the set.
 *
 * @param index The index of the element to remove from the set.
 * @param intervalSet The interval set from which to remove the
 * element with `index`.
 * @returns The set of intervals which are no longer covered by
 * `intervalSet`.
 */
function deleteInterval(index: number, intervalSet: IntervalSet): Interval[] {
  const theInterval = intervalSet.get(index);
  assert(theInterval !== undefined, "Tried to delete non-existent interval");
  intervalSet.delete(index);
  const notCovered = subIntervalIntervals(theInterval, [...intervalSet.values()]);
  return notCovered;
}

type Side = "In" | "Out";

type SweepEvent = {
  /**
   * Does this sweep event correspond to entering or exiting the
   * rectangle?
   */
  side: Side;
  /**
   * The index of the rectangle belonging to this `SweepEvent`.
   */
  rectIndex: number;
  /**
   * The coordinate along the side of the rectangle which gives rise
   * to this sweep event. (If the edge was vertical, then this is an
   * x-coordinate. Otherwise, it's a y-coordinate.)
   */
  sideCoordinate: number;
  /**
   * The interval of (x/y)-coordinates covered by this rectangle.
   */
  interval: Interval;
};

/**
 * Given a list of rectangles, produce two lists of sweep events which
 * are ordered by y and x coordinates respectively. If two sweep
 * events have the same (x/y)-coordinate, then sweep events due to
 * entering a rectangle appear first in the output list.
 *
 * @param rectangles The list of `Rect`s.
 * @returns A tuple of lists of `SweepEvent`s, the first element
 * corresponding to the vertical sweep events, and the second list
 * corresponding to the horizontal sweep events.
 */
function compileSweepEvents(rectangles: Rect[]): [SweepEvent[], SweepEvent[]] {
  const verticalEvents: SweepEvent[] = [];
  const horizontalEvents: SweepEvent[] = [];

  for(let i = 0; i < rectangles.length; ++i) {
    const rect = rectangles[i];

    // Skip events for rectangles with no width or height.
    if(width(rect) === 0 || height(rect) === 0) {
      continue;
    }

    const vertInterval: Interval = [rect.top, rect.bottom];
    const horzInterval: Interval = [rect.left, rect.right];
    verticalEvents.push({
      side: "In",
      rectIndex: i,
      sideCoordinate: rect.top,
      interval: horzInterval
    }, {
      side: "Out",
      rectIndex: i,
      sideCoordinate: rect.bottom,
      interval: horzInterval
    });

    horizontalEvents.push({
      side: "In",
      rectIndex: i,
      sideCoordinate: rect.left,
      interval: vertInterval,
    }, {
      side: "Out",
      rectIndex: i,
      sideCoordinate: rect.right,
      interval: vertInterval
    });
  }

  const cmpEvents = (a: SweepEvent, b: SweepEvent): number => {
    if(a.sideCoordinate === b.sideCoordinate) {
      if(a.side === b.side) {
        return 0;
      } else if(a.side === "In") {
        return -1;
      } else {
        return 1;
      }
    } else {
      return a.sideCoordinate - b.sideCoordinate;
    }
  };

  verticalEvents.sort(cmpEvents);
  horizontalEvents.sort(cmpEvents);
  return [verticalEvents, horizontalEvents];
}

type Segment = {
  /**
   * The set of coordinates normal to the interval.
   */
  segCoordinates: Set<number>,
  interval: Interval
};

type Segments = IntervalTree<Segment>;

/**
 * Delete a segment from `segments` given its `interval` and
 * `segCoordinate`.
 *
 * @param interval The interval the segment covers.
 * @param segCoordinate The coordinate normal to the interval.
 * @param segments The `IntervalTree` to modify.
 */
function deleteSegment(interval: Interval, segCoordinate: number, segments: Segments) {
  const seg = segments.get(interval);
  if(seg === undefined) {
    return;
  }

  const set = seg.segCoordinates;
  set.delete(segCoordinate);

  // If we removed the last segment in the set, remove the interval
  // from the `IntervalTree`.
  if(set.size === 0) {
    segments.delete(interval);
  }
}

/**
 * Add a new segment to the interval tree given by `segments`, being
 * careful to merge segments which are abutting.
 *
 * @param interval The interval of the segment.
 * @param segCoordinate The coordinate normal to the interval.
 * @param segments The `IntervalTree` to modify.
 */
function addSegment(interval: Interval, segCoordinate: number, segments: Segments) {
  const merge: { interval: Interval, segCoordinate: number }[] = [];
  for(const isect of segments.search([interval[0], interval[0]])) {
    const [b, e] = isect.interval;
    if(isect.segCoordinates.has(segCoordinate) && (b === interval[0] || e === interval[0])) {
      // Then, we've found an interval whose endpoint matches up with
      // the _begin_ point of interval.
      merge.push({ interval: isect.interval, segCoordinate });
    }
  }

  for(const isect of segments.search([interval[1], interval[1]])) {
    const [b, e] = isect.interval;
    if(isect.segCoordinates.has(segCoordinate) && (b === interval[1] || e === interval[1])) {
      // Then, we've found an interval whose endpoint touches the
      // _endpoint_ of interval.
      merge.push({ interval: isect.interval, segCoordinate });
    }
  }

  let min = interval[0];
  let max = interval[1];
  for(const isect of merge) {
    min = Math.min(min, isect.interval[0]);
    max = Math.max(max, isect.interval[1]);

    // Remove the segment from `segments`.
    deleteSegment(isect.interval, isect.segCoordinate, segments);
  }

  // Finally, add an interval which covers all of the merged intervals
  // to `segments`.
  interval = [min, max];
  const seg = segments.get(interval);
  if(seg === undefined) {
    segments.set(interval, { interval, segCoordinates: new Set([segCoordinate]) });
  } else {
    seg.segCoordinates.add(segCoordinate);
  }
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
 * Search through `segments` to find a point which is equal to a
 * segment endpoint. Once found, return the point on the other end of
 * the found segment, and delete the found segment.
 *
 * @param dir Are we looking for vertical or horizontal segments?
 * @param point The point to query.
 * @param segments The segments to look through (they are assumed to
 * be horizontal if `dir` is "Horz" and vertical if `dir` is "Vert".
 * @returns The point at the end of the segment whose other endpoint
 * is `point`.
 */
function findAndRemoveSegmentTouchingPoint(dir: "Vert" | "Horz", point: Point, segments: Segments): Point {
  if(dir === "Vert") {
    for(const isect of segments.search([point.y, point.y])) {
      if(isect.segCoordinates.has(point.x)) {
        deleteSegment(isect.interval, point.x, segments);
        return { x: point.x, y: notEqual(isect.interval[0], isect.interval[1], point.y) };
      }
    }
  } else {
    for(const isect of segments.search([point.x, point.x])) {
      if(isect.segCoordinates.has(point.y)) {
        deleteSegment(isect.interval, point.y, segments);
        return { x: notEqual(isect.interval[0], isect.interval[1], point.x), y: point.y };
      }
    }
  }

  throw new Error("No segment at point!");
}

/**
 * Find the top-leftmost point in an `IntervalTree` of `Segment`s.
 * The segments are assumed to be horizontal.
 *
 * @param segments The `Segments` to search through.
 * @returns A `Point` representing the top-leftmost point, or `null`
 * if `segments` is empty.
 */
function topLeftPoint(horzSegments: Segments): Point | null {
  let min: Point | null = null;

  for(const [_, seg] of horzSegments.entries()) {
    const [b, e] = seg.interval;
    const x = Math.min(b, e);
    for(const y of seg.segCoordinates) {
      const candidate: Point = { x, y };
      if(min === null) {
        min = candidate;
      } else if(candidate.y < min.y) {
        min = candidate;
      } else if(candidate.y === min.y && candidate.x < min.x) {
        min = candidate;
      }
    }
  }

  return min;
}

/**
 * Produce a polygon from a list of rectangles.
 *
 * @param rectangles The list of `Rect`s.
 * @returns A new `Polygon`.
 */
export function fromRectangles(rectangles: Rect[]): Polygon {
  let activeIntervals: IntervalSet = new Map();
  const [vertEvents, horzEvents] = compileSweepEvents(rectangles);

  // First, build two interval trees which contain all of the
  // horizontal and vertical segments of the polygon.
  const horzSegments: Segments = new IntervalTree();
  const vertSegments: Segments = new IntervalTree();

  for(const event of vertEvents) {
    const uncoveredIntervals = event.side === "In"
      ? addInterval(event.interval, event.rectIndex, activeIntervals)
      : deleteInterval(event.rectIndex, activeIntervals);

    for(const ival of uncoveredIntervals) {
      addSegment(ival, event.sideCoordinate, horzSegments);
    }
  }

  for(const event of horzEvents) {
    const uncoveredIntervals = event.side === "In"
      ? addInterval(event.interval, event.rectIndex, activeIntervals)
      : deleteInterval(event.rectIndex, activeIntervals);

    for(const ival of uncoveredIntervals) {
      addSegment(ival, event.sideCoordinate, vertSegments);
    }
  }

  /*
  console.log("vertical segments: ");
  for(const [_, vSeg] of vertSegments.entries()) {
    console.log(vSeg);
  }

  console.log("horizontal segments: ");
  for(const [_, hSeg] of horzSegments.entries()) {
    console.log(hSeg);
  } */

  // Then, merge the horizontal and vertical segments into a set of
  // paths.
  let polygon: Polygon = [];
  for(;;) {
    let path: Path = [];
    let lookingFor: "Vert" | "Horz" = "Vert";

    const firstPoint: Point | null = topLeftPoint(horzSegments);
    if(firstPoint === null) {
      break;
    }

    let cur: Point = {...firstPoint}

    do {
      path.push(cur);
      cur = findAndRemoveSegmentTouchingPoint(
        lookingFor,
        cur,
        lookingFor === "Vert" ? vertSegments : horzSegments
      );

      lookingFor = lookingFor === "Vert" ? "Horz" : "Vert";
    } while(cur.x !== firstPoint.x || cur.y !== firstPoint.y);

    polygon.push(path);
  }

  return polygon;
}
