import * as alt from "../layout-tree";
import * as rlt from "../reassoc/layout-tree";
import reassocLayoutTree from "../reassoc/reassoc-layout-tree";
import { FragmentsInfo, FragmentInfo } from "../layout-tree";
import { PolygonRendering, pathOfRect } from "../polygon";
import { Svg, Render, SVGStyle } from "../render";
import { Vector, add, zero } from "../vector";
import { LayoutSettings } from "../settings";
import { inflate, Rect, translate, union, clone, width, height } from "../rect";

export type WithRelativeOffsets<A = {}> = {
  JoinH:   { rhsRelOfs: Vector };
  JoinV:   { rhsRelOfs: Vector };
  Atom:    { rect: Rect };
  Wrap:    { relRect: Rect, childRelOfs: Vector };
} & A;

/**
 * Given a layout tree adorned with positioned rectangles, find the
 * outermost rectangle in the layout tree.
 *
 * @param layoutTree The layout tree to search.
 * @returns The outermost rectangle, or `null` if the tree doesn't
 * contain any rectangles.
 */
function outermostRect<D>(layoutTree: rlt.LayoutTree<D, rlt.WithPositions>): Rect | null {
  switch(layoutTree.type) {
    case "JoinH":
    case "JoinV": return outermostRect(layoutTree.lhs) || outermostRect(layoutTree.rhs);
    case "Atom": return layoutTree.isSpacer ? null : layoutTree.rect;
    case "Wrap": return layoutTree.rect;
  }
}

class BlocksLayoutResult<D> extends Render implements FragmentsInfo<D> {
  private layoutTree: rlt.LayoutTree<D, rlt.WithPositions>;

  constructor(layoutTree: rlt.LayoutTree<D, rlt.WithPositions>) {
    super();
    this.layoutTree = layoutTree;
  }

  render(svg: Svg, sty: SVGStyle): void {
    const go = (root: rlt.LayoutTree<D, rlt.WithPositions>) => {
      switch(root.type) {
        case "JoinH":
        case "JoinV": {
          go(root.lhs);
          go(root.rhs);
        } break;
        case "Atom": break;
        case "Wrap": {
          if(width(root.rect) > 0 && height(root.rect) > 0) {
            const p = pathOfRect(root.rect);
            const r = new PolygonRendering([p]).withStyles({
              fill: "none",
              ...root.sty,
            });
            r.render(svg, sty);
          }
          go(root.child);
        } break;
      }
    };

    go(this.layoutTree);
  }

  boundingBox(): Rect | null {
    return outermostRect(this.layoutTree);
  }

  fragmentsInfo(): FragmentInfo<D>[] {
    let out: FragmentInfo<D>[] = [];
    let lineNo = 0;
    const go = (root: rlt.LayoutTree<D, rlt.WithPositions>) => {
      switch(root.type) {
        case "JoinH": {
          go(root.lhs);
          go(root.rhs);
        } break;
        case "JoinV": {
          go(root.lhs);
          lineNo += 1;
          go(root.rhs);
        } break;
        case "Atom": {
          if(!root.isSpacer) out.push({ ...root, lineNo });
        } break;
        case "Wrap": {
          go(root.child);
        } break;
      }
    };

    go(this.layoutTree);
    return out;
  }
}

export interface BlocksLayoutSettings extends LayoutSettings {
}

export default class BlocksLayout<D> implements alt.Layout<D> {
  constructor(_settings: Partial<BlocksLayoutSettings>) {}

  async layout(layoutTree: alt.LayoutTree<D, alt.WithMeasurements>): Promise<BlocksLayoutResult<D>> {
    const empty: rlt.LayoutTree<D, rlt.WithMeasurements> = { type: "Atom", text: "", isSpacer: true, rect: { left: 0, right: 0, top: 0, bottom: 0 } };
    const rlt: rlt.LayoutTree<D, rlt.WithMeasurements> = reassocLayoutTree(layoutTree, empty);

    // Note: The blocks layout algorithm is implemented in two stages:
    // First, the layout tree is traversed to find the relative offset
    // and sizes of each node. This permits a parent `JoinH` or `JoinV`
    // node to know the offset to apply to its right child so that it
    // either horizontally or vertically "stacks" beside it. It permits
    // a `Wrap` node to know the relative position and size of its
    // rectangle.
    //
    // In the second phase, these relative positions are converted into
    // absolute positions by accumulating an offset during our tree
    // traversal.

    /**
     * Find the relative offset and size of each node in the layout
     * tree.
     */
    const goRel = (root: rlt.LayoutTree<D, rlt.WithMeasurements>): [rlt.LayoutTree<D, WithRelativeOffsets>, Rect] => {
      switch(root.type) {
        case "JoinH": {
          const [lhs, lhsRelRect] = goRel(root.lhs);
          let [rhs, rhsRelRect] = goRel(root.rhs);
          const ofs = { dx: lhsRelRect.right - rhsRelRect.left, dy: 0 };
          rhsRelRect = translate(rhsRelRect, ofs);
          return [{ ...root, lhs, rhs, rhsRelOfs: ofs }, union(lhsRelRect, rhsRelRect)];
        }
        case "JoinV": {
          const [lhs, lhsRelRect] = goRel(root.lhs);
          let [rhs, rhsRelRect] = goRel(root.rhs);
          const ofs = { dx: 0, dy: lhsRelRect.bottom - rhsRelRect.top };
          rhsRelRect = translate(rhsRelRect, ofs);
          return [{ ...root, lhs, rhs, rhsRelOfs: ofs }, union(lhsRelRect, rhsRelRect)];
        }
        case "Atom": {
          if(root.isSpacer) {
            return [{ ...root }, { left: 0, right: width(root.rect), top: 0, bottom: 0 }];
          }
          return [{ ...root }, clone(root.rect)];
        }
        case "Wrap": {
          let [child, childRelRect] = goRel(root.child);
          const ofs = { dx: root.padding, dy: root.padding };
          childRelRect = translate(childRelRect, ofs);
          const relRect = inflate(childRelRect, root.padding);
          return [{ ...root, child, childRelOfs: ofs, relRect }, relRect];
        }
      }
    };

    /**
     * Given a layout tree annotated with the relative offset and size
     * of each node, return a layout tree annotated with the final
     * position of each node in the tree.
     */
    const goFinalize = (root: rlt.LayoutTree<D, WithRelativeOffsets>, ofs: Vector): rlt.LayoutTree<D, rlt.WithPositions> => {
      switch(root.type) {
        case "JoinH":
        case "JoinV": {
          const lhs = goFinalize(root.lhs, ofs);
          const rhs = goFinalize(root.rhs, add(ofs, root.rhsRelOfs));
          return { ...root, lhs, rhs };
        }
        case "Atom": {
          if(root.isSpacer) return { ...root };
          const rect = translate(root.rect, ofs);
          return { ...root, rect };
        }
        case "Wrap": {
          const rect = translate(root.relRect, ofs);
          const child = goFinalize(root.child, add(ofs, root.childRelOfs));
          return { ...root, child, rect };
        }
      }
    };

    const [withRelRects, _] = goRel(rlt);
    return new BlocksLayoutResult(goFinalize(withRelRects, zero()));
  }
}
