import * as react from "react";
import * as rb from "ragged-blocks";
import parseExample from "../example-parser";
import LayoutView from "./layout-view";

import * as styles from "./help-text.module.css";

interface HelpTextProps {
  measure: (text: string) => rb.Rect;
}

export default function HelpText(props: HelpTextProps) {
  const [phase, setPhase] = react.useState<number>(0);

  const phaseText: string = (() => {
    const sty: string = `
    @mul {
      padding: 3;
      border: 1 2 orange;
    }
    @block {
      padding: 3;
      border: 1 2 gray;
      fill: lightgray;
    }
    @tag {
      fill: lightblue;
      border: 1 2 steelblue;
      padding: 1;
    }
    `;

    switch(phase) {
      case 0: return "(a * b) + c";
      case 1: return "\\[\\[(a * b)\\] + c\\]";
      case 2: return "\\[\\[(a * b)\\]\\@mul + c\\]\\@add";
      case 3: return `
      [[(a * b)]@mul + c]@add

      [\\@mul]@tag [{
        padding: 3;
        border: 1 2 orange;
      }]@block
      ` + sty;
      case 4: return `
      [[(a * b)]@mul + c]@add

      \\@mul {
        padding: 3;
        border: 1 2 orange;
      }
      ` + sty;
      case 5: return `
      [[(a * b)]@mul + c]@add

      \\@mul {
        padding: 3;
        border: 1 2 orange;
      }
      \\@add {
        [fill: yellow;]@tag
      }
      @add {
        fill: yellow;
      }
      ` + sty;
      case 6: return `
      [[(a * b)]@mul + c]@add

      \\@mul {
        padding: 3;
        border: 1 2 orange;
      }
      \\@add {
        fill: yellow;
        [padding: 10;]@tag
      }
      @add {
        fill: yellow;
        padding: 10;
      }
      ` + sty;
      case 7: return `
      [[(a * b)]@mul + c]@add

      \\@mul {
        padding: 3;
        border: 1 2 orange;
      }
      \\@add {
        fill: yellow;
        padding: 10;
        [border: 2 black;]@tag
      }
      @add {
        fill: yellow;
        padding: 10;
        border: 2 black;
      }
      ` + sty;
      case 8: return `
      [[(a * b)]@mul + c]@add

      \\@mul {
        padding: 3;
        border: 1 2 orange;
      }
      \\@add {
        fill: yellow;
        padding: 10;
        border: 2 [10]@tag black;
      }
      @add {
        fill: yellow;
        padding: 10;
        border: 2 10 black;
      }
      ` + sty;
      case 9: return `
      [[(a * b)]@mul + c]@add

      \\@mul {
        padding: 3;
        border: 1 2 orange;
      }
      \\@add {
        fill: yellow;
        padding: 10;
        border: 2 10 [-5]@tag black;
      }
      @add {
        fill: yellow;
        padding: 10;
        border: 2 10 -5 black;
      }
      ` + sty;
      case 10: return `
      [[(a * b)]@mul + c]@add

      \\@mul {
        padding: 3;
        border: 1 2 orange;
      }
      \\@add {
        fill: yellow;
        padding: 10;
        border: 2 10 -5 black [[top right]@tag];
      }
      @add {
        fill: yellow;
        padding: 10;
        border: 2 10 -5 black top right;
      }
      ` + sty;
      default: return "none"
    }
  })();

  const exampleLayoutTree: rb.LayoutTree = react.useMemo(() => {
    return parseExample(phaseText) as rb.LayoutTree;
  }, [phaseText]);

  return (
    <div className={styles.helpTextRoot}>
      <div className={styles.textColumn}>
        <div>
          <p style={{paddingLeft: "6px"}}>
            <em>Click on a paragraph to see the corresponding layout.</em>
          </p>
          <p className={
            styles.textSection
              + (phase === 0 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(0)}
          >
             Suppose that we wanted to visualize the structure of an arithmetic expression. First, type the text of the layout, <code>(a * b) + c</code>, into the text box.
          </p>
          <p className={
            styles.textSection
              + (phase === 1 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(1)}
          >
             Without a domain-specific parser, we can't automatically derive the structure of the text we've just entered. Instead, we can manually annotate the extent of each term in the document. Surrounding any substring with <code>[</code> and <code>]</code> mark it as belonging to its own <em>Node</em> in the layout tree. The <code>[</code> and <code>]</code> symbols are not rendered in the output (however they're shown on the left for illustrative purposes). To render a literal <code>[</code> (resp. <code>]</code>), instead type <code>\[</code> (resp. <code>\]</code>).
          </p>
          <p className={
            styles.textSection
              + (phase === 2 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(2)}
          >
             But, by default, Nodes in the layout tree are not styled any differently than text fragments, so we ought to apply some <em>styles</em> to the new Nodes so that we can see them. To style a node, we attach a <code className={styles.tag}>@tag</code> to it, replacing <code>tag</code> with whatever name we please. (Again, tags are not rendered in the output, but can be escaped as in <code>\@example</code>.)
          </p>
          <p className={
            styles.textSection
              + (phase === 3 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(3)}
          >
             Each <code className={styles.tag}>@tag</code> may have a corresponding <span className={styles.block}>block</span>, each block having some rules which apply to every node with the given <code className={styles.tag}>@tag</code>.
          </p>
          <p className={
            styles.textSection
              + (phase === 4 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(4)}
          >
             The demo application understands a few properties:
          </p>
          <p className={
            styles.textSection
              + (phase === 5 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(5)}
          >
             The <span className={styles.tag}>fill</span> property sets the background color of a Node.
          </p>
          <p className={
            styles.textSection
              + (phase === 6 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(6)}
          >
             The <span className={styles.tag}>padding</span> property sets the amount of padding to allocate around each Node.
          </p>
          <p className={
            styles.textSection
              + (phase === 7 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(7)}
          >
             The <span className={styles.tag}>border</span> property adds a border to the rendering of the Node. Unlike the other properties, if specified multiple times, multiple borders are added. At minimum, the border property must specify a border width and a border color.
          </p>
          <p className={
            styles.textSection
              + (phase === 8 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(8)}
          >
             If an additional number is provided, it is treated as corner radius.
          </p>
          <p className={
            styles.textSection
              + (phase === 9 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(9)}
          >
             And a third argument, if present, is treated as a signed offset.
          </p>
          <p className={
            styles.textSection
              + (phase === 10 ? ` ${styles.selected}` : "")}
            onClick={() => setPhase(10)}
          >
             Finally, the border property can be followed by any of the keywords <code>top</code>, <code>bottom</code>, <code>left</code>, or <code>right</code>, which control which sides of the border are rendered. Of course, there's no accounting for taste.
          </p>
        </div>
      </div>
      <div className={styles.helpTextVerticalLine}></div>
      <div className={styles.helpTextLayout}>
        <LayoutView
          layoutTree={exampleLayoutTree}
          algoName={"L1S+"}
          measure={props.measure}/>
      </div>
    </div>
  );
}
