/**
 * Given a layout tree from the abstract layout tree interface, we
 * need to convert it to the kind of layout trees specialized for
 * rocks layout. This is done by treating `Newline`s as infix
 * operators and by "re-parsing" the layout tree into a new tree with
 * different constructors.
 */

import assert from "../assert";
import * as alt from "../layout-tree";
import * as rlt from "./layout-tree";

/**
 * Operators in the layout tree token stream.
 */
type Op = "End" | "Newline" | "NextTo";

/**
 * Return the precedence of an operator. Higher numbers have higher
 * precedence (i.e. bind more tightly).
 *
 * @param op The operator whose precedence to return.
 * @returns The precedence represented as an integer.
 */
function opPrecedence(op: Op) {
  switch(op) {
    case "End": return 0;
    case "Newline": return 1;
    case "NextTo": return 2;
  }
}

/**
 * Tokens are either already-processed tree fragments or operators.
 */
type Token<A extends alt.Ann> = {
  type: "E";
  layoutTree: rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>>;
} | {
  type: "Op";
  op: Op;
};

/**
 * Parse a stream of (reversed) tokens into a rocks layout tree.
 *
 * @param tokens The stream of tokens to parse. This function will
 * mutate the list, popping tokens off from the end. The first token
 * is at the end of the list (i.e. the input should be reversed).
 * @returns The parsed layout tree.
 */
function parse<A extends alt.Ann>(tokens: Token<A>[]): rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>> {
  const go = (op1: Op, e1: rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>>, rest: Token<A>[]): rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>> => {
    if(rest.length === 0) {
      return e1;
    }

    assert(rest.length >= 2, "token stream is malformed (Unexpected end)");

    // We have [ op1, e1, op2, e2, ... ]
    const op2 = rest.pop()!;
    assert(op2.type === "Op", "token stream is malformed (expected Op)");

    const e2  = rest.pop()!;
    assert(e2.type === "E", "token stream is malformed (expected E)");

    if(opPrecedence(op1) >= opPrecedence(op2.op)) {
      // Put e2 and op2 back on the stream.
      rest.push(e2);
      rest.push(op2);

      return e1;
    } else {
      const rhs = go(op2.op, e2.layoutTree, rest);

      const e: rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>> = (() => {;
        switch(op2.op) {
          case "NextTo":  return { type: "JoinH", lhs: e1, rhs };
          case "Newline": return { type: "JoinV", lhs: e1, rhs };
          case "End": assert(false);
        }
      })();

      return go(op1, e, rest);
    }
  };

  assert(tokens.length > 0, "The input token list must not be empty.");

  const e0 = tokens.pop()!;
  assert(e0.type === "E", "The input token list must start with an expression.");

  const res = go("End", e0.layoutTree, tokens);
  assert(tokens.length === 0, "Parse failed to consume entire input.");

  return res;
}

/**
 * Convert an abstract layout tree into a rocks layout tree.
 *
 * Note: This algorithm is based on the one found in section 10.6 of
 * the Haskell 2010 report.
 *
 * @param lt The input layout tree.
 * @param empty An empty layout tree.
 * @returns The specialized rocks layout tree.
 */
export default function reassocLayoutTree<A extends alt.Ann>(
  lt: alt.LayoutTree<A>,
  empty: rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>>
): rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>> {
  switch(lt.type) {
  // The following two cases only occur at the top of the call tree
  // (i.e. not as a result of a recursive call).
    case "Atom":
    case "Spacer": return { ...lt };
    case "Newline": assert(false);
    case "Node": {
      const tokens: Token<A>[] = [];

      const putEmpty = () => {
        tokens.push({ type: "E", layoutTree: { ...empty } });
      };

      /**
       * Put a `Newline` token on the stream, taking care to ensure
       * that no two operators are adjacent.
       */
      const putNewline = () => {
        if(tokens.length === 0) {
          putEmpty();
          tokens.push({ type: "Op", op: "Newline" });
        } else {
          const last = tokens[tokens.length - 1];

          if(last.type === "Op") {
            // If the last token on the stream was on op, it must be a
            // newline (since we always append the rhs of a `NextTo`
            // immediately).
            assert(last.op === "Newline");

            // We're pushing another newline, so put an empty atom on
            // the stream first so that we don't end up with two
            // operators next to each other.
            putEmpty();
            tokens.push({ type: "Op", op: "Newline" });
          } else {
            tokens.push({ type: "Op", op: "Newline" });
          }
        }
      };

      /**
       * Put a `LayoutTree` "expression" on the stream, taking care
       * that every expression is separated by a `NextTo` or
       * `Newline` operator.
       */
      const putLayoutTree = (layoutTree: rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>>) => {
        if(tokens.length === 0) {
          tokens.push({ type: "E", layoutTree });
        } else {
          const last = tokens[tokens.length - 1];

          if(last.type === "Op") {
            // If the last token on the stream was on op, it must be a
            // newline (since we always append the rhs of a `NextTo`
            // immediately).
            assert(last.op === "Newline");

            // Since the last item
            // on the stream is an operator, we just put the token
            // on the stream.
            tokens.push({ type: "E", layoutTree });
          } else {
            // Otherwise, put a `NextTo` operator, then the
            // expression.
            tokens.push({ type: "Op", op: "NextTo" });
            tokens.push({ type: "E", layoutTree });
          }
        }
      };

      for(const child of lt.children) {
        switch(child.type) {
          case "Newline": {
            putNewline();
          } break;
          case "Atom":
          case "Spacer": {
            const layoutTree: rlt.LayoutTree<rlt.WithAtomAndSpacerOf<A>> = { ...child };
            putLayoutTree(layoutTree);
          } break;
          case "Node": {
            const layoutTree = reassocLayoutTree(child, empty);
            putLayoutTree(layoutTree);
          } break;
        }
      }

      // Check if the last token is an operator. If so, we need to add
      // an empty term after it.
      if(tokens.length >= 1 && tokens[tokens.length - 1].type === "Op") {
        putEmpty();
      }

      tokens.reverse();
      const out: rlt.LayoutTree = {
        type: "Wrap",
        child: tokens.length > 0 ? parse(tokens) : { ...empty },
        padding: lt.padding,
      };

      // The below song-and-dance is necessary so that if the current
      // `lt` doesn't contain the `sty` property, the output `Wrap`
      // node won't have it either.
      if(lt.sty !== undefined) {
        out.sty = lt.sty;
      }
      return out;
    }
  }
}
