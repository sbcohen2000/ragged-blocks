import { LayoutTree, WithMeasurements, atom, newline, node } from "../../layout-tree-utils";

export const layoutTree: LayoutTree<WithMeasurements> = (function () {
  const nodes: LayoutTree<WithMeasurements>[] = [atom(10, 10)];

  for(let i = 0; i < 10 - 1; ++i) {
    nodes.push(newline());
    nodes.push(atom(10, i * 10 + 10));
  }

  return node(nodes, 0);
})();
