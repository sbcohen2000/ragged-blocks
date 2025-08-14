export * from "./layout-tree";
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

import BlocksLayout, { BlocksLayoutSettings } from "./blocks-layout/layout";
import PebbleLayout, { PebbleLayoutSettings } from "./pebble-layout/layout";
import SBlocksLayout, { SBlocksLayoutSettings } from "./s-blocks-layout/layout";
import { OutlinedRocksLayout, OutlinedRocksLayoutSettings, RocksLayout, RocksLayoutSettings } from "./rocks-layout/layout";

export type AlgorithmName = "L1P" | "L1S" | "L1S+" | "Blocks" | "S-Blocks";

export type Algorithm = PebbleLayout | RocksLayout | OutlinedRocksLayout | BlocksLayout | SBlocksLayout;

/**
 * For a given `AlgorithmName`, get the type of the class which
 * implements the given layout algorithm.
 */
export type AlgorithmOfName<A extends AlgorithmName> =
    A extends "L1P"      ? PebbleLayout
  : A extends "L1S"      ? RocksLayout
  : A extends "L1S+"     ? OutlinedRocksLayout
  : A extends "Blocks"   ? BlocksLayout
  : A extends "S-Blocks" ? SBlocksLayout
  : never;

/**
 * For a given `Algorithm`, return the type of its `Settings`.
 */
export type Settings<A extends AlgorithmName> =
    A extends "L1P"      ? PebbleLayoutSettings
  : A extends "L1S"      ? RocksLayoutSettings
  : A extends "L1S+"     ? OutlinedRocksLayoutSettings
  : A extends "Blocks"   ? BlocksLayoutSettings
  : A extends "S-Blocks" ? SBlocksLayoutSettings
  : never;

export function constructAlgoByName<A extends AlgorithmName>(name: A): (settings: Settings<A>) => Algorithm;
export function constructAlgoByName<A extends AlgorithmName>(name: A): (settings: any) => Algorithm {
  switch(name) {
    case "L1P": return (settings: PebbleLayoutSettings) => new PebbleLayout(settings);
    case "L1S": return (settings: RocksLayoutSettings) => new RocksLayout(settings);
    case "L1S+": return (settings: OutlinedRocksLayoutSettings) => new OutlinedRocksLayout(settings);
    case "Blocks": return (settings: BlocksLayoutSettings) => new BlocksLayout(settings);
    case "S-Blocks": return (settings: SBlocksLayoutSettings) => new SBlocksLayout(settings);
  }
}

export interface AlgorithmConstructor<A extends AlgorithmName> {
  new (settings: Settings<A>): A;
}
