/**
 * This module defines the interface for a `LayoutTree`, the input
 * type of each layout algorithm.
 */

import { Point } from "./point";
import { Polygon } from "./polygon";
import { Rect, width, height, union } from "./rect";
import { DEFAULT_BORDER_STYLE, DEFAULT_STYLE, Svg, Render, SVGStyle } from "./render";

export interface Ann {
  Newline: object;
  Atom: object;
  Node: object;
}

export type Newline<X extends Ann = Ann> = {
  type: "Newline";
} & X["Newline"];

export type Atom<D, X extends Ann = Ann> = {
  type: "Atom";
  text: string;
  pinId?: string;
  userData?: D;
  isSpacer: boolean;
} & X["Atom"];

export type Node<D, X extends Ann = Ann> = {
  type: "Node";
  padding: number;
  sty?: Partial<SVGStyle>;
  userData?: D;
  children: LayoutTree<D, X>[];
} & X["Node"];

export type LayoutTree<D, X extends Ann = Ann> = Newline<X> | Atom<D, X> | Node<D, X>;

export type WithStyleRefs<A = {}> = {
  Atom:    object;
  Newline: object;
  Node:    { styleRef?: string };
} & A;

export type WithMeasurements<A = {}> = {
  Atom:    { rect: Rect };
  Newline: object;
  Node:    object;
} & A;

export type WithOutlines<A = {}> = {
  Atom:    object;
  Newline: object;
  Node:    { outline: Polygon };
} & A;

/**
 * An interface implemented by types which can produce a `Render`able
 * object given a `LayoutTree<WithMeasurements>`.
 */
export interface Layout<D> {
  layout(layoutTree: LayoutTree<D, WithMeasurements>): Promise<Render & FragmentsInfo<D>>;
}

/**
 * Information about a positioned fragment.
 */
export type FragmentInfo<D> = {
  type: "Atom";
  text: string;
  rect: Rect;
  lineNo: number;
  userData?: D;
  isSpacer: boolean;
};

/**
 * Layout algorithms which implement this interface can provide
 * information about their laid-out fragments.
 */
export interface FragmentsInfo<D> {
  /**
   * Yield the laid-out fragments, in order.
   */
  fragmentsInfo(): FragmentInfo<D>[];
}

/**
 * Find a representative position for a fragment.
 *
 * @param fragment The fragment whose position to find.
 * @returns A `Point` representing the fragment's position.
 */
export function fragmentPosition<D>(fragment: FragmentInfo<D>): Point {
  //return centerPoint(fragment.rect);
  return { x: fragment.rect.left, y: fragment.rect.top };
}

/**
 * Given a layout tree with text nodes at the leaves, annotate each
 * leaf with a rectangle derived from the provided `measure` function.
 *
 * @param tree The layout tree to annotate.
 * @param measure A function which, given some text, can produce a
 * rectangle representing the bounds of the text.
 * @returns A new layout tree, identical to the input, except that
 * each leaf has been annotated with its size according to `measure`.
 */
export function measureLayoutTree<D>(
  tree: LayoutTree<D>,
  measure: (text: string, userData: D | undefined) => Rect
): LayoutTree<D, WithMeasurements> {
  switch(tree.type) {
    case "Newline": return tree;
    case "Atom": {
      const rect = measure(tree.text, tree.userData);
      return {
        ...tree,
        rect
      }
    };
    case "Node": {
      return {
        ...tree,
        children: tree.children.map(child => measureLayoutTree(child, measure))
      }
    };
  }
}

/**
 * Given a layout tree, set the `fill` of every node to a random
 * color. The colors are pulled from a set of "pleasing" colors.
 *
 * @param tree The input layout tree to modify.
 */
export function randomizeFillColors<D>(tree: LayoutTree<D>) {
  const COLORS: string[] = [
    "lightblue",
    "lightcoral",
    "lightgray",
    "lightgreen",
    "lightpink",
    "lightsalmon",
    "lightgoldenrodyellow",
    "moccasin",
    "thistle",
  ];
  let colorCounter = 0;

  const go = (root: LayoutTree<D>) => {
    switch(root.type) {
      case "Newline": break;
      case "Atom": break;
      case "Node": {
        if(!root.sty) {
          root.sty = { ...DEFAULT_STYLE };
        }
        root.sty.fill = COLORS[colorCounter];
        root.sty.borders = [{ ...DEFAULT_BORDER_STYLE }];
        colorCounter = (colorCounter + 1) % COLORS.length;
        root.children.forEach(go);
      }
    }
  }

  go(tree);
}

/**
 * Remove all of the padding from every `Node` in a `LayoutTree`.
 *
 * @param tree The input tree to modify.
 */
export function removePadding<D, A extends Ann>(tree: LayoutTree<D, A>) {
  const go = (root: LayoutTree<D, A>) => {
    switch(root.type) {
      case "Newline": break;
      case "Atom": break;
      case "Node": {
        root.padding = 0;
        root.children.forEach(go);
      }
    }
  }

  go(tree);
}

export type WithStyles<A = {}> = {
  Atom:    { sty: Partial<SVGStyle> };
  Newline: object;
  Node:    object;
} & A;

/**
 * Given a type which implements `FragmentsInfo`, produce a
 * `Render`able object which renders the positions of each fragment
 * with a white box with black stroke.
 */
export class FragmentBoundingBoxesRendering<D> extends Render {
  private layoutResult: FragmentsInfo<D>;

  constructor(layoutResult: FragmentsInfo<D>) {
    super();
    this.layoutResult = layoutResult;
  }

  render(svg: Svg, _sty: SVGStyle) {
    for(const frag of this.layoutResult.fragmentsInfo()) {
      svg.rect(width(frag.rect), height(frag.rect))
        .move(frag.rect.left, frag.rect.top)
        .fill("white")
        .stroke("black")
        .strokeWidth(1);
    }
  }

  boundingBox(): Rect | null {
    let bbox: Rect | null = null;
    for(const frag of this.layoutResult.fragmentsInfo()) {
      if(bbox === null) {
        bbox = frag.rect;
      } else {
        bbox = union(bbox, frag.rect);
      }
    }
    return bbox;
  }
}

