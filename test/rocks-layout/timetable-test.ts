import { expect, test } from "@jest/globals";
import { LayoutTree, JoinV, JoinH, Wrap, Atom, Spacer } from "../../src/reassoc/layout-tree";
import { Timetable } from "../../src/rocks-layout/timetable";

function joinv(lhs: LayoutTree, rhs: LayoutTree): JoinV {
  return { type: "JoinV", lhs, rhs };
}

function joinh(lhs: LayoutTree, rhs: LayoutTree): JoinH {
  return { type: "JoinH", lhs, rhs };
}

function wrap(child: LayoutTree): Wrap {
  return { type: "Wrap", child, padding: 4 };
}

function atom(): Atom {
  return { type: "Atom", text: "" };
}

function spacer(): Spacer {
  return { type: "Spacer", text: "" };
}

test("Can get spaceBetween two unwrapped rectangles.", () => {
  const t = joinh(atom(), atom());

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  expect(refs.length).toBe(2);

  const [a, b] = refs;
  expect(tt.spaceBetween(a, b)).toStrictEqual([0, 0]);
});

test("Can get spaceBetween two mutually wrapped rectangles.", () => {
  const t = wrap(joinv(atom(), atom()));

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  expect(refs.length).toBe(2);

  const [a, b] = refs;
  expect(tt.spaceBetween(a, b)).toStrictEqual([0, 0]);
});

test("Can get spaceBetween one wrapped and one unwrapped rectangle.", () => {
  const t = joinv(atom(), wrap(atom()));

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  expect(refs.length).toBe(2);

  const [a, b] = refs;
  expect(tt.spaceBetween(a, b)).toStrictEqual([0, 4]);
});

test("Can get spaceBetween one multiply wrapped and one unwrapped rectangle.", () => {
  const t = joinh(atom(), wrap(wrap(atom())));

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  expect(refs.length).toBe(2);

  const [a, b] = refs;
  expect(tt.spaceBetween(a, b)).toStrictEqual([0, 8]);
});

test("Can get spaceBetween two multiply wrapped rectangles.", () => {
  const t = joinv(wrap(atom()), wrap(wrap(atom())));

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  expect(refs.length).toBe(2);

  const [a, b] = refs;
  expect(tt.spaceBetween(a, b)).toStrictEqual([4, 8]);
});

test("Can get spaceBetween two multiply wrapped rectangles with some common wraps.", () => {
  const t = wrap(wrap(joinh(wrap(atom()), wrap(wrap(atom())))));

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  expect(refs.length).toBe(2);

  const [a, b] = refs;
  expect(tt.spaceBetween(a, b)).toStrictEqual([4, 8]);
});

test("Get get spaceBetween a wrapped rectangle and a spacer.", () => {
  const t = wrap(joinh(wrap(spacer()), atom()));

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  expect(refs.length).toBe(2);

  const [a, b] = refs;
  expect(tt.spaceBetween(a, b)).toStrictEqual([0, 0]);
});

test("Can get the maximum padding of an unwrapped rectangle.", () => {
  const t = atom();

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  const [a] = refs;
  expect(tt.getMaxPadding(a)).toBe(0);
});

test("Can get the maximum padding of several wrapped rectangles.", () => {
  const t = joinv(
    wrap(joinh(atom(), atom())),
    wrap(wrap(wrap(atom()))),
  );

  const [tt, _] = Timetable.fromLayoutTree(t);
  const refs = [...tt.enumerateIndices()];

  const [a, b, c] = refs;
  expect(tt.getMaxPadding(a)).toBe(4);
  expect(tt.getMaxPadding(b)).toBe(4);
  expect(tt.getMaxPadding(c)).toBe(12);
});
