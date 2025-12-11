export * from "./layout-tree";
export * as rlt from "./reassoc/layout-tree";
export * from "./rect";
export * from "./render";
export { MeshDistanceMesh } from "./mesh-distance";
export { RocksLayout, OutlinedRocksLayout } from "./rocks-layout/layout";
export { default as BlocksLayout } from "./blocks-layout/layout";
export { default as PebbleLayout } from "./pebble-layout/layout";
export { default as SBlocksLayout } from "./s-blocks-layout/layout";

export { BlocksLayoutSettings } from "./blocks-layout/layout";
export { OutlinedRocksLayoutSettings, RocksLayoutSettings } from "./rocks-layout/layout";
export { PebbleLayoutSettings } from "./pebble-layout/layout";
export { SBlocksLayoutSettings } from "./s-blocks-layout/layout";

import * as alt from "./layout-tree";
import * as rlt from "./reassoc/layout-tree";
import { default as internalReassocLayoutTree } from "./reassoc/reassoc-layout-tree";
import BlocksLayout, { BlocksLayoutSettings } from "./blocks-layout/layout";
import PebbleLayout, { PebbleLayoutSettings } from "./pebble-layout/layout";
import SBlocksLayout, { SBlocksLayoutSettings } from "./s-blocks-layout/layout";
import {
  OutlinedRocksLayout,
  OutlinedRocksLayoutSettings,
  RocksLayout,
  RocksLayoutWithPins,
  OutlinedRocksLayoutWithPins,
  RocksLayoutSettings
} from "./rocks-layout/layout";

export type AlgorithmName = "L1P" | "L1S" | "L1S+" | "L2AS" | "L2AS+" | "Blocks" | "S-Blocks";

/**
 * Interpret `str` as an algorithm name, returning `undefined` if
 * `str` isn't a valid algorithm name.
 *
 * @param str The string to interpret as an algorithm name.
 * @returns An `AlgorithmName`, or `undefined` if `str` wasn't a valid
 * algorithm name.
 */
export function asAlgorithmName(str: string): AlgorithmName | undefined {
  switch(str) {
    case "L1P":
    case "L1S":
    case "L1S+":
    case "L2AS":
    case "L2AS+":
    case "Blocks":
    case "S-Blocks": return str;
    default: return undefined;
  }
}

export type Algorithm<D> = PebbleLayout<D> | RocksLayout<D> | RocksLayoutWithPins<D> | OutlinedRocksLayout<D> | OutlinedRocksLayoutWithPins<D> | BlocksLayout<D> | SBlocksLayout<D>;

/**
 * For a given `AlgorithmName`, get the type of the class which
 * implements the given layout algorithm.
 */
export type AlgorithmOfName<A extends AlgorithmName, D> =
    A extends "L1P"      ? PebbleLayout<D>
  : A extends "L1S"      ? RocksLayout<D>
  : A extends "L1S+"     ? OutlinedRocksLayout<D>
  : A extends "L2AS"     ? RocksLayoutWithPins<D>
  : A extends "L2AS+"    ? OutlinedRocksLayoutWithPins<D>
  : A extends "Blocks"   ? BlocksLayout<D>
  : A extends "S-Blocks" ? SBlocksLayout<D>
  : never;

/**
 * For a given `Algorithm`, return the type of its `Settings`.
 */
export type Settings<A extends AlgorithmName> =
    A extends "L1P"      ? PebbleLayoutSettings
  : A extends "L1S"      ? RocksLayoutSettings
  : A extends "L2AS"     ? RocksLayoutSettings
  : A extends "L1S+"     ? OutlinedRocksLayoutSettings
  : A extends "Blocks"   ? BlocksLayoutSettings
  : A extends "S-Blocks" ? SBlocksLayoutSettings
  : never;

export function constructAlgoByName<A extends AlgorithmName, D>(name: A, settings: Settings<A>): Algorithm<D> {
  switch(name) {
    case "L1P": return new PebbleLayout(settings as Settings<"L1P">);
    case "L1S": return new RocksLayout(settings as Settings<"L1S">);
    case "L1S+": return new OutlinedRocksLayout(settings as Settings<"L1S+">);
    case "L2AS": return new RocksLayoutWithPins(settings as Settings<"L2AS">);
    case "L2AS+": return new OutlinedRocksLayoutWithPins(settings as Settings<"L2AS+">);
    case "Blocks": return new BlocksLayout(settings as Settings<"Blocks">);
    case "S-Blocks": return new SBlocksLayout(settings as Settings<"S-Blocks">);
  }
}

export interface AlgorithmConstructor<A extends AlgorithmName> {
  new (settings: Settings<A>): A;
}

/**
 * Convert an abstract layout tree into a rocks layout tree. You
 * probably don't need this function. It's only used to count the true
 * number of wrap nodes in a layout tree for benchmarking purposes.
 *
 * @param lt The input layout tree.
 * @returns The specialized rocks layout tree.
 */
export function reassocLayoutTree<D, A extends alt.Ann>(
  lt: alt.LayoutTree<D, A>,
): rlt.LayoutTree<D, rlt.WithAtomAndSpacerOf<A>> {
  const empty: alt.LayoutTree<D, A> = { type: "Spacer", width: 0, text: "" };
  return internalReassocLayoutTree(lt, empty);
}
