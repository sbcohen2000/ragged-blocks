import Parsimmon from "parsimmon";
import { LayoutTree, Node, WithStyleRefs, SVGStyle, BorderStyle } from "ragged-blocks";

/**
 * Produce a parser which parses an escape character, then the given
 * parser.
 */
function escapeAnd(s: string): Parsimmon.Parser<string> {
  return Parsimmon
    .seq(Parsimmon.string("\\"), Parsimmon.string(s))
    .map(([_, s]) => s);
}

const pText: Parsimmon.Parser<string> =
      Parsimmon.alt(
        escapeAnd("#"),
        escapeAnd("@"),
        escapeAnd("["),
        escapeAnd("]"),
        Parsimmon.noneOf("\n[]#@")
      ).atLeast(1).map(s => s.join(""));

const pAtom: Parsimmon.Parser<LayoutTree> =
      pText.map(text => ({ type: "Atom", text }))

const pNewline: Parsimmon.Parser<LayoutTree[]> =
      Parsimmon.seq(
        Parsimmon.lf,
        Parsimmon.regexp(/ */)
      ).map(([_, ws]) => {
        if(ws.length === 0) {
          return [{ type: "Newline" }]
        } else {
          return [{ type: "Newline" }, { type: "Spacer", text: ws }]
        }
      });

const pName: Parsimmon.Parser<string> =
      Parsimmon.regexp(/[a-z][a-zA-Z0-9-_]*/);

const pStyleReference: Parsimmon.Parser<string> =
      Parsimmon.seq(
        Parsimmon.string("@"),
        pName
      ).map(([_, nm]) => nm)

const pNode: Parsimmon.Parser<LayoutTree<WithStyleRefs>> = Parsimmon.lazy(function () {
  return Parsimmon
    .seq(
      Parsimmon.string("["),
      pLayoutTree.many(),
      Parsimmon.string("]"),
      pStyleReference.atMost(1)
    ).map(([_l, children, _r, styleRef]) => {
      const node: Node<WithStyleRefs> = {
        type: "Node",
        children: children.flat(),
        padding: 0,
      };
      if(styleRef.length === 1) {
        node.styleRef = styleRef[0];
      }
      return node;
    });
});

const pLayoutTree: Parsimmon.Parser<LayoutTree[]> = Parsimmon.lazy(function () {
  return Parsimmon.alt(
    pNewline,
    pAtom.map((lt) => [lt]),
    pNode.map((lt) => [lt])
  );
});

type Style = Partial<SVGStyle> & { padding?: number };

function pKeyword<A extends string>(s: A): Parsimmon.Parser<A> {
  return Parsimmon.string(s).skip(Parsimmon.optWhitespace);
}

const pNumber: Parsimmon.Parser<number> =
      Parsimmon.seq(
        Parsimmon.string("-").atMost(1),
        Parsimmon.digits,
        Parsimmon.string(".").atMost(1),
        Parsimmon.digits.skip(Parsimmon.optWhitespace),
      ).map(([s, l, dp, r]) => parseFloat(s + l + dp.join("") + r))
        .assert(n => !isNaN(n), "number");

const pRGBAColor: Parsimmon.Parser<string> =
      Parsimmon.seq(
        pKeyword("rgba("),
        pNumber.times(4),
        pKeyword(")")
      ).map(strings => strings.join(""));

const pColor: Parsimmon.Parser<string> =
      Parsimmon.alt(
        Parsimmon.regexp(/#[\da-f]+/i),
        pRGBAColor,
        pName
      ).skip(Parsimmon.optWhitespace);

function pKeyValuePair<A, B>(k: Parsimmon.Parser<A>, v: Parsimmon.Parser<B>): Parsimmon.Parser<[A, B]> {
  return Parsimmon.seq(
    k.skip(pKeyword(":")),
    v.skip(pKeyword(";"))
  );
}

function mkStyle<A extends (keyof Style)>(p: [A, v: Style[A]]): Style {
  const sty: Style = {};
  const [k, v] = p;
  sty[k] = v;
  return sty;
}

/**
 * Merge two sets of `Style`s, effectively taking the union of their
 * properties. If the same property exists in both `dst` and `src`,
 * then the property's value from `src` is preferred. The important
 * consideration here is what to do about border styles. As opposed to
 * other properties, multiple border declarations should be _combined_
 * in `dst`, not overwritten.
 *
 * @param dst The destination `Styles`.
 * @param src The source `Styles`.
 */
function mergeStyles(dst: Style, src: Style) {
  const dstBorders = dst.borders ? [...dst.borders] : [];
  Object.assign(dst, src);
  if(dst.borders) {
    dst.borders.push(...dstBorders);
  }
}

const pSide: Parsimmon.Parser<Partial<BorderStyle>> =
      Parsimmon.alt(
        pKeyword("top")
          .map(_ => ({ borderTop: true })),
        pKeyword("bottom")
          .map(_ => ({ borderBottom: true })),
        pKeyword("left")
          .map(_ => ({ borderLeft: true })),
        pKeyword("right")
          .map(_ => ({ borderRight: true })),
      );

const pSides: Parsimmon.Parser<Partial<BorderStyle>> =
      pSide.many().map(sides => {
        let sty: Partial<BorderStyle> = {};
        for(const side of sides) {
          Object.assign(sty, side);
        }
        return sty;
      });

const pBorderSpecValue: Parsimmon.Parser<Partial<BorderStyle>> =
      Parsimmon.seqMap(
        pNumber.times(1, 3).map(ns => {
          switch(ns.length) {
        // If one numeric argument is applied, treat it as width.
            case 1: return { borderWidth: ns[0]! };
        // If two arguments are applied, treat them as width and radius.
            case 2: return { borderWidth: ns[0]!, borderRadius: ns[1]! };
        // If three arguments are applied, treat them as width, radius, and offset.
            case 3: return { borderWidth: ns[0]!, borderRadius: ns[1]!, borderOffset: ns[2]! };
            default: return {}; // Impossible
          }
        }),
        pColor.atMost(1),
        pSides,
        (sty: Partial<BorderStyle>, color: string[], sides: Partial<BorderStyle>) => {
          if(color.length === 1) {
            sty.borderStroke = color[0];
          }
          // If no sides were specified, then we set all sides on. If
          // one or more sides were specified, we set the others
          // explicitly to false.
          if(sides.borderTop !== undefined
            || sides.borderBottom !== undefined
            || sides.borderLeft !== undefined
            || sides.borderRight !== undefined
          ) {
            sty.borderTop = sides.borderTop ?? false;
            sty.borderBottom = sides.borderBottom ?? false;
            sty.borderLeft = sides.borderLeft ?? false;
            sty.borderRight = sides.borderRight ?? false;
          }
          return sty;
        }
      );

const pBorderSpec: Parsimmon.Parser<Partial<BorderStyle>> =
      pKeyValuePair(pKeyword("border"), pBorderSpecValue).map(([_, v]) => v);

const pStyleAttr: Parsimmon.Parser<Style> =
      Parsimmon.alt(
        pKeyValuePair(pKeyword("padding"), pNumber).map(mkStyle),
        pKeyValuePair(pKeyword("fill"), pColor).map(mkStyle),
        pKeyValuePair(pKeyword("stroke"), pColor).map(mkStyle),
        pBorderSpec.map(v => ({ borders: [v] }))
      )

const pStyles: Parsimmon.Parser<Style> =
      Parsimmon.seq(
        pKeyword("{"),
        pStyleAttr.many(),
        pKeyword("}")
      ).map(([_l, attrs, _r]) => {
        let sty: Style = {};
        for(const attr of attrs) {
          mergeStyles(sty, attr);
        }
        return sty;
      });

const pStyleDefn: Parsimmon.Parser<[string, Style]> =
      Parsimmon.seq(
        pKeyword("@"),
        pName.skip(Parsimmon.optWhitespace),
        pStyles,
      ).map(([_, nm, sty]) => [nm, sty]);

type Example = {
  layoutTrees: LayoutTree<WithStyleRefs>[];
  styleDefs: [string, Style][];
};

const pExample: Parsimmon.Parser<Example> =
      Parsimmon.seq(
        pLayoutTree.many(),
        pStyleDefn.many()
      ).map(([ layoutTrees, styleDefs ]) =>
        ({
          layoutTrees: layoutTrees.flat(),
          styleDefs
        }));

/**
 * Modify `root` so that any style references at each `Node` have been
 * resolved into styles applied at the node.
 *
 * @param root The `LayoutTree` to modify.
 * @param sty The environment of style references.
 */
function resolveStyleReferences(root: LayoutTree<WithStyleRefs>, sty: Map<string, Style>) {
  switch(root.type) {
    case "Newline": break;
    case "Atom": break;
    case "Spacer": break;
    case "Node": {
      if(root.styleRef !== undefined) {
        const styles = sty.get(root.styleRef);
        if(styles) {
          root.padding = styles.padding ?? 0;
          root.sty = styles;
        }
      }

      root.children.forEach(child => resolveStyleReferences(child, sty));
    }
  }
}

/**
 * Parse `text` as an example, returning a `LayoutTree` if the parse
 * was successful, or a `string` if the parse failed. The `string`
 * should be interpreted as a human-readable error message.
 *
 * @param text The text to parse.
 * @returns A `LayoutTree` if the parse was successful, or a `string`
 * error message otherwise.
 */
export default function parseExample(text: string): LayoutTree | string {
  const result = pExample.parse(text);
  if(result.status) {
    const treeWithRefs: LayoutTree<WithStyleRefs> = {
      type: "Node",
      padding: 0,
      children: result.value.layoutTrees
    };
    resolveStyleReferences(treeWithRefs, new Map(result.value.styleDefs));
    return treeWithRefs;
  } else {
    return Parsimmon.formatError(text, result);
  }
}
