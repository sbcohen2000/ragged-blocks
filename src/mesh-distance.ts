import assert from "./assert";
import { FragmentsInfo, fragmentPosition } from "./layout-tree";
import { Point } from "./point";
import { Svg, Render, SVGStyle } from "./render";
import { centerPoint, expandToInclude, Rect } from "./rect";

type HorzSegment = [Point, Point];
type VertSegment = [Point, Point];

/**
 * Find the length of a vertical segment (only counting distance along
 * the y-axis).
 *
 * @param seg The vertical segment.
 * @returns The vertical length of the segment.
 */
function vertSegmentLength(seg: VertSegment): number {
  const [b, e] = seg;
  return Math.abs(b.y - e.y);
}

/**
 * Find the length of a vertical segment (only counting distance along
 * the y-axis).
 *
 * @param seg The vertical segment.
 * @returns The vertical length of the segment.
 */
function horzSegmentLength(seg: HorzSegment): number {
  const [b, e] = seg;
  return Math.abs(b.x - e.x);
}

/**
 * Find the mean of a list of numbers.
 *
 * @param xs The input numbers.
 * @returns The mean of `xs`.
 */
function mean(xs: number[]): number {
  let sum = 0;
  for(const x of xs) {
    sum += x;
  }
  return sum / xs.length;
}

/**
 * Draw an "X" at `point`.
 *
 * @param svg The svg render target.
 * @param sty The style to apply to the "X".
 * @param point The point at which to center the "X".
 * @param size The width/height of the "X".
 */
function renderX(svg: Svg, sty: SVGStyle, point: Point, size: number) {
  const halfSize = size / 2;
  svg
    .line(
      point.x - halfSize, point.y - halfSize,
      point.x + halfSize, point.y + halfSize
    ).stroke(sty.stroke);
  svg
    .line(
      point.x + halfSize, point.y - halfSize,
      point.x - halfSize, point.y + halfSize
    ).stroke(sty.stroke);
}

export class MeshDistanceMesh extends Render {
  private horzSegments: HorzSegment[][];
  private vertSegments: VertSegment[];

  private constructor(horzSegments: HorzSegment[][], vertSegments: VertSegment[]) {
    super();
    this.horzSegments = horzSegments;
    this.vertSegments = vertSegments;
  }

  /**
   * Given a type which implements `MeshDistance`, produce a new
   * `MeshDistanceMesh`.
   *
   * @param a The layout result from which to construct a mesh.
   * @returns A new `MeshDistanceMesh`.
   */
  static fromFragments<A extends FragmentsInfo>(a: A): MeshDistanceMesh {
    let curLineNo = -1;
    let lastLineY: number | null = null;
    let lastFragPositionOnLine: Point | null = null;

    let horzSegments: HorzSegment[][] = [];
    let vertSegments: VertSegment[] = [];

    for(const fragment of a.fragmentsInfo()) {
      const p = fragmentPosition(fragment);

      if(fragment.lineNo !== curLineNo) {
        curLineNo = fragment.lineNo;
        // This is the first fragment on a new line.
        horzSegments.push([])

        if(lastLineY !== null) {
          vertSegments.push([{ x: 0, y: lastLineY }, { x: 0, y: p.y }]);
        }
        lastLineY = p.y;
        lastFragPositionOnLine = { x: 0, y: p.y };
      }

      if(lastFragPositionOnLine !== null) {
        horzSegments[horzSegments.length - 1].push([lastFragPositionOnLine, p]);
      }

      lastFragPositionOnLine = p;
    }
    return new MeshDistanceMesh(horzSegments, vertSegments);
  }

  render(svg: Svg, sty: SVGStyle) {
    for(const line of this.horzSegments) {
      for(const [b, e] of line) {
        svg
          .line(b.x, b.y, e.x, e.y)
          .stroke(sty.stroke);

        renderX(svg, sty, e, 4);
      }
    }

    let fst: boolean = true;
    for(const [b, e] of this.vertSegments) {
      svg
        .line(b.x, b.y, e.x, e.y)
        .stroke(sty.stroke);

      if(fst) {
        renderX(svg, sty, b, 4);
        fst = false;
      }

      renderX(svg, sty, e, 4);
    }
  }

  boundingBox(): Rect | null {
    let s0 = this.horzSegments[0]?.at(0) ?? this.vertSegments[0];
    let p0 = s0?.at(0);

    if(p0 === undefined) {
      return null;
    }

    let r: Rect = { left: p0.x, right: p0.x, top: p0.y, bottom: p0.y };

    for(const line of this.horzSegments) {
      for(const [b, e] of line) {
        r = expandToInclude(r, b);
        r = expandToInclude(r, e);
      }
    }

    for(const [b, e] of this.vertSegments) {
      r = expandToInclude(r, b);
      r = expandToInclude(r, e);
    }

    return r;
  }

  /**
   * Count the number of fragments (which is equal to the number of
   * horizontal segments, minus the number of vertical segments, to
   * account for the horizontal segments that connect the left margin
   * to the first fragment on a line).
   *
   * @returns The number of fragments.
   */
  countFragments(): number {
    let sum = 0;
    for(const line of this.horzSegments) {
      sum += line.length;
    }
    sum -= this.vertSegments.length;
    return sum;
  }

  /**
   * Calculate the mean line width of every line in the layout.
   *
   * @returns The average line length.
   */
  meanLineWidth(): number {
    let sum = 0;
    for(const line of this.horzSegments) {
      let length = 0;
      for(const [b, e] of line) {
        length = Math.max(b.x, Math.max(e.x, length));
      }
      sum += length;
    }
    return sum / this.horzSegments.length;
  }

  /**
   * For each horizontal segment in `this` and `other`, find the
   * difference in length. Return the list of these differences. This
   * function throws an error if `this` and `other` have a different
   * number of horizontal mesh distance segments.
   *
   * @param other The other `MeshDistanceMesh` to compare to.
   * @returns An array of differences, one for each horizontal segment
   * in `this` and `other`.
   */
  horizontalMeshDistances(other: MeshDistanceMesh): number[] {
    let out: number[] = [];

    assert(this.horzSegments.length === other.horzSegments.length);

    for(let lineNo = 0; lineNo < this.horzSegments.length; ++lineNo) {
      const thisLine = this.horzSegments[lineNo];
      const otherLine = other.horzSegments[lineNo];

      assert(thisLine.length === otherLine.length);

      for(let i = 0; i < thisLine.length; ++i) {
        const thisD = horzSegmentLength(thisLine[i]);
        const otherD = horzSegmentLength(otherLine[i]);

        out.push(Math.abs(thisD - otherD));
      }
    }

    return out;
  }

  /**
   * For each vertical segment in `this` and `other`, find the
   * difference in length. Return the list of these differences. This
   * function throws an error if `this` and `other` have a different
   * number of vertical mesh distance segments.
   *
   * @param other The other `MeshDistanceMesh` to compare to.
   * @returns An array of differences, one for each vertical segment
   * in `this` and `other`.
   */
  verticalMeshDistances(other: MeshDistanceMesh): number[] {
    let out: number[] = [];

    assert(this.vertSegments.length === other.vertSegments.length);

    for(let i = 0; i < this.vertSegments.length; ++i) {
      const thisD = vertSegmentLength(this.vertSegments[i]);
      const otherD = vertSegmentLength(other.vertSegments[i]);

      out.push(Math.abs(thisD - otherD));
    }

    return out;
  }

  /**
   * Find the average horizontal mesh distance between `this` mesh and
   * an `other` mesh.
   *
   * @param other The other `MeshDistanceMesh` to compare to.
   * @returns The average horizontal mesh distance between `this` and
   * `other`.
   */
  meanHorizontalMeshDistance(other: MeshDistanceMesh): number {
    let ds = this.horizontalMeshDistances(other);
    // ds = ds.filter(x => x !== 0);
    return mean(ds);
  }

  /**
   * Find the average vertical mesh distance between `this` mesh and
   * an `other` mesh.
   *
   * @param other The other `MeshDistanceMesh` to compare to.
   * @returns The average vertical mesh distance between `this` and
   * `other`.
   */
  meanVerticalMeshDistance(other: MeshDistanceMesh): number {
    let ds = this.verticalMeshDistances(other);
    // ds = ds.filter(x => x !== 0);
    return mean(ds);
  }
}
