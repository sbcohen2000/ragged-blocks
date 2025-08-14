import { LayoutTree, WithMeasurements, atom, newline, node } from "../../layout-tree-utils";

const nl = (l: LayoutTree<WithMeasurements>, r: LayoutTree<WithMeasurements>, fill: string) =>
  node([l, newline(), r], 10, fill);

export const layoutTree: LayoutTree<WithMeasurements> =
             nl(atom(10, 10), nl(atom(10, 10), nl(atom(10, 10), atom(10, 10), "red"), "blue"), "green");
