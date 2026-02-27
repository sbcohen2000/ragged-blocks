import { expect, test } from "@jest/globals";
import * as alt from "../../src/layout-tree";
import * as rlt from "../../src/reassoc/layout-tree";
import reassocLayoutTree from "../../src/reassoc/reassoc-layout-tree";

function aatom(): alt.Atom<void> {
  return { type: "Atom", text: "", isSpacer: false };
}

function newline(): alt.Newline {
  return { type: "Newline" };
}

function node(children: alt.LayoutTree<void>[]): alt.Node<void> {
  return { type: "Node", children, padding: 4 };
}

function ratom(): rlt.Atom<void> {
  return { type: "Atom", text: "", isSpacer: false };
}

function joinv(lhs: rlt.LayoutTree<void>, rhs: rlt.LayoutTree<void>): rlt.JoinV<void> {
  return { type: "JoinV", lhs, rhs };
}

function joinh(lhs: rlt.LayoutTree<void>, rhs: rlt.LayoutTree<void>): rlt.JoinH<void> {
  return { type: "JoinH", lhs, rhs };
}

function wrap(child: rlt.LayoutTree<void>): rlt.Wrap<void> {
  return { type: "Wrap", child, padding: 4 };
}

const empty: rlt.LayoutTree<void> = ratom();

test("Can reassoc a single Atom", () => {
  const t: alt.LayoutTree<void> = aatom();
  expect(reassocLayoutTree(t, empty)).toStrictEqual(ratom());
});

test("Can reassoc a list of Atoms", () => {
  const t: alt.LayoutTree<void> = node([
    aatom(),
    aatom(),
    aatom(),
  ]);

  expect(reassocLayoutTree(t, empty)).toStrictEqual(
    wrap(
      joinh(joinh(ratom(), ratom()), ratom())
    )
  );
});

test("Can reassoc a list of Atoms separated by a Newline", () => {
  const t: alt.LayoutTree<void> = node([
    aatom(),
    aatom(),
    newline(),
    aatom(),
  ]);

  expect(reassocLayoutTree(t, empty)).toStrictEqual(
    wrap(
      joinv(
        joinh(ratom(), ratom()),
        ratom()
      )
    )
  );
});

test("Can reassoc a list of Atoms separated by a Newlines", () => {
  const t: alt.LayoutTree<void> = node([
    aatom(),
    aatom(),
    newline(),
    aatom(),
    newline(),
    aatom(),
    aatom(),
    aatom()
  ]);

  expect(reassocLayoutTree(t, empty)).toStrictEqual(
    wrap(
      joinv(
        joinv(
          joinh(ratom(), ratom()),
          ratom(),
        ),
        joinh(joinh(ratom(), ratom()), ratom())
      )
    )
  );
});

test("Can reassoc two Newlines in a row", () => {
  const t: alt.LayoutTree<void> = node([
    aatom(),
    newline(),
    newline(),
    aatom()
  ]);

  expect(reassocLayoutTree(t, empty)).toStrictEqual(
    wrap(
      joinv(
        joinv(
          ratom(),
          ratom(),
        ),
        ratom(),
      )
    )
  );
});

test("Can reassoc a tree beginning with a Newline", () => {
  const t: alt.LayoutTree<void> = node([
    newline(),
    newline(),
    aatom()
  ]);

  expect(reassocLayoutTree(t, empty)).toStrictEqual(
    wrap(
      joinv(
        joinv(
          ratom(),
          ratom(),
        ),
        ratom(),
      )
    )
  );
});

test("Can reassoc trailing Newlines", () => {
  const t: alt.LayoutTree<void> = node([
    newline(),
    newline(),
    newline()
  ]);

  expect(reassocLayoutTree(t, empty)).toStrictEqual(
    wrap(
      joinv(
        joinv(
          joinv(
            ratom(),
            ratom(),
          ),
          ratom()
        ),
        ratom()
      )
    )
  );
});
