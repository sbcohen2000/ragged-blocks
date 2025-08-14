import { LayoutTree, WithMeasurements, atom, newline, node } from "../../layout-tree-utils";

const nl = (l: LayoutTree<WithMeasurements>, r: LayoutTree<WithMeasurements>, fill: string) =>
  node([l, newline(), r], 10, fill);

export const layoutTree: LayoutTree<WithMeasurements> =
             nl(nl(nl(atom(10, 10), atom(10, 10), "red"), atom(10, 10), "blue"), atom(10, 10), "green");
