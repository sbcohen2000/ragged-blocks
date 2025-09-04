import * as alt from "../layout-tree";
import * as rlt from "../reassoc/layout-tree";
import reassocLayoutTree from "../reassoc/reassoc-layout-tree";
import { FragmentsInfo, FragmentInfo } from "../layout-tree";
import { Svg, Render, SVGStyle } from "../render";
import { ViewSettings, SettingView, NumberSettingView, ToggleSettingView } from "../settings";
import { add, Vector } from "../vector";
import { addVector, subPoints, Point } from "../point";
import { horizontallyOverlap, inflate, Rect, translate, width, height, union } from "../rect";

type Cell = {
  uid: number;
  padding: number;
};

type Stack = {
  type: "Stack";
  rect: Rect;
  cells: Cell[];
  text: string;
} | {
  type: "Spacer",
  width: number;
};

/**
 * Translate a `Stack` by the vector `v`.
 *
 * @param stack The `Stack` to modify.
 * @param v The vector by which to translate `stack`.
 */
function translateStack(stack: Stack, v: Vector) {
  if(stack.type === "Stack") {
    stack.rect = translate(stack.rect, v);
  }
}

/**
 * Wrap a stack in some padding.
 *
 * @param stack The `Stack` to modify.
 * @param uid The `uid` of the corresponding layout tree node.
 * @param padding The amount of padding to apply.
 */
function wrapStack(stack: Stack, uid: number, padding: number) {
  if(stack.type === "Spacer") {
    return;
  }

  if(stack.cells.length === 0) {
    stack.cells.push({ uid, padding });
  } else {
    const top = stack.cells[stack.cells.length - 1];
    if(top.uid === uid) {
      // Re-use the topmost `Cell` if we can.
      top.padding += padding;
    } else {
      // Otherwise, add a new cell to the end.
      stack.cells.push({ uid, padding: top.padding + padding });
    }
  }
}

/**
 * Find the space between two stacks.
 *
 * @param as The cells of stack `a`.
 * @param bs The cells of stack `b`.
 * @returns A tuple of padding amounts; the padding amount around
 * stack `a`, and the padding amount around stack `b`, respectively.
 */
function spaceBetween(as: Cell[], bs: Cell[]): [number, number] {
  let aDepth = as.length;
  let bDepth = bs.length;

  for(;;) {
    if(aDepth === 0 && bDepth === 0) {
      return [0, 0];
    } else if(aDepth === 0) {
      return [0, bs[bDepth - 1]!.padding];
    } else if(bDepth === 0) {
      return [as[aDepth - 1]!.padding, 0];
    }

    const a = as[aDepth - 1]!;
    const b = bs[bDepth - 1]!;
    if(a.uid !== b.uid) {
      return [a.padding, b.padding];
    }

    --aDepth;
    --bDepth;
  }
}

/**
 * Find the "leading" between two rectangles, `a`, and `b`.
 *
 * @param a The first rectangle.
 * @param b The second rectangle.
 * @returns The amount that `b` must be translated down so that it
 * falls below `a`.
 */
function leadingRect(a: Rect, b: Rect): number {
  if(horizontallyOverlap(a, b)) {
    return a.bottom - b.top;
  }
  return 0;
}

/**
 * Find the "leading" between two `Stack`s, `a`, and `b`.
 *
 * @param a The first stack.
 * @param b The second stack.
 * @returns The amount that `b` must be translated down so that it
 * falls below `a`.
 */
function leadingStack(a: Stack, b: Stack): number {
  if(a.type !== "Stack" || b.type !== "Stack") {
    return 0;
  }

  const [spa, spb] = spaceBetween(a.cells, b.cells);
  const ra = inflate(a.rect, spa);
  const rb = inflate(b.rect, spb);

  return leadingRect(ra, rb);
}

type Region = Stack[];

/**
 * Translate a `Region` by the vector `v`.
 *
 * @param region The `Region` to modify.
 * @param v The vector by which to translate `stack`.
 */
function translateRegion(region: Region, v: Vector) {
  for(const stack of region) {
    translateStack(stack, v);
  }
}

/**
 * Wrap a region in some padding.
 *
 * @param region The `Region` to modify.
 * @param uid The `uid` of the corresponding layout tree node.
 * @param padding The amount of padding to apply.
 */
function wrapRegion(region: Region, uid: number, padding: number) {
  for(const stack of region) {
    wrapStack(stack, uid, padding);
  }
}

/**
 * Find the leading between two `Region`s, `a`, and `b`.
 *
 * @param a The first region.
 * @param b The second region.
 * @returns The amount that `b` must be translated down so that it
 * falls below `a`.
 */
function leadingRegion(a: Region, b: Region): number {
  let maxOffset = 0;
  for(const sa of a) {
    for(const sb of b) {
      maxOffset = Math.max(maxOffset, leadingStack(sa, sb));
    }
  }
  return maxOffset;
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

/**
 * Translate a `RegionWithAdvance` by the vector `v`.
 *
 * @param region The `RegionWithAdvance` to modify.
 * @param v The vector by which to translate `stack`.
 */
function translateRegionWithAdvance(region: RegionWithAdvance, v: Vector) {
  region.origin = addVector(region.origin, v);
  translateRegion(region.region, v);
}

/**
 * Wrap a region with attached advance in some padding.
 *
 * @param region The `RegionWithAdvance` to modify.
 * @param uid The `uid` of the corresponding layout tree node.
 * @param padding The amount of padding to apply.
 * @param translate Should we translate the underlying region when
 * wrapping? (A value of `false` corresponds to algorithm G1 as
 * discussed in the paper).
 */
function wrapRegionWithAdvance(region: RegionWithAdvance, uid: number, padding: number, translate: boolean) {
  region.advance = add(region.advance, { dx: 2 * padding, dy: 0 });
  wrapRegion(region.region, uid, padding);
  if(translate) {
    // Note that here we _do not_ use `translateRegionWithAdvance`,
    // since we don't want to move the region's origin. (We avoid
    // moving the origin by instead translating the region's
    // constituent rectangles).
    translateRegion(region.region, { dx: padding, dy: 0 });
  } else {
    region.origin = addVector(region.origin, { dx: -padding, dy: 0 });
  }
}

/**
 * Extend a region (with advance) with another region (with advance).
 *
 * @param a The region to modify (extend).
 * @param b The region which will be added to `a`.
 */
function extendRegionWithAdvance(a: RegionWithAdvance, b: RegionWithAdvance) {
  a.advance = subPoints(leadOutPoint(b), a.origin)
  a.region.push(...b.region);
}

type L1p = RegionWithAdvance[];

/**
 * Wrap a layout in some padding.
 *
 * @param layout The `Layout` to modify.
 * @param uid The `uid` of the corresponding layout tree node.
 * @param padding The amount of padding to apply.
 * @param translate Should we translate the layout when wrapping? (A
 * value of `false` corresponds to algorithm G1 as discussed in the
 * paper).
 */
function wrapLayout(layout: L1p, uid: number, padding: number, translate: boolean) {
  for(const line of layout) {
    wrapRegionWithAdvance(line, uid, padding, translate);
  }
}

/**
 * Extend a layout horizontally with another layout.
 *
 * @param a The layout to modify (extend).
 * @param b The layout which will be added to the right hand side of `a`.
 */
function extendH(a: L1p, b: L1p) {
  if(a.length === 0) return b;
  if(b.length === 0) return a;

  const lastOfA = a[a.length - 1];
  const firstOfB = b[0];

  // Find a vector, `v`, which translates `firstOfB`'s origin to the
  // lead-out point of `lastOfA`.
  const v = subPoints(leadOutPoint(lastOfA), firstOfB.origin);
  translateRegionWithAdvance(firstOfB, v);
  extendRegionWithAdvance(lastOfA, firstOfB);

  a.push(...b.slice(1));
}

/**
 * Extend a layout vertically with another layout.
 *
 * @param a The layout to modify (extend).
 * @param b The layout which will be added below `a`.
 */
function extendV(a: L1p, b: L1p) {
  a.push(...b);
}

/**
 * Produce a new layout from a rectangle.
 *
 * @param r The rectangle from which to produce a new layout.
 * @param text The text underlying this rectangle.
 * @returns A new layout consisting only of the rectangle `r`.
 */
function layoutFromRect(r: Rect, text: string): L1p {
  return [
    {
      region: [{ type: "Stack", cells: [], rect: r, text }],
      origin: { x: 0, y: 0 },
      advance: { dx: width(r), dy: 0 }
    }
  ];
}

/**
 * Produce a new layout from a spacer.
 *
 * @param w The width of the spacer.
 * @returns A new layout consisting only of a spacer with width `w`.
 */
function layoutFromSpacer(w: number): L1p {
  return [
    {
      region: [{ type: "Spacer", width: w }],
      origin: { x: 0, y: 0 },
      advance: { dx: w, dy: 0 }
    }
  ];
}

/**
 * Concatenate lists, but by taking the first element from every
 * list, then the second element from every list, and so on until the
 * lists are depleted.
 *
 * @param as Lists of lists of as.
 * @returns A "flattened" list of as.
 */
function concatEvenly<A>(as: A[][]): A[] {
  const progress: number[] = as.map(_ => 0);
  const out: A[] = [];

  for(;;) {
    let anyProgress = false;
    for(let i = 0; i < as.length; ++i) {
      if(progress[i] < as[i].length) {
        out.push(as[i][progress[i]]);
        ++progress[i];
        anyProgress = true;
      }
    }

    if(!anyProgress) {
      return out;
    }
  }
}

class PebbleLayoutResult extends Render implements FragmentsInfo {
  private layout: L1p;
  private uidToColor: Map<number, string>;

  constructor(layout: L1p, uidToColor: Map<number, string>) {
    super();
    this.layout = layout;
    this.uidToColor = uidToColor;
  }

  /**
   * Return a list of rectangles along with their fill colors, one
   * pair for every cell in a `Stack`. The largest, outermost
   * rectangle is returned first and the smallest, most nested
   * rectangle is returned last.
   *
   * @param s The `Stack` whose rectangles to return.
   * @param includeBase An optional flag, indicating if we should
   * include the base fragment rectangle in the output (by default,
   * the base fragment is not included).
   * @returns A list of `Rect` `string` pairs, the `string`s
   * representing the color of each `Rect`.
   */
  private rectsOfStack(s: Stack, includeBase?: boolean): [Rect, string][] {
    if(s.type === "Spacer") {
      return [];
    }

    let out: [Rect, string][] = [];
    for(let i = s.cells.length - 1; i >= 0; --i) {
      const r = inflate(s.rect, s.cells[i].padding);
      const color = this.uidToColor.get(s.cells[i].uid) ?? "none";
      out.push([r, color]);
    }

    if(includeBase) {
      // Add a rectangle to represent the underlying fragment.
      out.push([ s.rect, "white" ]);
    }

    return out;
  }

  private *allStacks(): IterableIterator<Stack> {
    for(const line of this.layout) {
      for(const stack of line.region) {
        yield stack;
      }
    }
  }

  render(svg: Svg, sty: SVGStyle) {
    const that = this;
    const allRects = [...this.allStacks()].map(stk => that.rectsOfStack(stk));
    for(const [rect, fill] of concatEvenly(allRects)) {
      svg
        .rect(width(rect), height(rect))
        .move(rect.left, rect.top)
        .fill(fill)
        .stroke(fill === "white" ? "black" : "none"); // HACK!
    }
  }

  boundingBox(): Rect | null {
    let bbox: Rect | null = null;
    for(const stack of this.allStacks()) {
      if(stack.type === "Spacer") {
        continue;
      }

      const padding = stack.cells[stack.cells.length - 1]?.padding ?? 0;
      const rect = inflate(stack.rect, padding);

      if(bbox === null) {
        bbox = rect;
      } else {
        bbox = union(bbox, rect);
      }
    }

    return bbox;
  }

  fragmentsInfo(): FragmentInfo[] {
    let out: FragmentInfo[] = [];

    for(let lineNo = 0; lineNo < this.layout.length; ++lineNo) {
      for(const stk of this.layout[lineNo].region) {
        if(stk.type === "Spacer") {
          continue;
        }

        out.push({
          rect: stk.rect,
          lineNo,
          text: stk.text,
        });
      }
    }

    return out;
  }
}

export class PebbleLayoutSettings implements ViewSettings {
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
    return new PebbleLayoutSettings(this.translateWraps, this.idealLeading);
  }
}

export default class PebbleLayout implements alt.Layout {
  private settings: PebbleLayoutSettings;

  constructor(settings: PebbleLayoutSettings) {
    this.settings = settings;
  }

  layout(layoutTree: alt.LayoutTree<alt.WithMeasurements>): PebbleLayoutResult {
    /**
     * Produce a unique ID.
     */
    const nextUid = (() => {
      let _nextUid = 0;
      return () => {
        return _nextUid++;
      };
    })();

    const empty: rlt.LayoutTree<rlt.WithMeasurements> = { type: "Spacer", width: 0, text: "" };
    const rlt: rlt.LayoutTree<rlt.WithMeasurements> = reassocLayoutTree(layoutTree, empty);
    const uidToColor: Map<number, string> = new Map();

    const go = (root: rlt.LayoutTree<rlt.WithMeasurements>): L1p => {
      switch(root.type) {
        case "Atom": return layoutFromRect(root.rect, root.text);
        case "Spacer": return layoutFromSpacer(root.width);
        case "JoinH": {
          const layout = go(root.lhs);
          extendH(layout, go(root.rhs));
          return layout;
        }
        case "JoinV": {
          const layout = go(root.lhs);
          extendV(layout, go(root.rhs));
          return layout;
        }
        case "Wrap": {
          const uid = nextUid();
          if(root.sty?.fill) {
            uidToColor.set(uid, root.sty.fill);
          }
          const layout = go(root.child);
          wrapLayout(layout, uid, root.padding, this.settings.translateWraps);
          return layout;
        }
      }
    }

    const layout = go(rlt);

    // Now, finalize the layout by vertically positioning each line.
    let lastLineOffset = 0;
    const done: Region = [];
    for(const line of layout) {
      const currentLineOffset = leadingRegion(done, line.region);
      const effectiveLeading = currentLineOffset - lastLineOffset;
      const adjustedOffset = lastLineOffset + Math.max(effectiveLeading, this.settings.idealLeading);

      // Put the current line in its place.
      translateRegion(line.region, { dx: 0, dy: adjustedOffset });
      done.push(...line.region);

      lastLineOffset = adjustedOffset;
    }

    return new PebbleLayoutResult(layout, uidToColor);
  }
}
