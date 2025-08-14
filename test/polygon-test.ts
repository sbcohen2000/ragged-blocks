import { Path, isPathCCW, offsetPath, pointInPath, rectPathIntersectionArea, tryToRemoveAntiknobs, tryToRemoveClockwiseCorners } from "../src/polygon";
import { Point } from "../src/point";
import { expect, test } from "@jest/globals";
import { fromXYWH } from "../src/rect";

function p(x: number, y: number): Point {
  return { x, y };
}

test("Can find if a point is inside a square", () => {
  const square = [
    p( 0,  0),
    p(10,  0),
    p(10, 10),
    p( 0, 10),
  ];

  // Right in the middle
  expect(pointInPath(p(5, 5), square, "IncludeEdges")).toBeTruthy();

  // Top edge
  expect(pointInPath(p(5, 0), square, "IncludeEdges")).toBeTruthy();
  expect(pointInPath(p(5, 0), square, "ExcludeEdges")).toBeFalsy();

  // Upper left corner
  expect(pointInPath(p(0, 0), square, "IncludeEdges")).toBeTruthy();
  expect(pointInPath(p(0, 0), square, "ExcludeEdges")).toBeFalsy();
});

test("Can find if a point is inside a triangle pattern", () => {
  // +--+  +--+ <--- 0
  // |  +--+  |
  // +--+  +--+ <--- 10
  //    |  |
  //    +--+    <--- 20
  // ^  ^  ^  ^
  // 0  5  10 15
  const triangle = [
    p( 0,  0),
    p( 5,  0),
    p( 5,  5),
    p(10,  5),
    p(10,  0),
    p(15,  0),
    p(15, 10),
    p(10, 10),
    p(10, 20),
    p( 5, 20),
    p( 5, 10),
    p( 0, 10),
  ];

  // The point of these tests are to choose points which exercise the
  // literal edge cases in `countHorzRayPathIntersections`.

  // Top middle
  expect(pointInPath(p((5 + 10) / 2, 0), triangle, "IncludeEdges")).toBeFalsy();
  expect(pointInPath(p((5 + 10) / 2, 0), triangle, "ExcludeEdges")).toBeFalsy();

  // Middle
  expect(pointInPath(p((5 + 10) / 2, 10), triangle, "IncludeEdges")).toBeTruthy();
  expect(pointInPath(p((5 + 10) / 2, 10), triangle, "ExcludeEdges")).toBeTruthy();
});

test("Can remove eastward facing antiknob", () => {
  //
  // +-----+    <--- 0
  // |  +--+    <--- 5
  // |  |
  // |  +-----+ <--- 15
  // +--------+ <--- 20
  // ^  ^  ^  ^
  // 0  5  10 15
  //
  //       |
  //       V
  //
  // +-----+    <--- 0
  // |     |
  // |     |
  // |     +--+ <--- 15
  // +--------+ <--- 20
  // ^     ^  ^
  // 0    10  15

  const path = [
    p( 0,  0),
    p( 0, 20),
    p(15, 20),
    p(15, 15),
    p( 5, 15),
    p( 5,  5),
    p(10,  5),
    p(10,  0),
  ];

  const expectation = [
    p( 0,  0),
    p( 0, 20),
    p(15, 20),
    p(15, 15),
    p(10, 15),
    p(10,  0)
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const removedOne = tryToRemoveAntiknobs(path);

  expect(removedOne).toBeTruthy();
  expect(isPathCCW(path)).toBeTruthy();
  expect(path).toStrictEqual(expectation);
});

test("Can remove southward facing antiknob", () => {
  //
  // +--------+ <--- 0
  // |  +--+  | <--- 5
  // +--+  |  | <--- 10
  //       +--+ <--- 15
  // ^  ^  ^  ^
  // 0  5  10 15
  //
  //       |
  //       V
  //
  // +--------+ <--- 0
  // |        |
  // +-----+  | <--- 10
  //       +--+ <--- 15
  // ^  ^  ^  ^
  // 0  5  10 15

  const path = [
    p( 0,  0),
    p( 0, 10),
    p( 5, 10),
    p( 5,  5),
    p(10,  5),
    p(10, 15),
    p(15, 15),
    p(15,  0)
  ];

  const expectation = [
    p( 0,  0),
    p( 0, 10),
    p(10, 10),
    p(10, 15),
    p(15, 15),
    p(15,  0)
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const removedOne = tryToRemoveAntiknobs(path);

  expect(removedOne).toBeTruthy();
  expect(isPathCCW(path)).toBeTruthy();
  expect(path).toStrictEqual(expectation);
});

test("Can remove west facing antiknob", () => {
  //
  // +--------+ <--- 0
  // |        |
  // +--+     | <--- 5
  //    |     |
  // +--+     | <--- 10
  // |        |
  // +--------+ <--- 15
  // ^  ^     ^
  // 0  5    15
  //
  //       |
  //       V
  //
  // +--------+ <--- 0
  // |        |
  // |        |
  // |        |
  // |        |
  // |        |
  // +--------+ <--- 15
  // ^        ^
  // 0       15

  const path = [
    p( 0,  0),
    p( 0,  5),
    p( 5,  5),
    p( 5, 10),
    p( 0, 10),
    p( 0, 15),
    p(15, 15),
    p(15,  0),
  ];

  const expectation = [
    p( 0,  0),
    p( 0, 15),
    p(15, 15),
    p(15,  0)
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const removedOne = tryToRemoveAntiknobs(path);

  expect(removedOne).toBeTruthy();
  expect(isPathCCW(path)).toBeTruthy();
  expect(path).toStrictEqual(expectation);
});

test("Can remove eastward facing antiknob, independent of index rotation", () => {
  //
  // +-----+    <--- 0
  // |  +--+    <--- 5
  // |  |
  // |  +-----+ <--- 15
  // +--------+ <--- 20
  // ^  ^  ^  ^
  // 0  5  10 15
  //
  //       |
  //       V
  //
  // +-----+    <--- 0
  // |     |
  // |     |
  // |     +--+ <--- 15
  // +--------+ <--- 20
  // ^     ^  ^
  // 0    10  15

  const rotated = (n: number): Path => {
    const path: Path = [
      p( 0,  0),
      p( 0, 20),
      p(15, 20),
      p(15, 15),
      p( 5, 15),
      p( 5,  5),
      p(10,  5),
      p(10,  0),
    ];

    for(let i = 0; i < n; ++i) {
      const last = path.pop()!;
      path.unshift(last);
    }

    return path;
  };

  for(let i = 0; i < 8; ++i) {
    const path = rotated(i);

    expect(isPathCCW(path)).toBeTruthy();

    const removedOne = tryToRemoveAntiknobs(path);

    expect(removedOne).toBeTruthy();
    expect(isPathCCW(path)).toBeTruthy();

    expect(path).toContainEqual(p( 0,  0));
    expect(path).toContainEqual(p( 0, 20));
    expect(path).toContainEqual(p(15, 20));
    expect(path).toContainEqual(p(15, 15));
    expect(path).toContainEqual(p(10, 15));
    expect(path).toContainEqual(p(10,  0));
  }
});

test("Can remove a corner", () => {
  //
  // +---+     <--- 0
  // |   |
  // |   +---+ <--- 5
  // |       |
  // +-------+ <--- 10
  // ^   ^   ^
  // 0   5   10
  //
  //     |
  //     V
  //
  // +-------+ <--- 0
  // |       |
  // |       |
  // |       |
  // +-------+ <--- 10
  // ^       ^
  // 0       10

  const path = [
    p( 0,  0),
    p( 0, 10),
    p(10, 10),
    p(10,  5),
    p( 5,  5),
    p( 5,  0)
  ];

  const expectation = [
    p( 0,  0),
    p( 0, 10),
    p(10, 10),
    p(10,  0)
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const removedOne = tryToRemoveClockwiseCorners(path);

  expect(removedOne).toBeTruthy();
  expect(isPathCCW(path)).toBeTruthy();
  expect(path).toStrictEqual(expectation);
});

test("Can remove a different corner", () => {
  //
  //     +---+ <--- 0
  //     |   |
  // +---+   | <--- 5
  // |       |
  // +-------+ <--- 10
  // ^   ^   ^
  // 0   5   10
  //
  //     |
  //     V
  //
  // +-------+ <--- 0
  // |       |
  // |       |
  // |       |
  // +-------+ <--- 10
  // ^       ^
  // 0       10

  const path = [
    p( 5,  0),
    p( 5,  5),
    p( 0,  5),
    p( 0, 10),
    p(10, 10),
    p(10,  0)
  ];

  const expectation = [
    p( 0,  0),
    p( 0, 10),
    p(10, 10),
    p(10,  0)
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const removedOne = tryToRemoveClockwiseCorners(path);

  expect(removedOne).toBeTruthy();
  expect(isPathCCW(path)).toBeTruthy();
  expect(path).toStrictEqual(expectation);
});


test("Can remove two corners", () => {
  //
  // +---+     <--- 0
  // |   |
  // +---+---+ <--- 5
  //     |   |
  //     +---+ <--- 10
  // ^   ^   ^
  // 0   5   10
  //
  //     |
  //     V
  //
  // +-------+ <--- 0
  // |       |
  // |       |
  // |       |
  // +-------+ <--- 10
  // ^       ^
  // 0       10

  const path = [
    p( 0,  0),
    p( 0,  5),
    p( 5,  5),
    p( 5, 10),
    p(10, 10),
    p(10,  5),
    p( 5,  5),
    p( 5,  0),
  ];

  const expectation = [
    p( 0,  0),
    p( 0, 10),
    p(10, 10),
    p(10,  0)
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const removedOne = tryToRemoveClockwiseCorners(path);

  expect(removedOne).toBeTruthy();
  expect(isPathCCW(path)).toBeTruthy();
  expect(path).toStrictEqual(expectation);
});

test("Can offset a square", () => {
  const path = [
    p( 0,  0),
    p( 0, 10),
    p(10, 10),
    p(10,  0),
  ];

  const expectation = [
    p(4, 6),
    p(6, 6),
    p(6, 4),
    p(4, 4),
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const offset = offsetPath(-4, path);

  expect(isPathCCW(offset)).toBeTruthy();
  expect(offset).toStrictEqual(expectation);
});

test("Can offset a polygon with a clockwise turn", () => {
  //
  //     +---+ <--- 0
  //     |   |
  // +---+   | <--- 5
  // |       |
  // +-------+ <--- 10
  // ^   ^   ^
  // 0   5   10

  const path = [
    p( 5,  0),
    p( 5,  5),
    p( 0,  5),
    p( 0, 10),
    p(10, 10),
    p(10,  0)
  ];

  const expectation = [
    p(7, 7),
    p(2, 7),
    p(2, 8),
    p(8, 8),
    p(8, 2),
    p(7, 2),
  ];

  expect(isPathCCW(path)).toBeTruthy();

  const offset = offsetPath(-2, path);

  expect(isPathCCW(offset)).toBeTruthy();
  expect(offset).toStrictEqual(expectation);
});

test("Can find the intersection area of a path with a rectangle which completely overlaps it.", () => {
  //
  // +-----+ <- 0
  // |     |
  // |     |
  // +-----+ <- 10
  // ^     ^
  // 0     10
  const path = [
    p( 0,  0),
    p( 0, 10),
    p(10, 10),
    p(10,  0)
  ];

  expect(rectPathIntersectionArea(fromXYWH(0, 0, 10, 10), path)).toBeCloseTo(100);
});

test("Can find the intersection area of a path with a rectangle inside of it", () => {
  //
  // +-----+ <- 0
  // | +-+ | <- 3
  // | +-+ | <- 6
  // +-----+ <- 9
  // ^ ^ ^ ^
  // 0 3 6 9
  const path = [
    p(0, 0),
    p(0, 9),
    p(9, 9),
    p(9, 0)
  ];

  expect(rectPathIntersectionArea(fromXYWH(3, 3, 3, 3), path)).toBeCloseTo(3 * 3);
});


test("Can find the intersection area of a path with a rectangle partially overlapping it", () => {
  //
  // +--------+ <--- 0
  // |        |
  // +--+     | <--- 5
  //  +-|-+   | <--- 7.5
  // +|-+ |   | <--- 10
  // |+---+   | <--- 12.5
  // +--------+ <--- 15
  // ^^ ^ ^   ^
  // 02 5 7  15

  const path = [
    p( 0,  0),
    p( 0,  5),
    p( 5,  5),
    p( 5, 10),
    p( 0, 10),
    p( 0, 15),
    p(15, 15),
    p(15,  0),
  ];

  expect(rectPathIntersectionArea(fromXYWH(2, 7.5, 5, 5), path)).toBeCloseTo(5 * 5 - 3 * 2.5);
});
