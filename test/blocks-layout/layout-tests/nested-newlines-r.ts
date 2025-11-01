import { LayoutTree, WithMeasurements, atom, newline, node } from "../../layout-tree-utils";

const nl = (l: LayoutTree<void, WithMeasurements>, r: LayoutTree<void, WithMeasurements>, fill: string) =>
  node([l, newline(), r], 10, fill);

export const layoutTree: LayoutTree<void, WithMeasurements> =
  nl(atom(10, 10), nl(atom(10, 10), nl(atom(10, 10), atom(10, 10), "red"), "blue"), "green");
