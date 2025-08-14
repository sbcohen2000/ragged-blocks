import assert from "../assert";
import { IntervalTree } from "@sbcohen/containers";
import {
  FragmentsInfo,
  FragmentInfo,
  Layout,
  LayoutTree,
  WithMeasurements,
  WithOutlines,
  Ann,
  eachAtom
} from "../layout-tree";
import { Polygon, PolygonRendering } from "../polygon";
import { Rect, clone, width, height, translate } from "../rect";
import { Svg, Render, SVGStyle } from "../render";
import { ViewSettings, SettingView } from "../settings";

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
 * Find the length of a range; the number of elements it covers.
 *
 * @param range The range whose length to calculate.
 * @returns the length of `range`.
 */
function rangeLength(range: Range): number {
  return range.end - range.begin;
}

/**
 * An inclusive range of decimal numbers (i.e. not a range of
 * indices, which would be the purview of `Range`).
 */
type Extent = [number, number];

/**
 * Test if two extents overlap.
 *
 * @param a The first extent.
 * @param b The second extent.
 * @returns `true` if `Extent` `a` overlaps `Extent` `b`.
 */
function extentsOverlap(a: Extent, b: Extent): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/**
 * An annotation which keeps track of the index and line number of
 * each leaf, and for each node, the range of indices and line numbers
 * below it.
 */
type WithFragmentRanges<A = {}> = {
  Atom:    { index: number, line: number };
  Spacer:  { index: number, line: number };
  Newline: object;
  Node:    { fragmentRange: Range, lineRange: Range, uid: number };
} & A;

type HGadget = {
  type: "BeginOfLine" | "EndOfLine" | "BeginOfNode" | "EndOfNode";
  uid: number;
  width: number;
};

type FragmentContent = { type: "Atom", rect: Rect } | { type: "Spacer", width: number };

type Fragment = {
  /**
   * The gadgets that come before the fragment. (In natural order,
   * i.e. elements at the _end_ of the list are the further _in_).
   */
  gadgetsBefore: HGadget[];
  content: FragmentContent;
  /**
   * The gadgets that come after the fragment. (In natural order,
   * i.e. elements at the _end_ of the list are further _out_).
   */
  gadgetsAfter: HGadget[];
  /**
   * The line number of the fragment.
   */
  line: number;
};

/**
 * Check if a list of `HGadget`s has a gadget with `uid`.
 *
 * @param uid The uid to check.
 * @param gadgets The list of gadgets to search.
 * @returns `true` if `gadgets` has a gadget with `uid`, and `false`
 * otherwise.
 */
function hasHGadgetWithUID(uid: number, gadgets: HGadget[]): boolean {
  return gadgets.some(gadget => gadget.uid === uid);
}

type FragmentVector = Fragment[];

type LayoutGuts<A extends Ann> = {
  layoutTree: LayoutTree<A>,
  fragmentVector: FragmentVector,
  lineToFragmentRange: Range[],
};

/**
 * Build a fragment vector, along with associated lookup tables needed
 * for width resolution.
 *
 * @param layoutTree The input layout tree.
 * @returns A `LayoutGuts` object which contains a `LayoutTree`
 * annotated with fragment and line ranges, a fragment vector which
 * has been annotated with H-Gadgets, and a mapping from line numbers
 * to fragment ranges.
 */
function buildFragmentVector(layoutTree: LayoutTree<WithMeasurements>): LayoutGuts<WithMeasurements<WithFragmentRanges>> {
  /**
   * Produce a unique ID.
   */
  const nextUid = (() => {
    let _nextUid = 0;
    return () => {
      return _nextUid++;
    };
  })();

  /**
   * The current line number.
   */
  let line = 0;

  const fragmentVector: FragmentVector = [];

  /**
   * A mapping from line number to fragment range (the range of
   * fragments on the line).
   */
  const lineToFragmentRange: Range[] = [{ begin: 0, end: 0 }];

  /**
   * Insert an H-Gadget at the beginning of the fragment at
   * `index`. If the target fragment already has an h-gadget with the
   * same UID, then this function is a noop.
   *
   * @param index The index of the fragment at which to insert the
   * H-Gadget.
   */
  const insertBeginHGadget = (index: number, gadget: HGadget) => {
    const fragment = fragmentVector[index];
    assert(fragment !== undefined);

    if(!hasHGadgetWithUID(gadget.uid, fragment.gadgetsBefore)) {
      fragment.gadgetsBefore.unshift(gadget);
    }
  };

  /**
   * Insert an H-Gadget at the end of the fragment at `index`. If the
   * target fragment already has an h-gadget with the same UID, then
   * this function is a noop.
   *
   * @param index The index of the fragment at which to insert the
   * H-Gadget.
   */
  const insertEndHGadget = (index: number, gadget: HGadget) => {
    const fragment = fragmentVector[index];
    assert(fragment !== undefined);

    if(!hasHGadgetWithUID(gadget.uid, fragment.gadgetsAfter)) {
      fragment.gadgetsAfter.push(gadget);
    }
  };

  const go = (root: LayoutTree<WithMeasurements>): LayoutTree<WithMeasurements<WithFragmentRanges>> => {
    switch(root.type) {
      case "Newline": {
        lineToFragmentRange[lineToFragmentRange.length - 1].end = fragmentVector.length;
        lineToFragmentRange.push({
          begin: fragmentVector.length,
          end: fragmentVector.length // Note the +1 due to the below Spacer.
        });
        line++;
        return root;
      }
      case "Atom": {
        const index = fragmentVector.length;
        fragmentVector.push({
          gadgetsBefore: [],
          content: { type: "Atom", rect: clone(root.rect) },
          gadgetsAfter: [],
          line,
        });
        return { ...root, index, line };
      }
      case "Spacer": {
        const index = fragmentVector.length;
        fragmentVector.push({
          gadgetsBefore: [],
          content: { type: "Spacer", width: root.width },
          gadgetsAfter: [],
          line,
        });
        return { ...root, index, line };
      }
      case "Node": {
        const uid = nextUid();
        const beginLine = line;
        const beginIndex = fragmentVector.length;

        const children = root.children.map(go);

        const endLine = line + 1; // (exclusive)
        const endIndex = fragmentVector.length;

        // Insert newline-induced H-Gadgets

        /**
         * Remember an H-Gadget which needs to be inserted at the
         * beginning of the line.
         */
        let insertAtBeginning: HGadget | null = null;

        for(let i = beginIndex; i < endIndex; ++i) {
          const thisFragment = fragmentVector[i];
          const nextFragment = fragmentVector[i + 1];

          let isLastFragmentOnLine = nextFragment === undefined
            || thisFragment.line !== nextFragment.line;

          if(insertAtBeginning !== null
            && (thisFragment.content.type === "Atom" || isLastFragmentOnLine)) {

            insertBeginHGadget(i, insertAtBeginning);
            insertAtBeginning = null;
          }

          if(isLastFragmentOnLine) {
            // Then, we should insert an H-Gadget after
            // `thisFragment`, and remember to insert a corresponding
            // H-Gadget at the beginning of the line (skipping any
            // spacers).
            insertEndHGadget(i, {
              type: "EndOfLine",
              width: root.padding,
              uid
            });
            insertAtBeginning = {
              type: "BeginOfLine",
              width: root.padding,
              uid
            };
          }
        }

        // Insert begin/end H-Gadgets
        if(beginIndex !== endIndex) {
          insertBeginHGadget(beginIndex, {
            type: "BeginOfNode",
            width: root.padding,
            uid
          });

          insertEndHGadget(endIndex - 1, {
            type: "EndOfNode",
            width: root.padding,
            uid
          });
        }

        return {
          ...root,
          children,
          fragmentRange: { begin: beginIndex, end: endIndex },
          lineRange: { begin: beginLine, end: endLine },
          uid
        }
      }
    }
  }

  const withRanges = go(layoutTree);

  // Update the last line in `lineToFragmentRange` to point to the
  // last fragment.
  lineToFragmentRange[lineToFragmentRange.length - 1].end = fragmentVector.length;

  return {
    layoutTree: withRanges,
    fragmentVector,
    lineToFragmentRange
  }
}

type HorzLineDrawCommand = {
  type: "HorzLine";
  /**
   * The relevant `line` number.
   */
  lineNo: number;
  /**
   * Should this horizontal line be drawn above or below `line`.
   */
  side: "Above" | "Below";
  /**
   * The extent of x-coordiantes of this horizontal line.
   */
  extent: Extent;
  /**
   * If `false`, then should draw `extent[0]` before
   * `extent[1]`. Otherwise, should draw `extent[1]` before
   * `extent[0]`.
   */
  reversed: boolean;
  /**
   * If `side` is `"Above"`, then this is the vertical offset from the
   * _top_ of `line` to draw this horizontal line. If `side` is
   * `"Below"`, then it is the vertical offset from the _bottom_ of
   * `line`.
   */
  offset: number;
};

type CloseDrawCommand = {
  type: "Close";
}

function closeCommand(): CloseDrawCommand {
  return { type: "Close" };
}

type NopDrawCommand = {
  type: "Nop";
}

function nopCommand(): NopDrawCommand {
  return { type: "Nop" };
}

type DrawCommand = HorzLineDrawCommand | CloseDrawCommand | NopDrawCommand;

type WithDrawCommands<A = {}> = {
  Atom:    object;
  Spacer:  object;
  Newline: object;
  Node:    { drawCommands: DrawCommand[] };
} & A;

type VGadget = {
  /**
   * The distance from the top (bottom) of the line to the top
   * (bottom) of this gadget.
   */
  offset: number;
};

type Leading = {
  maximumAboveLineOffset: number;
  aboveLine: IntervalTree<VGadget>;
  maximumBelowLineOffset: number;
  belowLine: IntervalTree<VGadget>;
}[];

/**
 * Yield each object (i.e. a gadget or fragment) on a line, in order.
 *
 * @param line The line over which to yield objects.
 * @param guts The layout guts.
 * @returns An iterator to the objects on `line`.
 */
function* eachObjectOnLine(line: number, guts: LayoutGuts<WithFragmentRanges>): IterableIterator<FragmentContent | HGadget> {
  const range = guts.lineToFragmentRange[line];
  for(let i = range.begin; i < range.end; ++i) {
    const fragment = guts.fragmentVector[i];

    // Yield the `gadgetsBefore` in normal order.
    for(const hgadget of fragment.gadgetsBefore) {
      yield hgadget;
    }

    // Then yield the fragment's own content.
    yield fragment.content;

    // Then, yield the `gadgetsAfter` in normal order.
    for(const hgadget of fragment.gadgetsAfter) {
      yield hgadget;
    }
  }
}

/**
 * Find the horizontal extent that the S-Block with `uid` covers on
 * `line`. Returns `null` if the S-Block with `uid` doesn't cover any
 * range on `line`.
 *
 * @param line The line (number) to search.
 * @param uid The UID of the S-Block (or "Node") to look for on
 * `line`.
 * @param guts The layout guts.
 * @returns A `Range` object describing the S-Block's horizontal
 * extent on `line`, or `null` if the S-Block isn't on `line`.
 */
function extentOnLine(line: number, uid: number, guts: LayoutGuts<WithFragmentRanges>): Extent | null {
  type State = { state: "LookingForBegin" } | { state: "FoundBegin"; extent: Extent };
  let state: State = { state: "LookingForBegin" };
  let x = 0;

  for(const obj of eachObjectOnLine(line, guts)) {
    if(state.state === "LookingForBegin") {
      // Check if we've seen the first object under UID on this line.
      if((obj.type === "BeginOfLine" || obj.type === "BeginOfNode") && obj.uid === uid) {
        state = {
          state: "FoundBegin",
          extent: [x, x]
        }
      }
    }

    // Increment `x` according to the kind of object we have.
    switch(obj.type) {
      case "Atom":
        x += width(obj.rect);
        break;
      default:
        x += obj.width;
        break;
    }

    if(state.state === "FoundBegin") {
      state.extent[1] = x;

      // Check if we've seen the last object under UID on this line.
      if((obj.type === "EndOfLine" || obj.type === "EndOfNode") && obj.uid === uid) {
        break;
      }
    }
  }

  if(state.state === "LookingForBegin") {
    return null;
  } else {
    return state.extent;
  }
}

/**
 * @see `extentOnLine`.
 *
 * This function repeatedly calls `extentOnLine`, finding the largest
 * range of lines where the S-Block with `uid` between `minLine` and
 * `maxLine` is present on all of the lines between `minLine` and
 * `maxLine` (inclusive).
 *
 * @param minLine The minimum line number (inclusive).
 * @param maxLine The maximum line number (inclusive).
 * @param uid The UID of the S-Block (or "Node") to look for.
 * @param guts The layout guts.
 * @returns A quadruple consisting of the minimum line of the S-Block,
 * the extent on this line, the maximum line of the S-Block, and the
 * extent on that line. Returns `null` if the S-Block couldn't be
 * found anywhere between `minLine` and `maxLine`.
 */
function extentBetweenLines(minLine: number, maxLine: number, uid: number, guts: LayoutGuts<WithFragmentRanges>): [number, Extent, number, Extent] | null {
  while(minLine <= maxLine) {
    const upperExtent = extentOnLine(minLine, uid, guts);
    const lowerExtent = extentOnLine(maxLine, uid, guts);

    if(upperExtent === null && lowerExtent === null) {
      minLine++;
      maxLine--;
    } else if(upperExtent === null) {
      minLine++;
    } else if(lowerExtent === null) {
      maxLine--;
    } else {
      return [minLine, upperExtent, maxLine, lowerExtent];
    }
  }

  return null;
}

/**
 * Construct and add a new VGadget above `line` with `extent`. This
 * function mutates `leading`, and returns a draw command which can be
 * used to draw the corresponding horizontal segment of the S-Block.
 *
 * @param padding The amount of padding this V-Gadget needs to represent.
 * @param lineNo The line number above which to put this V-Gadget.
 * @param extent The horizontal extent of the V-Gadget.
 * @param side A flag specifying if the V-Gadget should be placed
 * above or below `line`.
 * @param reversed Should the line be reversed?
 * @param leading The leading array to mutate.
 * @returns A DrawCommand that can be resolved to a line once we know
 * the absolute height of each line and leading.
 */
function addVGadget(padding: number, lineNo: number, extent: Extent, side: "Above" | "Below", reversed: boolean, leading: Leading): DrawCommand {
  if(extent[0] === extent[1]) {
    return nopCommand();
  }

  const line = leading[lineNo];

  // Find the maximum height of the leading at `line`.
  let offset = 0;
  let itree: IntervalTree<VGadget> =
      side === "Above"
        ? line.aboveLine
        : line.belowLine;
  for(const isection of itree.search(extent)) {
    offset = Math.max(isection.offset, offset);
  }

  const vGadget: VGadget = {
    offset: offset + padding,
  };

  // Update the `maximumAboveLineOffset` or `maximumBelowLineOffset`.
  if(side === "Above") {
    line.maximumAboveLineOffset = Math.max(line.maximumAboveLineOffset, offset + padding);
  } else {
    line.maximumBelowLineOffset = Math.max(line.maximumBelowLineOffset, offset + padding);
  }

  // Add the interval for this VGadget to the relevant interval tree.
  itree.set(extent, vGadget);

  // Finally, construct a DrawCommand corresponding to the added
  // VGadget.
  return {
    type: "HorzLine",
    lineNo,
    side,
    extent,
    reversed,
    offset: offset + padding
  }
}

type LayoutGutsWithLeading<A extends Ann> = LayoutGuts<A> & { leading: Leading };

/**
 * Resolve the absolute width and horizontal position of each object
 * in the layout. The function returns `LayoutGuts` which have been
 * annotated with a `LayoutTree` which has attached
 * `DrawCommand`s. These `DrawCommands` are still relative to the
 * absolute vertical position of the lines, which is not yet known.
 *
 * @param layoutGuts The layout guts, annotated with fragment ranges.
 * @returns A new `LayoutGuts`, additionally annotated with
 * `DrawCommands`.
 */
function resolveWidths<A>(layoutGuts: LayoutGuts<WithFragmentRanges<A>>): LayoutGutsWithLeading<WithFragmentRanges<WithDrawCommands<A>>> {
  /**
   * An array, one element per line. Each line has two interval trees;
   * a tree for the VGadgets above the line, and a tree for the
   * VGadgets below.
   */
  const leading: Leading =
        layoutGuts.lineToFragmentRange.map(_ => ({
          maximumAboveLineOffset: 0,
          aboveLine: new IntervalTree(),
          maximumBelowLineOffset: 0,
          belowLine: new IntervalTree()
        }));

  const go = (root: LayoutTree<WithFragmentRanges<A>>): LayoutTree<WithFragmentRanges<WithDrawCommands<A>>> => {
    switch(root.type) {
      case "Newline": return root;
      case "Atom": return root;
      case "Spacer": return root;
      case "Node": {
        const children = root.children.map(go);

        if(rangeLength(root.lineRange) === 0) {
          return {
            ...root,
            children,
            drawCommands: []
          }
        }

        if(rangeLength(root.lineRange) === 1) {
          // This S-Block has a single line.
          //   ___________
          //  |___________|
          //
          //  |<--------->|
          // firstLineExtent
          //

          const line = root.lineRange.begin;

          // Find the S-Block's horizontal extent.
          const extent = extentOnLine(line, root.uid, layoutGuts);
          if(extent === null) {
            return {
              ...root,
              children,
              drawCommands: []
            }
          }

          // Generate draw commands.
          const topLine = addVGadget(root.padding, line, extent, "Above", true, leading);
          const bottomLine = addVGadget(root.padding, line, extent, "Below", false, leading);

          return {
            ...root,
            children,
            drawCommands: [topLine, bottomLine, closeCommand()]
          }
        }

        const minLine = root.lineRange.begin;
        const maxLine = root.lineRange.end - 1;

        const res = extentBetweenLines(minLine, maxLine, root.uid, layoutGuts);
        if(res === null) {
          return {
            ...root,
            children,
            drawCommands: []
          }
        }

        let [firstLine, firstLineExtent, lastLine, lastLineExtent] = res;

        if(rangeLength(root.lineRange) === 2 && !extentsOverlap(firstLineExtent, lastLineExtent)) {
          // This S-Block has two non-overlapping lines.
          // |<->| firstLineExtent
          //  ___
          // |___|  ______
          //       |______|
          //
          //       |<---->| lastLineExtent
          //

          // Generate draw commands.
          const topRight = addVGadget(root.padding, firstLine, firstLineExtent, "Above", true, leading);
          const bottomRight = addVGadget(root.padding, firstLine, firstLineExtent, "Below", false, leading);
          const topLeft = addVGadget(root.padding, lastLine, lastLineExtent, "Above", true, leading);
          const bottomLeft = addVGadget(root.padding, lastLine, lastLineExtent, "Below", false, leading);

          return {
            ...root,
            children,
            drawCommands: [
              topRight,
              bottomRight,
              closeCommand(),
              topLeft,
              bottomLeft,
              closeCommand(),
            ]
          }
        }

        // This is a general case S-Block.
        //        |<--->| firstLineExtent
        //         _____
        //  ______|     |
        // |            .
        // .            .
        // .            .
        // .     _______|
        // |____|
        //
        // |<-->| lastLineExtent
        //

        // We need to search through every interior line of the
        // S-Block in order to find the minimum and maximum extents.
        let bounds: Extent = [
          Math.min(firstLineExtent[0], lastLineExtent[0]),
          Math.max(firstLineExtent[1], lastLineExtent[1])
        ];
        for(let line = root.lineRange.begin + 1; line < root.lineRange.end - 1; ++line) {
          const e = extentOnLine(line, root.uid, layoutGuts);
          if(e !== null) {
            bounds[0] = Math.min(bounds[0], e[0]);
            bounds[1] = Math.max(bounds[1], e[1]);
          }
        }

        // Adjust the first and last line extents to the bounds we
        // calculated in the last step.
        firstLineExtent = [firstLineExtent[0], bounds[1]];
        lastLineExtent = [bounds[0], lastLineExtent[1]];

        // From the bounds and the positions of the `firstLineExtent`
        // and `lastLineExtent`, we can calculate the extents of the
        // second and second from last lines.
        const secondLine = firstLine + 1;
        const secondLineExtent: Extent = [bounds[0], firstLineExtent[0]];
        const secondToLastLine = lastLine - 1;
        const secondToLastLineExtent: Extent = [lastLineExtent[1], bounds[1]];

        // Generate draw commands.
        const topRight = addVGadget(root.padding, firstLine, firstLineExtent, "Above", true, leading);
        const topLeft = addVGadget(root.padding, secondLine, secondLineExtent, "Above", true, leading);

        const bottomLeft = addVGadget(root.padding, lastLine, lastLineExtent, "Below", false, leading);
        const bottomRight = addVGadget(root.padding, secondToLastLine, secondToLastLineExtent, "Below", false, leading);

        return {
          ...root,
          children,
          drawCommands: [
            topRight,
            topLeft,
            bottomLeft,
            bottomRight,
            closeCommand(),
          ]
        };
      };
    }
  };

  const withSBlockClasses = go(layoutGuts.layoutTree);
  return {
    ...layoutGuts,
    layoutTree: withSBlockClasses,
    leading
  }
}

type LineMetrics = {
  /**
   * The absolute position of the top of the line (excluding leading).
   */
  yTop: number;
  /**
   * The absolute position of the bottom of the line (excluding
   * leading).
   */
  yBottom: number;
};

function resolveHeights(layoutGuts: LayoutGutsWithLeading<WithMeasurements<WithFragmentRanges<WithDrawCommands>>>, idealLeading: number): LayoutTree<WithMeasurements<WithFragmentRanges<WithOutlines>>> {
  let y = 0;
  /**
   * An array holding the `LineMetrics` of each line. There is one
   * element for every line in the layout.
   */
  const lineMetrics: LineMetrics[] = [];
  for(let lineNo = 0; lineNo < layoutGuts.leading.length; ++lineNo) {
    const line = layoutGuts.leading[lineNo];
    y += line.maximumAboveLineOffset;

    // Find the height of the line by measuring each atom on the
    // line. We can simultaneously find the x-position of each
    // rectangle on the line as well.
    let lineHeight = idealLeading;
    let x = 0;
    for(const obj of eachObjectOnLine(lineNo, layoutGuts)) {
      if(obj.type === "Atom") {
        lineHeight = Math.max(lineHeight, height(obj.rect));
        obj.rect = translate(obj.rect, { dx: x, dy: y - obj.rect.top });
        x += width(obj.rect);
      } else {
        x += obj.width;
      }
    }

    lineMetrics.push({
      yTop: y,
      yBottom: y + lineHeight,
    });
    y += lineHeight + line.maximumBelowLineOffset;
  }

  /**
   * Update `polygon` according to `cmd`.
   *
   * @param polygon The "in progress" polygon under construction.
   * @param cmd The current draw command.
   */
  const interpretDrawCommand = (polygon: Polygon, cmd: DrawCommand) => {
    switch(cmd.type) {
      case "HorzLine": {
        const y = cmd.side === "Above"
          ? lineMetrics[cmd.lineNo].yTop - cmd.offset
          : lineMetrics[cmd.lineNo].yBottom + cmd.offset;
        const [xFrom, xTo] = cmd.reversed ? [cmd.extent[1], cmd.extent[0]] : cmd.extent;

        if(polygon.length === 0) {
          polygon.push([]);
        }

        const curPath = polygon[polygon.length - 1];
        curPath.push({ x: xFrom, y }, { x: xTo, y });
      } break;
      case "Close": {
        polygon.push([]);
      } break;
      case "Nop": break;
    }
  };

  /**
   * @see interpretDrawCommand
   *
   * Produce a new `Polygon` from a list of `DrawCommand`s.
   *
   * @param cmds The list of `DrawCommand`s to interpret.
   * @returns A new `Polygon`.
   */
  const interpretDrawCommands = (cmds: DrawCommand[]): Polygon => {
    const polygon: Polygon = [];
    for(const cmd of cmds) {
      interpretDrawCommand(polygon, cmd);
    }
    return polygon;
  };

  // And now that the height of each line is known, we have all of the
  // necessary information to place each fragment and calculate the
  // absolute postion of its outline. So, we do a final tree traversal
  // to position each fragment and attach outlines to each `Node`.

  y = 0;
  const go = (root: LayoutTree<WithMeasurements<WithFragmentRanges<WithDrawCommands>>>): LayoutTree<WithMeasurements<WithFragmentRanges<WithOutlines>>> => {
    switch(root.type) {
      case "Newline": return root;
      case "Atom": {
        const frag = layoutGuts.fragmentVector[root.index].content;
        assert(frag.type === "Atom");
        return {
          ...root,
          rect: frag.rect
        };
      }
      case "Spacer": return root;
      case "Node": {
        const children = root.children.map(go);
        const outline = interpretDrawCommands(root.drawCommands);
        return {
          ...root,
          children,
          outline
        }
      }
    }
  }

  return go(layoutGuts.layoutTree);
}

class SBlocksLayoutResult extends Render implements FragmentsInfo {
  private layoutTree: LayoutTree<WithMeasurements<WithFragmentRanges<WithOutlines>>>;

  constructor(layoutTree: LayoutTree<WithMeasurements<WithFragmentRanges<WithOutlines>>>) {
    super();
    this.layoutTree = layoutTree;
  }

  render(svg: Svg, sty: SVGStyle): void {
    const go = (root: LayoutTree<WithMeasurements<WithOutlines>>) => {
      switch(root.type) {
        case "Newline": break;
        case "Atom": {
          if(sty.debugFragmentBoundingBoxes) {
            const r = root.rect;
            svg
              .rect(width(r), height(r))
              .fill("white")
              .stroke("black")
              .move(r.left, r.top);
          }
        } break;
        case "Spacer": break;
        case "Node": {
          const r = new PolygonRendering(root.outline).withStyles({
            fill: "none",
            ...root.sty
          });
          r.render(svg, sty);

          // Recurse on our children.
          for(const child of root.children) {
            go(child);
          }
        } break;
      }
    };
    go(this.layoutTree);
  }

  boundingBox(): Rect | null {
    switch(this.layoutTree.type) {
      case "Newline": return null;
      case "Atom": return clone(this.layoutTree.rect);
      case "Spacer": return null;
      case "Node": return new PolygonRendering(this.layoutTree.outline).boundingBox();
    }
  }

  fragmentsInfo(): FragmentInfo[] {
    let out: FragmentInfo[] = [];
    for(const atom of eachAtom(this.layoutTree)) {
      out.push({
        rect: atom.rect,
        lineNo: atom.line,
        text: atom.text
      });
    }
    return out;
  }
}

export class SBlocksLayoutSettings implements ViewSettings {
  public idealLeading: number;

  constructor(idealLeading: number) {
    this.idealLeading = idealLeading;
  }

  viewSettings(): SettingView[] {
    return []
  }

  clone() {
    return new SBlocksLayoutSettings(this.idealLeading);
  }
}

export default class SBlocksLayout implements Layout {
  private settings: SBlocksLayoutSettings;

  constructor(settings: SBlocksLayoutSettings) {
    this.settings = settings;
  }

  layout(layoutTree: LayoutTree<WithMeasurements>): SBlocksLayoutResult {
    const guts = buildFragmentVector(layoutTree);
    const gutsWLeading = resolveWidths(guts);
    const withOutlines = resolveHeights(gutsWLeading, this.settings.idealLeading);
    return new SBlocksLayoutResult(withOutlines);
  }
}
