import { LayoutTree, WithMeasurements, atom, node, newline, spacer } from "../../layout-tree-utils";

export const layoutTree: LayoutTree<WithMeasurements> =
             node([
               atom(50, 20),
               newline(),
               spacer(50),
               atom(50, 20),
               newline(),
               spacer(100),
               atom(50, 20),
             ], 0);
