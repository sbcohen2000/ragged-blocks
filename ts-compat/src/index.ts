import * as rb from "ragged-blocks";
import Parser from "tree-sitter";
import { Point } from "tree-sitter";

/**
 * Produce a string with `n` spaces.
 *
 * @param n The number of spaces in the string.
 * @returns A string of length `n` where every character is a space.
 */
function nSpaces(n: number, c: string): string {
  let out = "";
  for(; n > 0; --n) {
    out += c;
  }
  return out;
}

export type ParseSettings = {
  /**
   * Should we emit spacers?
   */
  useSpacers: boolean,
  /**
   * If we find an atom which spans multiple lines, should we break it
   * into multiple atoms, separated by newlines and spacers?
   */
  breakMultiLineAtoms: boolean,
};

const DEFAULT_PARSE_SETTINGS: ParseSettings = {
  useSpacers: true,
  breakMultiLineAtoms: true
}

/**
 * Produce a `LayoutTree` by parsing the file at `path` using the
 * parser for `language`.
 *
 * @param src The source of the file to read.
 * @param language The language to parse the source file with.
 * @param settings The parse settings.
 * @returns A new `LayoutTree`.
 */
export function parse(src: string, language: any, settings: Partial<ParseSettings>): rb.LayoutTree<rb.WithText> {
  const theSettings: ParseSettings = { ...DEFAULT_PARSE_SETTINGS, ...settings };

  const parser = new Parser();
  parser.setLanguage(language);

  // Here, we set a larger buffer size since tree sitter throws an
  // error otherwise when we try to parse large files.
  const ast = parser.parse(src, undefined, {
    bufferSize: 1024 * 1024
  });

  let cursor = ast.walk();
  let lastPosition: Point = cursor.startPosition;

  const emitWhitespace = (begin: Point, end: Point): rb.LayoutTree<rb.WithText>[] => {
    if(begin.row === end.row) {
      if(begin.column < end.column) {
        return [{ type: "Atom", text: nSpaces(end.column - begin.column, " ") }];
      } else {
        return [];
      }
    } else {
      const nLines = end.row - begin.row;
      let out: rb.LayoutTree<rb.WithText>[] = [];
      for(let i = 0; i < nLines; ++i) {
        out.push({ type: "Newline" });
      }
      if(end.column > 0 && theSettings.useSpacers) {
        out.push({ type: "Spacer", text: nSpaces(end.column, "_") });
      }
      return out;
    }
  };

  const pushLine = (text: string, out: rb.LayoutTree<rb.WithText>[]) => {
    let i = 0;
    for(; i < text.length; ++i) {
      if(text[i] !== " ") {
        break;
      }
    }

    let ws = text.slice(0, i);
    if(ws && theSettings.useSpacers) {
      out.push({
        type: "Spacer",
        text: ws
      });
    }

    if(i < text.length) {
      out.push({
        type: "Atom",
        text: text.slice(i)
      });
    }
  };

  const pushMultilineText = (text: string): rb.LayoutTree<rb.WithText>[] => {
    let out: rb.LayoutTree<rb.WithText>[] = [];
    const lines = text.split("\n");
    for(let i = 0; i < lines.length - 1; ++i) {
      pushLine(lines[i], out);
      out.push({ type: "Newline" });
    }
    pushLine(lines[lines.length - 1], out);
    return out;
  }

  const go = (): rb.LayoutTree<rb.WithText>[] => {
    const nodes = emitWhitespace(lastPosition, cursor.startPosition);
    lastPosition = cursor.startPosition;

    let children: rb.LayoutTree<rb.WithText>[] = [];
    if(cursor.gotoFirstChild()) {
      do {
        children.push(...go());
      } while(cursor.gotoNextSibling());
      lastPosition = cursor.endPosition;

      cursor.gotoParent();

      nodes.push({
        type: "Node",
        children,
        padding: 4
      })
      return nodes;
    } else {
      if(theSettings.breakMultiLineAtoms) {
        nodes.push(...pushMultilineText(cursor.nodeText));
      } else {
        nodes.push({
          type: "Atom",
          text: cursor.nodeText
        });
      }
      lastPosition = cursor.endPosition;
      return nodes;
    }
  }

  const [res] = go();
  return res;
}

/**
 * Pretty print a layoutTree. This can be used to verify that the
 * parsing process doesn't loose any formatting information.
 */
export function stringifyLayoutTree(layoutTree: rb.LayoutTree<rb.WithText>): string {
  switch(layoutTree.type) {
    case "Newline": return "\n";
    case "Atom": return layoutTree.text;
    case "Spacer": return layoutTree.text;
    case "Node": {
      const strings = layoutTree.children.map(stringifyLayoutTree);
      return strings.join("");
    }
  }
}

