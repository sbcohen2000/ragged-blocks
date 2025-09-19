import { LayoutTree, WithMeasurements, atom, node, newline } from "../../layout-tree-utils";

export const layoutTree: LayoutTree<WithMeasurements> =
             node([
               atom(50, 20),
               atom(50, 50),
               newline(),
               atom(20, 20),
               newline(),
               atom(100, 20)
             ], 0);
