import { Point } from "../../src/point";
import { Rect } from "../../src/rect";
import { expect, test } from "@jest/globals";
import { intervalsIntersect, subIntervalInterval, subIntervalIntervals, fromRectangles } from "../../src/polygon/from-rectangles";
import { isPathCCW } from "../../src/polygon";

function p(x: number, y: number): Point {
  return { x, y };
}

function r(x: number, y: number, w: number, h: number): Rect {
  return {
    left: x,
    top: y,
    right: x + w,
    bottom: y + h
  }
}

test("Can test if two intervals intersect", () => {
  expect(intervalsIntersect([0, 1], [1, 2])).toBeTruthy();
  expect(intervalsIntersect([0.5, 0.75], [0.51, 1.0])).toBeTruthy();
  expect(intervalsIntersect([-10, -9], [0, 0.1])).toBeFalsy();
});

test("Can subtract two intervals", () => {
  expect(subIntervalInterval(
    [3.33, 6.1],
    [3, 3.66])
  ).toStrictEqual([[3.66, 6.1]]);

  expect(subIntervalInterval(
    [1.5, 1.8],
    [1.8, 2.0])
  ).toStrictEqual([[1.5, 1.8]]);

  expect(subIntervalInterval(
    [1.0, 2.0],
    [10.0, 20.0])
  ).toStrictEqual([[1.0, 2.0]]);

  expect(subIntervalInterval(
    [1.0, 2.0],
    [-10.0, 20.0])
  ).toStrictEqual([]);

  expect(subIntervalInterval(
    [-3.1, 3.4],
    [-1.0, 1.2])
  ).toStrictEqual([[-3.1, -1.0], [1.2, 3.4]]);
});

test("Can subtract an interval set from an interval", () => {
  expect(subIntervalIntervals(
    [0.0, 10.0],
    [
      [-1.2, 3.14],
      [5.1, 5.2],
      [9.0, 11.0],
      [12.0, 14.0]
    ])
  ).toStrictEqual([[3.14, 5.1], [5.2, 9.0]]);

  expect(subIntervalIntervals(
    [0.0, 10.0],
    [
      [1.5, 2.5],
      [2.5, 3.5],
      [2.0, 3.0],
      [1.0, 2.0],
    ])
  ).toStrictEqual([[0.0, 1.0], [3.5, 10.0]]);
});


test("Can find the polygon for a single rectangle", () => {
  const pgon = fromRectangles([
    r(0, 0, 10, 10)
  ]);
  expect(pgon.length).toBe(1);

  const path = pgon[0];

  expect(path).toContainEqual(p( 0, 0));
  expect(path).toContainEqual(p(10, 0));
  expect(path).toContainEqual(p( 0, 10));
  expect(path).toContainEqual(p(10, 10));

  expect(isPathCCW(path)).toBeTruthy();
});

test("Can find the polygon for two disjoint rectangles", () => {
  const pgon = fromRectangles([
    r(0, 0, 10, 10),
    r(20, 20, 10, 10)
  ]);
  expect(pgon.length).toBe(2);

  const path1 = pgon[0];
  const path2 = pgon[1];

  expect(path1).toContainEqual(p( 0, 0));
  expect(path1).toContainEqual(p(10, 0));
  expect(path1).toContainEqual(p( 0, 10));
  expect(path1).toContainEqual(p(10, 10));

  expect(path2).toContainEqual(p(20, 20));
  expect(path2).toContainEqual(p(20, 30));
  expect(path2).toContainEqual(p(30, 30));
  expect(path2).toContainEqual(p(30, 20));

  expect(isPathCCW(path1)).toBeTruthy();
  expect(isPathCCW(path2)).toBeTruthy();
});

test("Can find the polygon for two stacked rectangles (just touching)", () => {
  const pgon = fromRectangles([
    r(0, 0, 10, 10),
    r(0, 10, 10, 10)
  ]);
  expect(pgon.length).toBe(1);

  const path = pgon[0];
  expect(path).toContainEqual(p( 0,  0));
  expect(path).toContainEqual(p(10,  0));
  expect(path).toContainEqual(p( 0, 20));
  expect(path).toContainEqual(p(10, 20));

  expect(isPathCCW(path)).toBeTruthy();
});

test("Can find the polygon for two stacked rectangles (overlapping)", () => {
  const pgon = fromRectangles([
    r(0, 0, 10, 10),
    r(0, 5, 10, 10)
  ]);
  expect(pgon.length).toBe(1);

  const path = pgon[0];
  expect(path).toContainEqual(p( 0,  0));
  expect(path).toContainEqual(p(10,  0));
  expect(path).toContainEqual(p( 0, 15));
  expect(path).toContainEqual(p(10, 15));

  expect(isPathCCW(path)).toBeTruthy();
});

test("Can find the polygon for two offset rectangles", () => {
  const pgon = fromRectangles([
    r(0, 0, 10, 10),
    r(5, 5, 10, 10)
  ]);
  expect(pgon.length).toBe(1);

  const path = pgon[0];
  expect(path).toContainEqual(p( 0,  0));
  expect(path).toContainEqual(p(10,  0));
  expect(path).toContainEqual(p(10,  5));
  expect(path).toContainEqual(p(15,  5));
  expect(path).toContainEqual(p(15, 15));
  expect(path).toContainEqual(p( 5, 15));
  expect(path).toContainEqual(p( 5, 10));
  expect(path).toContainEqual(p( 0, 10));

  expect(isPathCCW(path)).toBeTruthy();
});

test("Can find the polygon for a triangle pattern", () => {
  //    +--+
  //    |  |
  // +--+  +--+
  // |  +--+  |
  // +--+  +--+
  const pgon = fromRectangles([
    r( 5, 0,  5, 15),
    r( 0, 10, 5, 10),
    r(10, 10, 5, 10)
  ]);
  expect(pgon.length).toBe(1);

  const path = pgon[0];
  expect(path.length).toBe(12);
  expect(path).toContainEqual(p( 5,  0));
  expect(path).toContainEqual(p(10,  0));
  expect(path).toContainEqual(p(10, 10));
  expect(path).toContainEqual(p(15, 10));
  expect(path).toContainEqual(p(15, 20));
  expect(path).toContainEqual(p(10, 20));
  expect(path).toContainEqual(p(10, 15));
  expect(path).toContainEqual(p( 5, 15));
  expect(path).toContainEqual(p( 5, 20));
  expect(path).toContainEqual(p( 0, 20));
  expect(path).toContainEqual(p( 0, 10));
  expect(path).toContainEqual(p( 5, 10));

  expect(isPathCCW(path)).toBeTruthy();
});

test("Can find the polygon for an inverted triangle pattern", () => {
  // +--+  +--+
  // |  +--+  |
  // +--+  +--+
  //    |  |
  //    +--+
  const pgon = fromRectangles([
    r( 0, 0, 5, 10),
    r(10, 0, 5, 10),
    r( 5, 5, 5, 15)
  ]);
  expect(pgon.length).toBe(1);

  const path = pgon[0];
  expect(path.length).toBe(12);
  expect(path).toContainEqual(p( 0,  0));
  expect(path).toContainEqual(p( 5,  0));
  expect(path).toContainEqual(p( 5,  5));
  expect(path).toContainEqual(p(10,  5));
  expect(path).toContainEqual(p(10,  0));
  expect(path).toContainEqual(p(15,  0));
  expect(path).toContainEqual(p(15, 10));
  expect(path).toContainEqual(p(10, 10));
  expect(path).toContainEqual(p(10, 20));
  expect(path).toContainEqual(p( 5, 20));
  expect(path).toContainEqual(p( 5, 10));
  expect(path).toContainEqual(p( 0, 10));

  expect(isPathCCW(path)).toBeTruthy();
});

test("Can find the polygon for a O pattern", () => {
  //
  // +--+----+--+
  // |  |    |  |
  // +--+----+--+
  // |  |    |  |
  // |  |    |  |
  // +--+----+--+
  // |  |    |  |
  // +--+----+--+
  const pgon = fromRectangles([
    r( 0,  0, 50, 10),
    r(40,  0, 10, 50),
    r( 0, 40, 50, 10),
    r( 0,  0, 10, 50)
  ]);

  expect(pgon.length).toBe(2);

  const path1 = pgon[0];
  const path2 = pgon[1];
  expect(path1.length).toBe(4);
  expect(path2.length).toBe(4);

  expect(path1).toContainEqual(p( 0,  0));
  expect(path1).toContainEqual(p(50,  0));
  expect(path1).toContainEqual(p( 0, 50));
  expect(path1).toContainEqual(p(50, 50));

  expect(path2).toContainEqual(p(10, 10));
  expect(path2).toContainEqual(p(40, 10));
  expect(path2).toContainEqual(p(10, 40));
  expect(path2).toContainEqual(p(40, 40));

  expect(isPathCCW(path1)).toBeTruthy();
  expect(isPathCCW(path2)).toBeTruthy();
});
