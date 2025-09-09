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
  Spacer: object;
  Node: object;
}

export type Newline<X extends Ann = Ann> = {
  type: "Newline";
} & X["Newline"];

export type Atom<X extends Ann = Ann> = {
  type: "Atom";
  text: string;
  pinId?: string;
} & X["Atom"];

export type Spacer<X extends Ann = Ann> = {
  type: "Spacer";
  text: string;
} & X["Spacer"];

export type Node<X extends Ann = Ann> = {
  type: "Node";
  padding: number;
  sty?: Partial<SVGStyle>;
  children: LayoutTree<X>[];
} & X["Node"];

export type LayoutTree<X extends Ann = Ann> = Newline<X> | Atom<X> | Spacer<X> | Node<X>;

export type WithStyleRefs<A = {}> = {
  Atom:    object;
  Spacer:  object;
  Newline: object;
  Node:    { styleRef?: string };
} & A;

export type WithMeasurements<A = {}> = {
  Atom:    { rect: Rect };
  Spacer:  { width: number };
  Newline: object;
  Node:    object;
} & A;

export type WithOutlines<A = {}> = {
  Atom:    object;
  Spacer:  object;
  Newline: object;
  Node:    { outline: Polygon };
} & A;

/**
 * An interface implemented by types which can produce a `Render`able
 * object given a `LayoutTree<WithMeasurements>`.
 */
export interface Layout {
  layout(layoutTree: LayoutTree<WithMeasurements>): Promise<Render & FragmentsInfo>;
}

/**
 * Information about a positioned fragment.
 */
export type FragmentInfo = {
  text: string;
  rect: Rect;
  lineNo: number;
};

/**
 * Layout algorithms which implement this interface can provide
 * information about their laid-out fragments.
 */
export interface FragmentsInfo {
  /**
   * Yield the laid-out fragments, in order.
   */
  fragmentsInfo(): FragmentInfo[];
}

/**
 * Find a representative position for a fragment.
 *
 * @param fragment The fragment whose position to find.
 * @returns A `Point` representing the fragment's position.
 */
export function fragmentPosition(fragment: FragmentInfo): Point {
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
export function measureLayoutTree(tree: LayoutTree, measure: (text: string) => Rect): LayoutTree<WithMeasurements> {
  switch(tree.type) {
    case "Newline": return tree;
    case "Atom": {
      const rect = measure(tree.text);
      return {
        ...tree,
        rect
      }
    };
    case "Spacer": {
      const w = width(measure(tree.text));
      return {
        ...tree,
        width: w
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
export function randomizeFillColors(tree: LayoutTree) {
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

  const go = (root: LayoutTree) => {
    switch(root.type) {
      case "Newline": break;
      case "Atom": break;
      case "Spacer": break;
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
export function removePadding<A extends Ann>(tree: LayoutTree<A>) {
  const go = (root: LayoutTree<A>) => {
    switch(root.type) {
      case "Newline": break;
      case "Atom": break;
      case "Spacer": break;
      case "Node": {
        root.padding = 0;
        root.children.forEach(go);
      }
    }
  }

  go(tree);
}

/**
 * Yield each `Atom` in a `LayoutTree` in document order.
 *
 * @param tree The tree to iterate over.
 * @returns An iterator over `tree`'s `Atom`s.
 */
export function *eachAtom<A extends Ann>(tree: LayoutTree<A>): IterableIterator<Atom<A>> {
  const stack: LayoutTree<A>[] = [tree];

  while(stack.length > 0) {
    const top = stack.pop()!;

    if(top.type === "Node") {
      for(let i = top.children.length - 1; i >= 0; --i) {
        stack.push(top.children[i]);
      }
    } else if(top.type === "Atom") {
      yield top;
    }
  }
}

/**
 * Given a type which implements `FragmentsInfo`, produce a
 * `Render`able object which renders the positions of each fragment
 * with a white box with black stroke.
 */
export class FragmentBoundingBoxesRendering extends Render {
  private layoutResult: FragmentsInfo;

  constructor(layoutResult: FragmentsInfo) {
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

