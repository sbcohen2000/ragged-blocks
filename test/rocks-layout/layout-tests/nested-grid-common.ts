import { LayoutTree, WithMeasurements, atom, newline, node } from "../../layout-tree-utils";

export const _layoutTree: LayoutTree<WithMeasurements> =
             node([
               node([atom(10, 10)], 10, "yellow"),
               newline(),
               node([node([atom(10, 10)], 10, "magenta"), atom(10, 10)], 10, "orange"),
               newline(),
               node([node([node([atom(10, 10)], 10, "blue"), atom(10, 10)], 10, "green"), atom(10, 10)], 10, "red"),
             ]);
