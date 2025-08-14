import { LayoutTree, WithMeasurements } from "../src/layout-tree";
export * from "../src/layout-tree";

export function rect(w: number, h: number) {
  return { left: 0, right: w, top: 0, bottom: h };
}

export function atom(w: number, h: number): LayoutTree<WithMeasurements> {
  return { type: "Atom", rect: rect(w, h), text: "" };
}

export function spacer(w: number): LayoutTree<WithMeasurements> {
  return { type: "Spacer", width: w, text: "" };
}

export function newline(): LayoutTree<WithMeasurements> {
  return { type: "Newline" };
}

export function node(children: LayoutTree<WithMeasurements>[], padding?: number, fill?: string): LayoutTree<WithMeasurements> {
  padding = padding ?? 10;
  return { type: "Node", children, padding, sty: { fill: fill ?? "gray" } };
}
