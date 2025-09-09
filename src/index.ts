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
import {
  OutlinedRocksLayout,
  OutlinedRocksLayoutSettings,
  RocksLayout,
  RocksLayoutWithPins,
  RocksLayoutSettings
} from "./rocks-layout/layout";

export type AlgorithmName = "L1P" | "L1S" | "L2AS" | "L1S+" | "Blocks" | "S-Blocks";

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
    case "L2AS":
    case "L1S+":
    case "Blocks":
    case "S-Blocks": return str;
    default: return undefined;
  }
}

export type Algorithm = PebbleLayout | RocksLayout | RocksLayoutWithPins | OutlinedRocksLayout | BlocksLayout | SBlocksLayout;

/**
 * For a given `AlgorithmName`, get the type of the class which
 * implements the given layout algorithm.
 */
export type AlgorithmOfName<A extends AlgorithmName> =
    A extends "L1P"      ? PebbleLayout
  : A extends "L1S"      ? RocksLayout
  : A extends "L2AS"     ? RocksLayoutWithPins
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
  : A extends "L2AS"     ? RocksLayoutSettings
  : A extends "L1S+"     ? OutlinedRocksLayoutSettings
  : A extends "Blocks"   ? BlocksLayoutSettings
  : A extends "S-Blocks" ? SBlocksLayoutSettings
  : never;

export function constructAlgoByName<A extends AlgorithmName>(name: A): (settings: Settings<A>) => Algorithm;
export function constructAlgoByName<A extends AlgorithmName>(name: A): (settings: any) => Algorithm {
  switch(name) {
    case "L1P": return (settings: PebbleLayoutSettings) => new PebbleLayout(settings);
    case "L1S": return (settings: RocksLayoutSettings) => new RocksLayout(settings);
    case "L2AS": return (settings: RocksLayoutSettings) => new RocksLayoutWithPins(settings);
    case "L1S+": return (settings: OutlinedRocksLayoutSettings) => new OutlinedRocksLayout(settings);
    case "Blocks": return (settings: BlocksLayoutSettings) => new BlocksLayout(settings);
    case "S-Blocks": return (settings: SBlocksLayoutSettings) => new SBlocksLayout(settings);
  }
}

export interface AlgorithmConstructor<A extends AlgorithmName> {
  new (settings: Settings<A>): A;
}
