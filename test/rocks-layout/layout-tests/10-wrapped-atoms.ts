import { LayoutTree, WithMeasurements, atom, node } from "../../layout-tree-utils";

export const layoutTree: LayoutTree<WithMeasurements> = (function () {
  const nodes: LayoutTree<WithMeasurements>[] = [];

  for(let i = 0; i < 10; ++i) {
    nodes.push(node([atom(10, 10)]));
  }

  return node(nodes, 0);
})();
