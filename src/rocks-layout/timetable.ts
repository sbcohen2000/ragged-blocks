/**
 * The `Timetable` is a table with a column for each fragment in the
 * layout. Each row corresponds to a "time slice" in the layout.
 */

import assert from "../assert";
import { LayoutTree, Ann } from "../reassoc/layout-tree";
import { Region, StackRef, regionFromStackRef } from "./region";

export type WithRegions<A = {}> = {
  JoinH:  { region: Region };
  JoinV:  { region: Region };
  Atom:   { stackRef: StackRef };
  Spacer: { stackRef: StackRef };
  Wrap:   { region: Region, uid: number };
} & A;

/**
 * Get the region associated with an arbitrary `LayoutTree<WithRegions>`.
 *
 * @param layoutTree The layout tree whose `Region` to get.
 * @returns A `Region`.
 */
export function regionOfLayoutTree(layoutTree: LayoutTree<WithRegions>): Region {
  switch(layoutTree.type) {
    case "Wrap":
    case "JoinV":
    case "JoinH": return layoutTree.region;
    case "Spacer":
    case "Atom": return regionFromStackRef(layoutTree.stackRef);
  }
}

type Cell = {
  /**
   * A `uid` corresponding to a `Wrap` node in the `LayoutTree`.
   */
  uid: number;
  /**
   * The amount of _cumulative_ padding this `Cell` represents.
   */
  padding: number;
};

/**
 * The cell which is implicitly at the base of every column.
 */
const BASE_CELL: Cell = { uid: 0, padding: 0 };

type Column = Cell[];
type ColumnOrSpacer = Column | null;

/**
 * Return the topmost element of a column.
 *
 * @param column The column from which to get the topmost element.
 * @returns The topmost element of the column.
 */
function topOfColumn(column: Column): Cell {
  if(column.length === 0) {
    return BASE_CELL;
  } else {
    return column[column.length - 1];
  }
}

/**
 * Fill a `Column` so that its depth is equal to `depth` by repeating
 * the topmost element. If the column is empty, repeat `null`.
 *
 * @param column The column to fill.
 * @param depth The depth to fill `column` to.
 */
function fillColumn(column: Column, depth: number) {
  const top = topOfColumn(column);
  const curDepth = column.length;
  for(let i = curDepth; i < depth; ++i) {
    column.push(top);
  }
}

/**
 * Add a `Cell` to a `Column` with the given `amount` and `uid`.
 *
 * @param amount The amount to wrap.
 * @param uid The uid of the new `Cell`.
 */
function wrapColumn(column: Column, padding: number, uid: number) {
  const top = topOfColumn(column);
  const cell: Cell = {
    padding: padding + top.padding,
    uid
  };
  column.push(cell);
}

export class Timetable {
  /**
   * A list of columns, each one a list of `Cell`s. It is assumed that
   * each column has the same height.
   */
  private columns: ColumnOrSpacer[];

  /**
   * The depth (length) of each column in `this.columns`.
   */
  private maxDepth: number;

  /**
   * Construct a `Timetable` by providing a `LayoutTree`. The
   * `LayoutTree` is walked to find every root-leaf path in the
   * tree. Each of these paths corresponds to a column of the
   * `Timetable`. Returns both the constructed `Timetable`, and the
   * `LayoutTree` where each node has been annotated with its
   * `Region`.
   *
   * @param layoutTree The layout tree from which to build the table.
   * @returns A pair of `Timetable` and `LayoutTreeWithRegions`.
   */
  static fromLayoutTree<A extends Ann>(layoutTree: LayoutTree<A>): [Timetable, LayoutTree<WithRegions<A>>] {

    // Start at 1 to account for the uid of the `BASE_CELL`.
    let _nextId = 1;
    const nextId = () => _nextId++;

    const columns: ColumnOrSpacer[] = [];

    const go = (root: LayoutTree<A>): [number, LayoutTree<WithRegions<A>>] => {
      switch(root.type) {
        case "Spacer": {
          const index = columns.length;
          columns.push(null);
          return [0, { ...root, stackRef: { depth: 0, index } }];
        }
        case "Atom": {
          const index = columns.length;
          columns.push([]);
          return [0, { ...root, stackRef: { depth: 0, index } }];
        }
        case "JoinH":
        case "JoinV": {
          const begin = columns.length;
          const [lhsDepth, lhs] = go(root.lhs);
          const [rhsDepth, rhs] = go(root.rhs);
          const end = columns.length;
          const maxDepth = Math.max(lhsDepth, rhsDepth);

          // Ensure each column underneath this wrap has the same
          // height so that we can refer to it as a contiguous range
          // on a single row.
          for(let i = begin; i < end; ++i) {
            const col = columns[i];

            if(col !== null) {
              fillColumn(col, maxDepth);
            }
          }

          return [maxDepth,
            {
              ...root,
              lhs,
              rhs,
              region: { range: { begin, end },
                depth: maxDepth }
            }];
        }
        case "Wrap": {
          const uid = nextId();

          const begin = columns.length;
          const [depth, child] = go(root.child);
          const end = columns.length;

          // Ensure each column underneath this wrap has the same
          // height so that we can refer to it as a contiguous range
          // on a single row.
          for(let i = begin; i < end; ++i) {
            const col = columns[i];

            if(col !== null) {
              fillColumn(col, depth);
              wrapColumn(col, root.padding, uid);
            }
          }

          return [depth + 1, {
            ...root,
            uid,
            child,
            region: {
              range: { begin, end },
              depth: depth + 1
            }
          }];
        }
      }
    };

    const [maxDepth, withRegions] = go(layoutTree);

    // Ensure each column has the same height.
    for(const col of columns) {
      if(col !== null) {
        fillColumn(col, maxDepth);
      }
    }

    return [
      new Timetable(columns, maxDepth),
      withRegions
    ];
  }

  /**
   * Private constructor which is called by `fromLayoutTree`.
   */
  private constructor(columns: ColumnOrSpacer[], maxDepth: number) {
    this.columns = columns;
    this.maxDepth = maxDepth;
  }

  /**
   * Test if the given `StackRef` points to a spacer.
   *
   * @param The `StackRef` to lookup.
   * @returns `true` if the `StackRef` points to a spacer, and `false`
   * otherwise.
   */
  isSpacer(stackRef: StackRef): boolean {
    return this.columns[stackRef.index] === null;
  }

  /**
   * Retrieve the `Cell` at the given `StackRef`. Throws if the given
   * `StackRef` points to a spacer.
   *
   * @param stackRef The `StackRef` to lookup.
   * @returns The Cell at the given `index` and `depth`.
   */
  private getCell(stackRef: StackRef): Cell {
    if(stackRef.depth === 0) return BASE_CELL;

    const col = this.columns[stackRef.index];
    assert(col !== undefined && col !== null);
    assert(stackRef.depth <= col.length);
    return col[stackRef.depth - 1];
  }

  /**
   * Get the uid at a particular `StackRef`. Throws if the given
   * column index points to a spacer.
   *
   * @param stackRef The `StackRef` to lookup.
   * @returns The uid at the cell.
   */
  private getUid(stackRef: StackRef): number {
    return this.getCell(stackRef).uid;
  }

  /**
   * Get the cumulative padding amount at a particular column index
   * and depth. Throws if the given column index points to a spacer.
   *
   * @param stackRef The `StackRef` to lookup.
   * @returns The cumulative padding amount.
   */
  getPadding(stackRef: StackRef): number {
    return this.getCell(stackRef).padding;
  }

  /**
   * Get the maximum padding that can be applied to the element at the
   * given index.
   *
   * @param index The index of the element.
   * @returns The maximum padding that may be applied to the element
   * at `index`.
   */
  getMaxPadding(index: number): number {
    return this.getCell({ index, depth: this.maxDepth }).padding;
  }

  /**
   * Given two indices, find the minimum amount of padding that must
   * occur around `a` and `b`, respectively, for the resulting layout
   * to be sound.
   *
   * @param aIdx The first index.
   * @param bIdx The second index.
   * @returns A pair, consisting of `a`'s required padding and `b`'s
   * required padding.
   */
  spaceBetween(aIdx: number, bIdx: number): [number, number] {
    // Start at the maximum depth.
    let a = { index: aIdx, depth: this.maxDepth };
    let b = { index: bIdx, depth: this.maxDepth };

    // The space between a non-spacer element and a spacer is always
    // zero.
    if(this.isSpacer(a) || this.isSpacer(b)) {
      return [0, 0];
    }

    // Traverse down the columns corresponding to `a` and `b`, finding
    // the maximum (i.e. highest number) depth at which the wraps of
    // `a` disagree with the wraps of `b`.
    let aUid = this.getUid(a);
    let bUid = this.getUid(b);

    while(a.depth > 0 && b.depth > 0) {
      const aNext = { ...a, depth: a.depth - 1 };
      const bNext = { ...b, depth: b.depth - 1 };
      const aNextUid = this.getUid(aNext);
      const bNextUid = this.getUid(bNext);

      let stuck = true;
      if(aUid === aNextUid) {
        aUid = aNextUid;
        a = aNext;
        stuck = false;
      }

      if(bUid === aNextUid) {
        bUid = bNextUid;
        b = bNext;
        stuck = false;
      }

      if(aUid === bUid) {
        aUid = aNextUid;
        a = aNext;
        bUid = bNextUid;
        b = bNext;
        stuck = false;
      }

      if(stuck) {
        break;
      }
    }

    const aAmt = this.getPadding(a);
    const bAmt = this.getPadding(b);
    return [aAmt, bAmt];
  }

  /**
   * Yield every valid index, in turn.
   */
  *enumerateIndices() {
    for(let i = 0; i < this.columns.length; ++i) {
      yield i;
    }
  }

  /**
   * Pretty print a representation of the `Timetable`.
   */
  dump() {
    const rows = this.maxDepth;
    const cols = this.columns.length;

    let out: { [key: string]: { [key: number]: string } } = {};
    for(let rowNo = 0; rowNo < rows; ++rowNo) {
      const depth = rowNo + 1;

      let row: { [key: number]: string } = {};
      for(let colNo = 0; colNo < cols; ++colNo) {
        const col = this.columns[colNo];

        if(col === null) {
          row[colNo] = "spacer";
        } else {
          const cell = col[rowNo];
          row[colNo] = `${cell.padding} id=${cell.uid}`;
        }
      }

      out[`depth: ${depth}`] = row;
    }

    console.table(out);
  }
}
