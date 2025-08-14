/**
 * The `Backing` is a container for the layout's underlying
 * rectangles and spacers.
 */

import assert from "../assert";
import * as r from "../rect";
import * as v from "../vector";
import { Range, Region } from "./region";

export type RectOrSpacer = r.Rect | number;

type RectWithPadding = {
  /**
   * The underlying positioned rectangle.
   */
  rect: r.Rect;
  /**
   * It's maximum padding.
   */
  maxPadding: number;
};

type RectOrSpacerWithPadding = RectWithPadding | number;

const CELL_SIZE = 100;

export default class Backing {
  private elements: RectOrSpacerWithPadding[];
  /**
   * Mapping from y-coordinate to set of indices into `elements`.
   */
  private chunks: Map<number, Set<number>>;

  private minChunk: number;
  private maxChunk: number;

  /**
   * Construct a new empty `Backing`.
   */
  constructor() {
    this.minChunk = 0;
    this.maxChunk = 0;
    this.elements = [];
    this.chunks = new Map();
    this.chunks.set(0, new Set());
  }

  private chunkRangeOfRect(r: RectWithPadding): [number, number] {
    return [
      Math.floor((r.rect.top - r.maxPadding) / CELL_SIZE),
      Math.floor((r.rect.bottom + r.maxPadding) / CELL_SIZE)
    ];
  }

  private addChunksUpto(chunkNo: number) {
    if(chunkNo < this.minChunk) {
      for(let i = this.minChunk - 1; i >= chunkNo; --i) {
        this.chunks.set(i, new Set());
      }
      this.minChunk = chunkNo;
    }

    if(chunkNo > this.maxChunk) {
      for(let i = this.maxChunk + 1; i <= chunkNo; ++i) {
        this.chunks.set(i, new Set());
      }
      this.maxChunk = chunkNo;
    }
  }

  private getOrAddChunk(chunkNo: number): Set<number> {
    let chunk = this.chunks.get(chunkNo);
    if(chunk !== undefined) {
      return chunk;
    } else {
      this.addChunksUpto(chunkNo);
      return this.chunks.get(chunkNo)!;
    }
  }

  private translateRect(index: number, v: v.Vector) {
    const elt = this.elements[index];
    if(typeof elt === "number") {
      return;
    }

    let [oldMinChunk, oldMaxChunk] = this.chunkRangeOfRect(elt);
    for(let i = oldMinChunk; i <= oldMaxChunk; ++i) {
      this.chunks.get(i)!.delete(index);
    }

    elt.rect = r.translate(elt.rect, v);
    let [newMinChunk, newMaxChunk] = this.chunkRangeOfRect(elt);
    for(let i = newMinChunk; i <= newMaxChunk; ++i) {
      this.getOrAddChunk(i).add(index);
    }
  }

  *iterChunks(): IterableIterator<number[]> {
    for(let i = this.maxChunk; i >= this.minChunk; --i) {
      const chunk = this.chunks.get(i)!;
      yield [...chunk.values()];
    }
  }

  /**
   * Add a new `Rect` to the `Backing`, returning its index.
   *
   * @param r The new `Rect` to add.
   * @param padding The maximum padding that can be applied to this
   * rectangle.
   * @returns The index of the element.
   */
  pushRect(r: r.Rect, maxPadding: number) {
    const elt = { rect: r, maxPadding };
    this.elements.push(elt);
    const index = this.elements.length - 1;

    let [minChunk, maxChunk] = this.chunkRangeOfRect(elt);
    for(let i = minChunk; i <= maxChunk; ++i) {
      this.getOrAddChunk(i).add(index);
    }

    return index;
  }

  /**
   * Add a new spacer to the `Backing`, returning its index.
   *
   * @param w The width of the new spacer.
   * @returns The index of the element.
   */
  pushSpacer(w: number) {
    this.elements.push(w);
    return this.elements.length - 1;
  }

  /**
   * Translate each rectangle in the `Range` by the given offset
   * vector (spacers are ignored).
   *
   * @param range The `Range` of indices to offset.
   * @param v The vector by which to offset each element in the `Range`.
   */
  translateRange(range: Range, v: v.Vector) {
    assert(range.begin >= 0 && range.end <= this.elements.length);

    for(let i = range.begin; i < range.end; ++i) {
      this.translateRect(i, v);
    }
  }

  /**
   * Translate each rectangle in the `Region` by the given offset
   * vector (spacers are ignored).
   *
   * @param region The `Region` to offset.
   * @param v The vector by which to offset each element in the `Region`.
   */
  translateRegion(region: Region, v: v.Vector) {
    if(region !== "EmptyRegion") {
      this.translateRange(region.range, v);
    }
  }

  /**
   * Return the `RectOrSpacer` at the given index, or throw an error
   * if the provided index is invalid.
   *
   * @param index The index to lookup.
   * @returns The `RectOrSpacer` at the given `index`.
   */
  getByIndex(index: number): RectOrSpacer {
    const e = this.elements[index];
    if(typeof e === "number") {
      return e;
    } else {
      return e.rect;
    }
  }

  /**
   * Return an iterator over the rectangles in the given `Range`,
   * along with the rectangle's index (spacers are ignored).
   *
   * @param range The `range` of elements to return.
   * @returns An iterator.
   */
  *iterRangei(range: Range): IterableIterator<[r.Rect, number]> {
    for(let i = range.begin; i < range.end; ++i) {
      const elt = this.elements[i];

      if(typeof elt !== "number") {
        yield [elt.rect, i];
      }
    }
  }

  /**
   * Return an iterator over the rectangles in the given `Region`,
   * along with the rectangle's index (spacers are ignored).
   *
   * @param region The `region` whose range of elements to return.
   * @returns An iterator.
   */
  iterRegioni(region: Region): IterableIterator<[r.Rect, number]> {
    if(region !== "EmptyRegion") {
      return this.iterRangei(region.range);
    }

    // If the region is empty, return an iterator which yields
    // nothing.
    return (function *() {})();
  }
}
