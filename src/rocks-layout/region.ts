import assert from "../assert";

/**
 * A range of indices.
 */
export type Range = {
  /**
   * The index of the first element of the range.
   */
  begin: number;
  /**
   * The index of the element _after_ the end of the range
   * (exclusive).
   */
  end: number;
};

/**
 * Construct a new `Range` covering only `index`.
 *
 * @param index The `index` to cover.
 * @returns A `Range` covering `index`.
 */
export function singletonRange(index: number): Range {
  return { begin: index, end: index + 1 };
}

/**
 * A range of rectangles, along with a depth. This is effectively an
 * index into the `Timetable`.
 */
export type Region = {
  range: Range;
  depth: number;
} | "EmptyRegion";

/**
 * The empty region.
 */
export const EMPTY: Region = "EmptyRegion";

/**
 * A reference to the stack of wraps for a single rectangle. This is
 * effectively a `Region` which is guaranteed to have a `range` of
 * size one.
 */
export type StackRef = {
  index: number;
  depth: number;
};

/**
 * Convert a `StackRef` into a `Region`.
 *
 * @param stackRef The `StackRef` to convert into a `Region`.
 * @returns a new `Region` with the same depth and range as the input
 * `StackRef`.
 */
export function regionFromStackRef(stackRef: StackRef): Region {
  return { depth: stackRef.depth, range: singletonRange(stackRef.index) };
}

/**
 * Return a new `Region` representing the span covered by regions `lhs`
 * and `rhs`. If `lhs` and `rhs` aren't immediately adjacent, this function
 * throws an assertion error.
 *
 * @param a The `Region` on the left.
 * @param b The `Region` on the right.
 * @returns A new `Region` covering all of `lhs` and `rhs`.
 */
export function joinRegions(lhs: Region, rhs: Region): Region {
  if(lhs === "EmptyRegion") {
    return rhs;
  }
  if(rhs === "EmptyRegion") {
    return lhs;
  }

  assert(lhs.range.end === rhs.range.begin);
  return {
    range: { begin: lhs.range.begin, end: rhs.range.end },
    depth: Math.min(lhs.depth, rhs.depth)
  };
}

/**
 * Return an iterator over the indices underlying a `Region`.
 *
 * @param region The region over which to iterate.
 * @returns An iterator which will yield a `number` for every index
 * that `region` covers.
 */
export function* enumerateIndices(region: Region): IterableIterator<number> {
  if(region !== "EmptyRegion") {
    for(let i = region.range.begin; i < region.range.end; ++i) {
      yield i;
    }
  }
}
