export const EXAMPLE_PROGRAMS = {
  "Abs": `
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
  border: 1 2        #D27D46;
  border: 1 1 -1 #FFCBA4 top right;
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
  border: 1 1 #D27D46;
  border: 1 1 -1 #FFCBA4 top right;
}

@stmt {
  padding: 2;
  fill: gainsboro;
  border: 1 1 gray;
  border: 1 1 -1 white top right;
}`,
  "CLOC: Step 1": `
main =
  [getContents
    >>= print
      . [length
      . filter]@bro]@blu $ [isPrefixOf ["--"]@gre]@bro
      . lines

@bro {
  border: 1.1 2 brown;
  fill: papayawhip;
  padding: 4;
}

@blu {
  border: 1.1 2 steelblue;
  fill: lightblue;
  padding: 4;
}

@gre {
  border: 1.1 2 green;
  fill: palegreen;
  padding: 4;
}`,
  "CLOC: Step 2": `
main =
  [[getContents
    >>= [print
      . [length
      . filter]@e]@e]@e $ [isPrefixOf "--"
      . lines]@e]@e

@e {
  fill: rgba(100 150 200 0.3);
  border: 1.1 2 black;
  padding: 4;
}`,
  "CLOC: Step 3": `
main =
  [getContents
    >>= [print
      . [length
      . [filter (isPrefixOf "--")
      . lines]@e]@e]@e]@e

@e {
  fill: rgba(100 150 200 0.3);
  border: 1.1 2 black;
  padding: 4;
}`,
  "CLOC: Step 4": `
main =
  getContents
    >>= print
      . length
      . (\ls -> trace (filter (isPrefixOf "--") ls))
      . lines`,
  "CLOC: Step 5": `
main =
  [getContents
    >>= [print
      . length
      . filter (not . isPrefixOf "--")
      . lines]@lr]@rl

@lr {
  border: 1.1 2 indigo;
  fill: lavender;
  padding: 4;
}

@rl {
  border: 1.1 2 orange;
  fill: papayawhip;
  padding: 4;
}`,
  "CLOC: Step 6": `
main =
  getContents
    >>= print
    >>> length
    >>> filter (not . isPrefixOf "--")
    >>> lines`
};
