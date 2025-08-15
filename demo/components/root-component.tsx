import * as react from "react";
import * as rb from "ragged-blocks";
import * as styles from "./root.module.css";
import Button from "./button-component";
import CodeMirror from "@uiw/react-codemirror";
import Dropdown from "./dropdown-component";
import HelpText from "./help-text";
import LayoutView from "./layout-view";
import parseExample from "../example-parser";

import fontURL from "../Inconsolata-Medium.woff2";
import LabeledCheckbox from "./labeled-checkbox-component";
import Tooltip from "./tooltip-component";

const DEFAULT_PROGRAM = `
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
}
`;

type FontLoadStatus = {
  done: boolean;
};

/**
 * Find a human-readable string representing the time since `date`.
 *
 * @param date The date to get the time since.
 * @returns A string.
 */
function timeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if(seconds < 60) {
    return seconds + " seconds ago";
  } else if(seconds < 60 * 60) {
    const mins = Math.floor(seconds / 60);
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  } else {
    const hrs = Math.floor(seconds / (60 * 60));
    return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  }
}

export default function Root() {
  const [aboutOpen, setAboutOpen] = react.useState<boolean>(true);
  const [helpOpen, setHelpOpen] = react.useState<boolean>(false);
  const [useWebWorkers, setUseWebWorkers] = react.useState<boolean>(true);

  const canvasRef = react.useRef<HTMLCanvasElement>(
    document.createElement("canvas"),
  );
  const [fontLoadStatus, setFontLoadStatus] = react.useState<FontLoadStatus>({
    done: false,
  });
  const fontFace = react.useRef<FontFace>(null);

  // Load the font.
  react.useEffect(() => {
    const font = new FontFace("Inconsolata-Medium", `url(${fontURL})`);

    font.load().then(() => {
      fontFace.current = font;
      setFontLoadStatus({ done: true });
    });
  }, []);

  const measure = react.useCallback((text: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "12px Inconsolata-Medium";
    const metrics = ctx.measureText(text);

    return {
      left: 0,
      right: metrics.width,
      top: -metrics.fontBoundingBoxAscent,
      bottom: metrics.fontBoundingBoxDescent,
    };
  }, [fontLoadStatus]);

  const [layoutTree, setLayoutTree] = react.useState<rb.LayoutTree>(
    // Initialize the layout tree with an empty node.
    { type: "Node", children: [], padding: 0 },
  );
  const [editorValue, setEditorValue] = react.useState<string>(
    localStorage.getItem("editorValue") ?? DEFAULT_PROGRAM,
  );
  const [statusText, setStatusText] = react.useState<string>("");
  const [parseError, setParseError] = react.useState<string>("");
  const editTimer = react.useRef<number>(null);
  const lastSaved = react.useRef<Date>(null);

  const onEditTimerExpired = react.useCallback((val: string) => {
    localStorage.setItem("editorValue", val);
    lastSaved.current = new Date();
    setStatusText("Changes saved.");
  }, []);

  const [activeLayouts, setActiveLayouts] = react.useState<rb.AlgorithmName[]>(
    ["L1S+"],
  );

  const onChange = react.useCallback((val: string) => {
    const result = parseExample(val);

    if (typeof result === "string") {
      // If there's a parse error, set the current parseError to the
      // error text.
      setParseError(result);
    } else {
      // Otherwise, update the layout tree.
      setLayoutTree(result);
      setParseError("");
    }
    setEditorValue(val);

    // Update the editTimer.
    if (editTimer.current !== null) {
      window.clearTimeout(editTimer.current);
    }
    editTimer.current = window.setTimeout(onEditTimerExpired, 2000, val);
  }, []);

  // Update the status message with the last time the editor saved.
  react.useEffect(() => {
    const intervalId = setInterval(() => {
      if(lastSaved.current) {
        setStatusText(`Last saved ${timeSince(lastSaved.current)}.`);
      }
    }, 30000);

    return () => {
      clearTimeout(intervalId);
    };
  });

  const hasLayout = react.useCallback(
    (algoName: rb.AlgorithmName) =>
      activeLayouts.some((algo) => algo === algoName),
    [activeLayouts],
  );

  function removeLayout(algoName: rb.AlgorithmName) {
    setActiveLayouts((activeLayouts) =>
      activeLayouts.filter((algo) => algo !== algoName),
    );
  }

  function addLayout(algoName: rb.AlgorithmName) {
    setActiveLayouts((activeLayouts) =>
      hasLayout(algoName) ? activeLayouts : [...activeLayouts, algoName],
    );
  }

  function toggleLayout(algoName: rb.AlgorithmName) {
    if(hasLayout(algoName)) {
      removeLayout(algoName);
    } else {
      addLayout(algoName);
    }
  }

  // Re-render when the view initially loads.
  react.useEffect(() => {
    onChange(editorValue);
  }, []);

  return (
    <div>
      <div className={styles.sectionLine}></div>
      <Dropdown isOpen={aboutOpen} onChange={setAboutOpen} label={"About"}>
        <p className={styles.aboutText}>
          This website is an interactive sandbox that accompanies our paper, <a href={"https://arxiv.org/pdf/2507.06460"}><em>Ragged Blocks: Rendering Structured Text with Style</em></a>. It implements all of the algorithms that we benchmarked in the paper, and offers a way to visualize how each algorithm renders a layout tree of the reader's choice.
          <br/>
          <br/>
          See the below <em>Syntax Guide</em> for instructions on how to construct your own examples. Type into the <em>Playground</em> to construct examples, and compare the outputs of different layout algorithms.
        </p>
      </Dropdown>
      <div className={styles.sectionLine}></div>
      <Dropdown isOpen={helpOpen} onChange={setHelpOpen} label={"Syntax Guide"}>
        <HelpText measure={measure}/>
      </Dropdown>
      <div className={styles.sectionLine}></div>
      <span className={styles.playgroundLabel}>Playground</span>
      <CodeMirror value={editorValue} onChange={onChange} />
      {
        parseError !== ""
          ? <div className={styles.parseErrorBox}>
              <pre>{parseError}</pre>
            </div>
          : <></>
      }
      <div className={styles.infoContainer}>
        <span className={styles.label}>{statusText}</span>
        <span>
          <Tooltip>
            <div className={styles.tooltipContent}>
              If enabled, layout and SVG generation will be scheduled on a Web Worker, rather than on the main thread. This permits multiple algorithms to layout in parallel.
            </div>
            <LabeledCheckbox
              checked={useWebWorkers}
              onChange={onOff => setUseWebWorkers(onOff)}
              label={"Use web workers for layout"}/>
          </Tooltip>
          <span style={{ display: "inline-block", width: "4px" }}></span>
          <Tooltip>
            <div className={styles.tooltipContent}>
              Restore the editor text to the default example program.
            </div>
            <Button
              onClick={() => onChange(DEFAULT_PROGRAM)}
              style={{ fontSize: "0.7em" }}
              label={"Reset Editor"}
            />
          </Tooltip>
        </span>
      </div>
      <div className={styles.compareButtonsCluster}>
        <span className={styles.label}>
          Layout Algorithms
        </span>
        <div className={styles.compareButtons}>
          <Tooltip>
            <div className={styles.tooltipContent}>
              This algorithm is as close as possible to the formal description from the paper.
              It does not use <em>Stateful Regions</em>, however, and so does not render
              polygonal outlines around each Rock.
            </div>
            <Button
              label={"L1P"}
              onClick={() => toggleLayout("L1P")}
              enabled={hasLayout("L1P")}
            />
          </Tooltip>
          <Tooltip>
            <div className={styles.tooltipContent}>
              Algorithm L1P, extended with stateful regions (<em>S</em>) and simplification (<em>+</em>).
            </div>
            <Button
              label={"L1S+"}
              onClick={() => toggleLayout("L1S+")}
              enabled={hasLayout("L1S+")}
            />
          </Tooltip>
          <Tooltip>
            <div className={styles.tooltipContent}>
              Blocks renders each node in the Layout Tree inside a rectangle. This can lead to unnatural text layouts which don't resemble their source. However, this algorithm is very simple and pretty fast.
            </div>
            <Button
              label={"Blocks"}
              onClick={() => toggleLayout("Blocks")}
              enabled={hasLayout("Blocks")}
            />
          </Tooltip>
          <Tooltip>
            <div className={styles.tooltipContent}>
              Our previous algorithm, described in <em>Code Style Sheets: CSS For Code</em>. It is more performant than L1S+, but cannot always produce layouts of the same compactness.
            </div>
            <Button
              label={"S-Blocks"}
              onClick={() => toggleLayout("S-Blocks")}
              enabled={hasLayout("S-Blocks")}
            />
          </Tooltip>
        </div>
      </div>
      <div className={styles.layoutsContainer}>
        {
          [...activeLayouts.map(algoName => (
            <LayoutView
              key={algoName}
              layoutTree={layoutTree}
              algoName={algoName}
              measure={measure}
              onRemoveLayoutPressed={removeLayout}
              useWebWorkers={useWebWorkers}
            />
          ))]
        }
      </div>
    </div>
  );
}
