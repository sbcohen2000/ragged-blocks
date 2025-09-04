export const EXAMPLE_PROGRAMS = {
  "abs": `
const [abs]@nm = [([x]@nm) =>
  [[[x]@nm < 0]@e ? [-[x]@nm]@e
        : [[x]@nm]@e]@e]@e

@nm {
  fill: #FAFA37;
  border: 0 2;
}

@e {
  padding: 2;
  fill: #FA9D5A;
  border: 0.7 2        #D27D46;
  border: 0.7 1.3 -0.7 #FFCBA4 top right;
}`,
  "Point Free Pipeline": `
main =
  [getContents
    >>= [print
      . [length
      . [filter (not . isPrefixOf "--")
      . lines]@e]@e]@e]@e

@e {
  fill: rgba(100 150 200 0.3);
  border: 1.1 2 black;
  padding: 4;
}`,
  "List Comprehension": `
[pairs]@nm =
  [\\[ [([i]@nm, [j]@nm)]@expr
     [for [i]@nm in [range([0]@nm, [10]@nm)]@expr
     [for [j]@nm in [range([0]@nm, [10]@nm)]@expr
     [if [i]@nm != [j]@nm]@stmt]@stmt]@stmt \\]]@expr

@nm {
  fill: #FAFA37;
  border: 0 2;
}

@expr {
  padding: 2;
  fill: #FA9D5A;
  border: 0.7 1 #D27D46;
  border: 0.7 1 -0.7 #FFCBA4 top right;
}

@stmt {
  padding: 2;
  fill: gainsboro;
  border: 0.7 1 gray;
  border: 0.7 1 -0.7 white top right;
}`
};
