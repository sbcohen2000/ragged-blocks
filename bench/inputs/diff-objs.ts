var groupObjBy = curry(pipe(
  // Call groupBy with the object as pairs, passing only the value to the key function
  useWith(groupBy, [useWith(__, [last]), toPairs]),
  map(fromPairs)
))

var diffObjs = pipe(
  useWith(mergeWith(merge), [map(objOf("leftValue")), map(objOf("rightValue"))]),
  groupObjBy(cond([
    [
      both(has("leftValue"), has("rightValue")),
      pipe(values, ifElse(apply(equals), always("common"), always("difference")))
    ],
    [has("leftValue"), always("onlyOnLeft")],
    [has("rightValue"), always("onlyOnRight")],
  ])),
  evolve({
    common: map(prop("leftValue")),
    onlyOnLeft: map(prop("leftValue")),
    onlyOnRight: map(prop("rightValue"))
  })
);

diffObjs({a: 1, c: 5, d: 4 }, {a: 1, b: 2, d: 7});
