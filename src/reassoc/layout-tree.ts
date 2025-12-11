/**
 * The type of layout trees, specialized for blocks layout.
 */

import * as alt from "../layout-tree";
import { Polygon } from "../polygon";
import { Rect } from "../rect";
import { SVGStyle } from "../render";

export interface Ann {
  JoinH: object;
  JoinV: object;
  Atom: object;
  Spacer: object;
  Wrap: object;
};

export type JoinH<D, X extends Ann = Ann> = {
  type: "JoinH";
  lhs: LayoutTree<D, X>;
  rhs: LayoutTree<D, X>;
} & X["JoinH"];

export type JoinV<D, X extends Ann = Ann> = {
  type: "JoinV";
  lhs: LayoutTree<D, X>;
  rhs: LayoutTree<D, X>;
} & X["JoinV"];

export type Atom<D, X extends Ann = Ann> = {
  type: "Atom";
  text: string;
  pinId?: string;
  userData?: D;
} & X["Atom"];

export type Spacer<X extends Ann = Ann> = {
  type: "Spacer";
  text: string;
} & X["Spacer"];

export type Wrap<D, X extends Ann = Ann> = {
  type: "Wrap";
  child: LayoutTree<D, X>;
  padding: number;
  sty?: Partial<SVGStyle>;
} & X["Wrap"];

export type LayoutTree<D, X extends Ann = Ann> = JoinH<D, X> | JoinV<D, X> | Atom<D, X> | Spacer<X> | Wrap<D, X>;

/**
 * Produce an annotation type which copies the `Atom` and `Spacer`
 * annotations of the given argument type.
 */
export type WithAtomAndSpacerOf<A extends alt.Ann> = {
  JoinH:   object;
  JoinV:   object;
  Atom:    A["Atom"];
  Spacer:  A["Spacer"];
  Wrap:    object;
};

export type WithMeasurements<A = {}> = {
  JoinH:   object;
  JoinV:   object;
  Atom:    { rect: Rect };
  Spacer:  { width: number };
  Wrap:    object;
} & A;

export type WithOutlines<A = {}> = {
  JoinH:   object;
  JoinV:   object;
  Atom:    object;
  Spacer:  object;
  Wrap:    { outline: Polygon };
} & A;

export type WithPositions<A = {}> = {
  JoinH:   object;
  JoinV:   object;
  Atom:    { rect: Rect };
  Spacer:  { width: number };
  Wrap:    { rect: Rect };
} & A;

/**
 * Count the number of `Wrap` nodes in a `LayoutTree`.
 */
export function countWraps<D>(root: LayoutTree<D>): number {
  switch(root.type) {
    case "Atom":
    case "Spacer": return 0;
    case "JoinH":
    case "JoinV": return countWraps(root.lhs) + countWraps(root.rhs);
    case "Wrap": return 1 + countWraps(root.child);
  }
}
