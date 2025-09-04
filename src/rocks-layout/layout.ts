import * as alt from "../layout-tree";
import Backing from "./backing";
import assert from "../assert";
import reassocLayoutTree from "../reassoc/reassoc-layout-tree";
import { FragmentsInfo, FragmentInfo } from "../layout-tree";
import { LayoutTree, WithMeasurements, WithOutlines } from "../reassoc/layout-tree";
import { Polygon, PolygonRendering } from "../polygon";
import { Rect, horizontallyOverlap, inflate, width, height, union } from "../rect";
import { Region, EMPTY, joinRegions, enumerateIndices, regionFromStackRef } from "./region";
import { Svg, Render, SVGStyle } from "../render";
import { Timetable, WithRegions, regionOfLayoutTree } from "./timetable";
import { add, Vector } from "../vector";
import { addVector, Point, subPoints } from "../point";
import { fromRectangles } from "../polygon/from-rectangles";
import { pathOfRect, offsetPolygon, simplifyPolygons } from "../polygon";
import { NumberSettingView, SettingView, ToggleSettingView, ViewSettings } from "../settings";

/**
 * Find the leading between regions `a` and `b`. In other words, find
 * the distance that region `b` must be translated downwards so that
 * no part of it (modulo `spaceBetween`) intersects `a`.
 *
 * @param backing The `Backing` table.
 * @param timetable The `Timetable`.
 * @param a The `Region` that `b` will be tested against (put below).
 * @param b The `Region` that will be translated.
 * @returns The amount that `Region` `b` should be translated
 * downwards to avoid intersection with `Region` `a`.
 */
function leading(backing: Backing, timetable: Timetable, a: Region, b: Region): number {
  if(a === "EmptyRegion" || b === "EmptyRegion") {
    return 0;
  }

  let maxOffset = 0;
  for(const bIdx of enumerateIndices(b)) {
    // Check if `rb` is a spacer.
    const rb = backing.getByIndex(bIdx);
    if(typeof rb === "number") {
      continue;
    }

    const maxPadding = timetable.getMaxPadding(bIdx);

    for(const { indices: aIndices, minY } of backing.iterChunks()) {
      let maxOffsetOnB: number | null = null;

      for(const aIdx of aIndices) {
        // Filter out indices which aren't in `a`.
        if(aIdx < a.range.begin || aIdx >= a.range.end) {
          continue;
        }

        const ra = backing.getByIndex(aIdx);

        // Check if `ra` is a spacer.
        if(typeof ra === "number") {
          continue;
        }

        const [aAmt, bAmt] = timetable.spaceBetween(aIdx, bIdx);
        const rai = inflate(ra, aAmt);
        const rbi = inflate(rb, bAmt);

        // Check if the two inflated rectangles overlap horizontally. If
        // they don't, then there can't be any interaction between them,
        // so move on to the next pair.
        if(!horizontallyOverlap(rai, rbi)) {
          continue;
        }

        const offset = rai.bottom - rbi.top;
        if(maxOffsetOnB === null) {
          maxOffsetOnB = offset;
        } else {
          maxOffsetOnB = Math.max(maxOffsetOnB, offset);
        }
      }

      if(maxOffsetOnB !== null) {
        maxOffset = Math.max(maxOffset, maxOffsetOnB);

        // If the maximum offset we found in this chunk is lower than
        // the minY of the chunk plus the maximum padding that can be
        // applied to this element `b`, then this element can't
        // interact with any element in a chunk above us. So we're
        // certainly done.
        if(maxOffsetOnB - maxPadding >= minY) {
          break;
        }
      }
    }
  }

  return maxOffset;

  /*
  let maxOffset = 0;
  for(const bIdx of enumerateIndices(b)) {
    const rb = backing.getByIndex(bIdx);

    for(const { indices } of backing.iterChunks()) {
      for(const aIdx of indices) {
        if(aIdx < a.range.begin || aIdx >= a.range.end) {
          continue;
        }

        const ra = backing.getByIndex(aIdx);

        // Check if one of `ax` or `bx` is a spacer. In that case, since
        // spacers occupy no vertical space, we can just check a
        // different pair.
        if(typeof ra === "number" || typeof rb === "number") {
          continue;
        }

        const [aAmt, bAmt] = timetable.spaceBetween(aIdx, bIdx);

        const rbi = inflate(rb, bAmt);
        const rai = inflate(ra, aAmt);

        // Check if the two inflated rectangles overlap horizontally. If
        // they don't, then there can't be any interaction between them,
        // so move on to the next pair.
        if(!horizontallyOverlap(rai, rbi)) {
          continue;
        }

        const offset = rai.bottom - rbi.top;
        maxOffset = Math.max(maxOffset, offset);
      }
    }
  }
  return maxOffset;
   */
}

/**
 * A layout result containing a `Backing` with the final position of
 * each rectangle in the layout, a `Timetable`, which records the
 * amount of padding around each fragment, and finally a
 * `LayoutTree<WithRegions>` which has the same structure as the input
 * tree, but is annotated with the region of each `Node`.
 */
class UnsimplifiedRocksLayoutResult extends Render implements FragmentsInfo {
  backing: Backing;
  timetable: Timetable;
  layoutTree: LayoutTree<WithRegions>;

  constructor(backing: Backing, timetable: Timetable, layoutTree: LayoutTree<WithRegions>) {
    super();
    this.backing = backing;
    this.timetable = timetable;
    this.layoutTree = layoutTree;
  }

  render(svg: Svg, _sty: SVGStyle): void {
    const go = (root: LayoutTree<WithRegions>) => {
      switch(root.type) {
        case "Atom":
        case "Spacer": break; // Nothing to do.
        case "JoinV":
        case "JoinH": {
          go(root.lhs);
          go(root.rhs);
        } break;
        case "Wrap": {
          for(const rect of this.iterRectsInRegion(root.region)) {
            svg
              .rect(width(rect), height(rect))
              .fill(root.sty?.fill ?? "none")
              .move(rect.left, rect.top);
          }

          go(root.child);
        } break;
      }
    };

    go(this.layoutTree);
  }

  /**
   * Return an iterator over the rectangles in a region.
   *
   * @param region The `Region` whose rectangles to iterate over.
   * @returns An iterator over the `region`'s `Rect`s.
   */
  *iterRectsInRegion(region: Region): IterableIterator<Rect> {
    const rects = this.backing.iterRegioni(region);

    if(region !== "EmptyRegion") {
      for(const [rect, i] of rects) {
        const ref = { index: i, depth: region.depth };
        const padding = this.timetable.getPadding(ref);
        yield inflate(rect, padding);
      }
    }
  }

  boundingBox(): Rect | null {
    const r = regionOfLayoutTree(this.layoutTree);
    const i = this.iterRectsInRegion(r);

    const first: IteratorResult<Rect, any> = i.next();
    if(first.done) {
      return null;
    }

    let bbox = first.value;

    for(const rect of i) {
      bbox = union(bbox, rect);
    }

    return bbox;
  }

  fragmentsInfo(): FragmentInfo[] {
    let out: FragmentInfo[] = [];
    let lineNo = 0;
    const go = (root: LayoutTree<WithRegions>) => {
      switch(root.type) {
        case "Atom": {
          const rect = this.backing.getByIndex(root.stackRef.index);
          assert(typeof rect !== "number", "Found Spacer where Atom is expected");
          out.push({
            rect,
            lineNo,
            text: root.text
          });
        } break;
        case "Spacer": break;
        case "JoinV": {
          go(root.lhs);
          lineNo += 1;
          go(root.rhs);
        } break;
        case "JoinH": {
          go(root.lhs);
          go(root.rhs);
        } break;
        case "Wrap": go(root.child); break;
      }
    };
    go(this.layoutTree);
    return out;
  }
}

/**
 * A `Region` with an advance vector and an origin.
 */
type RegionWithAdvance = {
  /**
   * A vector pointing from the origin to the point at which new
   * regions should be attached.
   */
  advance: Vector;
  /**
   * The point, when added with `advance`, yields the point at which
   * new regions should be attached.
   */
  origin: Point;
  /**
   * The region itself.
   */
  region: Region;
};

/**
 * Calculate the lead-out point (the origin plus the advance) of a
 * region.
 *
 * @param region The region whose lead-out point to calculate.
 * @returns The lead-out point.
 */
function leadOutPoint(region: RegionWithAdvance): Point {
  return addVector(region.origin, region.advance);
}

type L1s = RegionWithAdvance[];

/**
 * Wrap a region with attached advance in some padding.
 *
 * @param backing The `Backing` table.
 * @param region The `RegionWithAdvance` to modify.
 * @param padding The amount of padding to apply.
 * @param translate Should we translate the underlying region when
 * wrapping? (A value of `false` corresponds to algorithm G1 as
 * discussed in the paper).
 */
function wrapRegionWithAdvance(backing: Backing, region: RegionWithAdvance, padding: number, translate: boolean) {
  region.advance = add(region.advance, { dx: 2 * padding, dy: 0 });
  if(translate) {
    // Note that here we _do not_ use `translateRegionWithAdvance`,
    // since we don't want to move the region's origin. (We avoid
    // moving the origin by instead translating the region's
    // constituent rectangles).
    backing.translateRegion(region.region, { dx: padding, dy: 0 });
  } else {
    region.origin = addVector(region.origin, { dx: -padding, dy: 0 });
  }
}

/**
 * Wrap a layout in some padding.
 *
 * @param backing The `Backing` table.
 * @param layout The `Layout` to modify.
 * @param padding The amount of padding to apply.
 * @param translate Should we translate the layout when wrapping? (A
 * value of `false` corresponds to algorithm G1 as discussed in the
 * paper).
 */
function wrapLayout(backing: Backing, layout: L1s, padding: number, translate: boolean) {
  for(const line of layout) {
    wrapRegionWithAdvance(backing, line, padding, translate);
  }
}

/**
 * Join two regions (with advance), creating a new region which
 * represents `a` followed by `b`. This function does not translate
 * the input regions; it presumes that they have already been
 * translated to their final relative positions.
 *
 * @param a The first region.
 * @param b The second region.
 * @returns A new region representing the join of `a` and `b`.
 */
function joinRegionsWithAdvance(a: RegionWithAdvance, b: RegionWithAdvance): RegionWithAdvance {
  return {
    region: joinRegions(a.region, b.region),
    origin: {...a.origin},
    advance: subPoints(leadOutPoint(b), a.origin)
  }
}

/**
 * Translate a region (with advance) by the vector `v`.
 *
 * @param the `Backing` table.
 * @param region The `RegionWithAdvance` to translate.
 * @param v The amount to translate the region by.
 */
function translateRegionWithAdvance(backing: Backing, region: RegionWithAdvance, v: Vector) {
  region.origin = addVector(region.origin, v);
  backing.translateRegion(region.region, v);
}

/**
 * Extend a layout horizontally with another layout.
 *
 * @param backing The `Backing` table.
 * @param a The layout to modify (extend).
 * @param b The layout which will be added to the right hand side of `a`.
 */
function extendH(backing: Backing, a: L1s, b: L1s) {
  if(a.length === 0) return b;
  if(b.length === 0) return a;

  const lastOfA = a[a.length - 1];
  const firstOfB = b[0];

  // Find a vector, `v`, which translates `firstOfB`'s origin to the
  // lead-out point of `lastOfA`.
  const v = subPoints(leadOutPoint(lastOfA), firstOfB.origin);
  translateRegionWithAdvance(backing, firstOfB, v);
  a[a.length - 1] = joinRegionsWithAdvance(lastOfA, firstOfB);

  a.push(...b.slice(1));
}

/**
 * Extend a layout vertically with another layout.
 *
 * @param a The layout to modify (extend).
 * @param b The layout which will be added below `a`.
 */
function extendV(a: L1s, b: L1s) {
  a.push(...b);
}

export class RocksLayoutSettings implements ViewSettings {
  public translateWraps: boolean;
  public idealLeading: number;

  constructor(translateWraps: boolean, idealLeading: number) {
    this.translateWraps = translateWraps;
    this.idealLeading = idealLeading;
  }

  viewSettings(): SettingView[] {
    return [
      ToggleSettingView.new("translateWraps", this, "Translate wraps"),
      NumberSettingView.new("idealLeading", this, "Ideal leading"),
    ]
  }

  clone() {
    return new RocksLayoutSettings(this.translateWraps, this.idealLeading);
  }
}

export class RocksLayout implements alt.Layout {
  private settings: RocksLayoutSettings;

  constructor(settings: RocksLayoutSettings) {
    this.settings = settings;
  }

  layout(layoutTree: alt.LayoutTree<alt.WithMeasurements>): UnsimplifiedRocksLayoutResult {
    const backing = new Backing();
    const empty: LayoutTree<WithMeasurements> = { type: "Spacer", width: 0, text: "" };
    const rlt: LayoutTree<WithMeasurements> = reassocLayoutTree(layoutTree, empty);
    const [timetable, ltWithRegions] = Timetable.fromLayoutTree(rlt);

    const go = (root: LayoutTree<WithRegions<WithMeasurements>>): L1s => {
      switch(root.type) {
        case "Atom": {
          const maxPadding = timetable.getMaxPadding(root.stackRef.index);
          assert(root.stackRef.index === backing.pushRect(root.rect, maxPadding));
          return [{
            region: regionFromStackRef(root.stackRef),
            origin: { x: 0, y: 0 },
            advance: { dx: width(root.rect), dy: 0}
          }]
        };
        case "Spacer": {
          assert(root.stackRef.index === backing.pushSpacer(root.width));
          return [{
            region: regionFromStackRef(root.stackRef),
            origin: { x: 0, y: 0 },
            advance: { dx: root.width, dy: 0 }
          }];
        }
        case "JoinH": {
          const layout = go(root.lhs);
          extendH(backing, layout, go(root.rhs));
          return layout;
        }
        case "JoinV": {
          const layout = go(root.lhs);
          extendV(layout, go(root.rhs));
          return layout;
        }
        case "Wrap": {
          const layout = go(root.child);
          wrapLayout(backing, layout, root.padding, this.settings.translateWraps);
          return layout;
        }
      }
    }

    const layout = go(ltWithRegions);

    // Now, finalize the layout by vertically positioning each line.
    let lastLineOffset = 0;
    let done: Region = EMPTY;
    for(const line of layout) {
      const currentLineOffset = leading(backing, timetable, done, line.region);
      const effectiveLeading = currentLineOffset - lastLineOffset;
      const adjustedOffset = lastLineOffset + Math.max(effectiveLeading, this.settings.idealLeading);

      // Put the current line in its place.
      backing.translateRegion(line.region, { dx: 0, dy: adjustedOffset });
      done = joinRegions(done, line.region);

      lastLineOffset = adjustedOffset;
    }

    return new UnsimplifiedRocksLayoutResult(backing, timetable, ltWithRegions);
  }
}

/**
 * Get the outline associated with an arbitrary `LayoutTree<WithOutlines>`.
 *
 * @param layoutTree The layout tree whose outline to get.
 * @returns A `Polygon`, or `null` if the given `layoutTree` doesn't
 * have any Nodes.
 */
export function outlineOfLayoutTree(layoutTree: LayoutTree<WithOutlines>): Polygon | null {
  switch(layoutTree.type) {
    case "JoinH":
    case "JoinV": {
      return outlineOfLayoutTree(layoutTree.lhs) ?? outlineOfLayoutTree(layoutTree.rhs);
    }
    case "Spacer":
    case "Atom": return null;
    case "Wrap": return layoutTree.outline;
  }
}

class OutlinedRocksLayoutResult extends Render implements FragmentsInfo {
  private layoutTree: LayoutTree<WithRegions<WithOutlines>>;
  private unsimplifiedResult: UnsimplifiedRocksLayoutResult;

  constructor(layoutTree: LayoutTree<WithRegions<WithOutlines>>, unsimplifiedResult: UnsimplifiedRocksLayoutResult) {
    super();
    this.layoutTree = layoutTree;
    this.unsimplifiedResult = unsimplifiedResult;
  }

  render(svg: Svg, sty: SVGStyle) {
    const go = (root: LayoutTree<WithRegions<WithOutlines>>) => {
      switch(root.type) {
        case "Atom":
        case "Spacer": break;
        case "JoinV":
        case "JoinH": {
          go(root.lhs);
          go(root.rhs);
        } break;
        case "Wrap": {
          const r = new PolygonRendering(root.outline).withStyles({
            fill: "none",
            ...root.sty,
          });
          r.render(svg, sty);
          go(root.child);
        } break;
      }
    }

    go(this.layoutTree);
  }

  boundingBox(): Rect | null {
    const outermostOutline = outlineOfLayoutTree(this.layoutTree);
    if(outermostOutline === null) {
      return null;
    }

    return new PolygonRendering(outermostOutline).boundingBox();
  }

  fragmentsInfo(): FragmentInfo[] {
    return this.unsimplifiedResult.fragmentsInfo();
  }
}

export class OutlinedRocksLayoutSettings implements ViewSettings {
  public translateWraps: boolean;
  public idealLeading: number;
  public enableSimplification: boolean;

  constructor(translateWraps: boolean, idealLeading: number, enableSimplification: boolean) {
    this.translateWraps = translateWraps;
    this.idealLeading = idealLeading;
    this.enableSimplification = enableSimplification;
  }

  viewSettings(): SettingView[] {
    return [
      ToggleSettingView.new("translateWraps", this, "Translate wraps"),
      NumberSettingView.new("idealLeading", this, "Ideal leading"),
      ToggleSettingView.new("enableSimplification", this, "Enable simplification")
    ]
  }

  clone() {
    return new OutlinedRocksLayoutSettings(this.translateWraps, this.idealLeading, this.enableSimplification);
  }
}

/**
 * As opposed to `RocksLayout`, `OutlinedRocksLayout` finds the
 * rectilinear polygons which outline each rock, and optionally
 * simplifies them.
 */
export class OutlinedRocksLayout implements alt.Layout {
  private settings: OutlinedRocksLayoutSettings;

  constructor(settings: OutlinedRocksLayoutSettings) {
    this.settings = settings;
  }

  layout(layoutTree: alt.LayoutTree<alt.WithMeasurements>): OutlinedRocksLayoutResult {
    const algo = new RocksLayout(this.settings);
    const unsimplified = algo.layout(layoutTree);
    const outerBBox = unsimplified.boundingBox();
    const outerOutline: Polygon = outerBBox ? [pathOfRect(outerBBox)] : [];

    /*
    let debug = document.getElementById("debug");
    if(!debug) {
      debug = document.createElement("div");
      debug.id = "debug";
      debug.style.display = "flex";
      debug.style.flexDirection = "column";
      document.body.appendChild(debug);
    }
    debug.innerHTML = "";

    const putSVG = (render: Render) => {
      let svg = debug.appendChild(document.createElement("svg"));
      svg.innerHTML = toSVG(render);
    };

    const putText = (text: string) => {
      let p = debug.appendChild(document.createElement("p"));
      p.innerText = text;
      p.style.margin = "0";
      p.style.fontSize = "8px";
    };
    */

    const go = (root: LayoutTree<WithRegions>, outline: Polygon): LayoutTree<WithRegions<WithOutlines>> => {
      switch(root.type) {
        case "JoinH":
        case "JoinV": {
          // TODO: Seems like we could optimize here; it seems
          // possible that two nested JoinV/JoinHs could cover the
          // same region, in which case, we shouldn't redo all of this
          // work.

          const lhsRgn = regionOfLayoutTree(root.lhs);
          // TODO: Avoid copy (fromRectangles can take an iterator)
          const lhsRects = [...unsimplified.iterRectsInRegion(lhsRgn)];
          const rhsRgn = regionOfLayoutTree(root.rhs);
          // TODO: Avoid copy (fromRectangles can take an iterator)
          const rhsRects = [...unsimplified.iterRectsInRegion(rhsRgn)];

          const lhsOutline = fromRectangles(lhsRects);
          // const _ogLhsOutline = clonePolygon(lhsOutline);

          const rhsOutline = fromRectangles(rhsRects);
          // const _ogRhsOutline = clonePolygon(rhsOutline);

          if(this.settings.enableSimplification) {
            simplifyPolygons(outline, [lhsOutline, rhsOutline]);
          }

          // *** Debug ***
          /*
          putText("outline: ");
          putSVG(
            new PolygonRendering(outline).withStyles({ stroke: "blue" })
              .stack(new PolygonRendering(lhsOutline).withStyles({ fill: "rgba(200, 200, 100, 0.5)", stroke: "none" }))
              .stack(new PolygonRendering(_ogLhsOutline).withStyles({ stroke: "green", fill: "none" }))
              .stack(new PolygonRendering(rhsOutline).withStyles({ fill: "rgba(200, 100, 200, 0.5)", stroke: "none" }))
              .stack(new PolygonRendering(_ogRhsOutline).withStyles({ stroke: "purple", fill: "none" }))
          );
          */

          return {
            ...root,
            lhs: go(root.lhs, lhsOutline),
            rhs: go(root.rhs, rhsOutline)
          }
        }
        case "Atom":
        case "Spacer": return root;
        case "Wrap": {
          let childOutline = offsetPolygon(-root.padding, outline);

          return {
            ...root,
            child: go(root.child, childOutline),
            outline
          }
        }
      }
    }

    const withOutlines = go(unsimplified.layoutTree, outerOutline);
    return new OutlinedRocksLayoutResult(withOutlines, unsimplified);
  }
}
