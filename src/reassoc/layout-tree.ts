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

export type JoinH<X extends Ann = Ann> = {
  type: "JoinH";
  lhs: LayoutTree<X>;
  rhs: LayoutTree<X>;
} & X["JoinH"];

export type JoinV<X extends Ann = Ann> = {
  type: "JoinV";
  lhs: LayoutTree<X>;
  rhs: LayoutTree<X>;
} & X["JoinV"];

export type Atom<X extends Ann = Ann> = {
  type: "Atom";
  text: string;
  pinId?: string;
} & X["Atom"];

export type Spacer<X extends Ann = Ann> = {
  type: "Spacer";
  text: string;
} & X["Spacer"];

export type Wrap<X extends Ann = Ann> = {
  type: "Wrap";
  child: LayoutTree<X>;
  padding: number;
  sty?: Partial<SVGStyle>;
} & X["Wrap"];

export type LayoutTree<X extends Ann = Ann> = JoinH<X> | JoinV<X> | Atom<X> | Spacer<X> | Wrap<X>;

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
