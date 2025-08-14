import { Point } from "../../src/point";
import { Rect, width, height, fromXYWH, pointInRect } from "../../src/rect";
import { Render, toSVG } from "../../src/render";
import { Svg } from "@svgdotjs/svg.js";
import { createSVGWindow } from "svgdom";
import { exit } from "node:process";
import { fromRectangles } from "../../src/polygon/from-rectangles";
import { parseArgs } from "node:util";
import { pointInPolygon, Polygon, PolygonRendering } from "../../src/polygon";
import { writeFileSync, readFileSync } from "node:fs";

/**
 * The size of the largest group (i.e. the largest number of
 * rectangles that will be tested at once).
 */
const MAX_GROUP_SIZE = 20;

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function() {
    a |= 0; b |= 0; c |= 0; d |= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

const seed = 0;
const rand = sfc32(0x9E3779B9, 0x243F6A88, 0xB7E15162, seed);

/**
 * Rand, but produces numbers with not so many decimals.
 */
function niceRand(): number {
  const r = rand();
  return Math.floor(r * 100) / 100;
}

/**
 * Create a new point with random coordinates inside `inside`.
 */
function randomPoint(inside: Rect): Point {
  return {
    x: inside.left + niceRand() * width(inside),
    y: inside.top + niceRand() * height(inside)
  }
}

/**
 * Create a new rectangle with random dimensions inside `inside`.
 */
function randomRect(inside: Rect): Rect {
  const w = niceRand() * width(inside);
  const h = niceRand() * height(inside);
  const x = niceRand() * (width(inside) - w);
  const y = niceRand() * (height(inside) - h);
  return fromXYWH(x + inside.left, y + inside.top, w, h);
};

/**
 * Generate `n` random rectangles inside the rectangle `inside`.
 */
function randomRects(inside: Rect, n: number): Rect[] {
  let out: Rect[] = [];
  for(let i = 0; i < n; ++i) {
    out.push(randomRect(inside));
  }
  return out;
}

/**
 * Check if a point is inside any of `rs`.
 */
function pointInRects(p: Point, rs: Rect[]): boolean {
  return rs.some(r => pointInRect(p, r));
}

class Counterexample extends Render {
  private rs: Rect[];
  private pgon: Polygon;
  private p: Point;

  constructor(rs: Rect[], pgon: Polygon, p: Point) {
    super();
    this.rs = rs;
    this.pgon = pgon;
    this.p = p;
  }

  render(svg: Svg) {
    for(const r of this.rs) {
      svg.rect(width(r), height(r))
        .move(r.left, r.top)
        .stroke("black")
        .fill("rgba(255, 255, 255, 0.5)");
    }
    new PolygonRendering(this.pgon).render(svg, {
      stroke: "red",
      fill: "none",
      debugFragmentBoundingBoxes: false
    });

    svg.circle(5).move(this.p.x - 5/2, this.p.y - 5/2).fill("magenta");
  }

  boundingBox(): Rect | null {
    return fromXYWH(0, 0, 100, 100);
  }

  write(path: string) {
    writeFileSync(path, JSON.stringify({
      rects: this.rs,
      samplePoint: this.p
    }));
  }
}

function allSubsets<A>(as: A[]): A[][] {
  if(as.length === 0) {
    return [[]];
  }

  const subsets = allSubsets(as.slice(1));
  const out: A[][] = [...subsets];
  for(const subset of subsets) {
    out.push([as[0]].concat(subset));
  }
  return out;
}

function reduceExample(rs: Rect[], samplePoint: Point): [Rect[], Polygon] {
  for(const subset of allSubsets(rs)) {
    if(subset.length === 0) {
      continue;
    }

    const pgon = fromRectangles(subset);
    let ref: boolean;
    let test: boolean;
    try {
      ref = pointInRects(samplePoint, subset);
      test = pointInPolygon(samplePoint, pgon);
    } catch(e) {
      console.log(`Stopping because an error was encountered: ${e}`);
      ref = false;
      test = true;
    }

    if(ref !== test) {
      console.log(`Found a counterexample (rs ${ref ? "inside" : "outside"} while pgon ${test ? "inside" : "outside"})`);
      return [subset, pgon];
    }
  }

  throw new Error("Unreachable");
}

function runTest() {
  const bounds = fromXYWH(0, 0, 100, 100);

  for(let n = 1; n < MAX_GROUP_SIZE + 1; ++n) {
    console.log(`Testing groups of size ${n}...`);

    for(let i = 0; i < 1000; ++i) {
      const rs = randomRects(bounds, n);
      const pgon = fromRectangles(rs);

      // Sample a bunch of points to see if we disagree on any.
      for(let j = 0; j < 1000; ++j) {
        const samplePoint = randomPoint(bounds);

        let ref: boolean;
        let test: boolean;
        try {
          ref = pointInRects(samplePoint, rs);
          test = pointInPolygon(samplePoint, pgon);
        } catch(e) {
          console.log(`Stopping because an error was encountered: ${e}`);
          ref = false;
          test = true;
        }

        if(ref !== test) {
          const [rsReduced, pgonReduced] = reduceExample(rs, samplePoint);
          if(rsReduced.length !== rs.length) {
            console.log(`Reduced example from ${rs.length} rectangles to ${rsReduced.length} rectangles.`);
          }

          const c = new Counterexample(rsReduced, pgonReduced, samplePoint);
          c.write("counterexample.json");
          const window = createSVGWindow();
          const svg = toSVG(c, 0, window);
          writeFileSync("counterexample.svg", svg);
          exit(1);
        }
      }
    }
  }

  console.log(`Didn't find any counterexamples.`);
}

function runExample(path: string) {
  const json = JSON.parse(readFileSync(path, { encoding: "utf-8" }));

  const rs: Rect[] = json["rects"];
  const samplePoint: Point = json["samplePoint"];

  const pgon = fromRectangles(rs);
  const ref = pointInRects(samplePoint, rs);
  const test = pointInPolygon(samplePoint, pgon);

  if(ref !== test) {
    console.log(`Example failed (rs ${ref ? "inside" : "outside"} while pgon ${test ? "inside" : "outside"})`);
  } else {
    console.log("Example passed.");
  }
}

function main() {
  const args = parseArgs({
    options: {
      input: {
        type: "string",
        short: "i",
      }
    }
  });

  const inputPath = args.values.input;
  if(inputPath === undefined) {
    runTest();
  } else {
    runExample(inputPath);
  }
}

main();
