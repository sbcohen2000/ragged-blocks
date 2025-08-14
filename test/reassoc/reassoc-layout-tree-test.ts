import { expect, test } from "@jest/globals";
import * as alt from "../../src/layout-tree";
import * as rlt from "../../src/reassoc/layout-tree";
import reassocLayoutTree from "../../src/reassoc/reassoc-layout-tree";

function aatom(): alt.Atom {
  return { type: "Atom", text: "" };
}

function newline(): alt.Newline {
  return { type: "Newline" };
}

function node(children: alt.LayoutTree[]): alt.Node {
  return { type: "Node", children, padding: 4 };
}

function ratom(): rlt.Atom {
  return { type: "Atom", text: "" };
}

function joinv(lhs: rlt.LayoutTree, rhs: rlt.LayoutTree): rlt.JoinV {
  return { type: "JoinV", lhs, rhs };
}

function joinh(lhs: rlt.LayoutTree, rhs: rlt.LayoutTree): rlt.JoinH {
  return { type: "JoinH", lhs, rhs };
}

function wrap(child: rlt.LayoutTree): rlt.Wrap {
  return { type: "Wrap", child, padding: 4 };
}

const empty: rlt.LayoutTree = ratom();

test("Can reassoc a single Atom", () => {
  const t: alt.LayoutTree = aatom();
  expect(reassocLayoutTree(t, empty)).toStrictEqual(ratom());
});

test("Can reassoc a list of Atoms", () => {
  const t: alt.LayoutTree = node([
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
  const t: alt.LayoutTree = node([
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
  const t: alt.LayoutTree = node([
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
  const t: alt.LayoutTree = node([
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
  const t: alt.LayoutTree = node([
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
  const t: alt.LayoutTree = node([
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
