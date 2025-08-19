import * as react from "react";
import * as rb from "ragged-blocks";
import * as styles from "./layout-view.module.css";
import Dropdown from "./dropdown-component";
import Button from "./button-component";
import LabeledCheckbox from "./labeled-checkbox-component";
import layout, { LayoutResult, RenderSettings } from "../layout";
import {
  faGear,
  faDownload,
  faCircleMinus,
} from "@fortawesome/free-solid-svg-icons";
import Tooltip from "./tooltip-component";

interface LayoutViewProps<A extends rb.AlgorithmName> {
  layoutTree: rb.LayoutTree;
  algoName: A;
  measure: (text: string) => rb.Rect;
  useWebWorkers?: boolean;
}

/**
 * Produce a human readable string representing the given time in
 * milliseconds.
 *
 * @param duration The duration in milliseconds.
 * @returns A human readbale string representing the duration.
 */
function describeDuration(duration: number): string {
  const format = Intl.NumberFormat(undefined, {
    maximumSignificantDigits: 2,
    maximumFractionDigits: 3,
    roundingPriority: "lessPrecision"
  });

  let unit: string = "";
  if(duration < 1) {
    return "< 1 ms";
  } else if(duration < 1000) {
    unit = "ms";
  } else {
    duration /= 1000;
    unit = "s";
  }

  return `${format.format(duration)} ${unit}`;
}

export default function LayoutView<A extends rb.AlgorithmName>(props: LayoutViewProps<A>) {
  const [statusText, setStatusText] = react.useState<string>("");
  const [layoutResult, setLayoutResult] = react.useState<LayoutResult>({
    algoName: props.algoName,
    status: "loading",
  });

  /**
   * The `abortController` allows us to abort the current layout
   * attempt if we need to re-draw before a call to `layout` has
   * finished. If it's non-null, then a call to `layout` is currently
   * in progress.
   */
  const abortController = react.useRef<AbortController>(null);

  const [settingsOpen, setSettingsOpen] = react.useState<boolean>(false);

  const [layoutSettings, setLayoutSettings] = react.useState<rb.Settings<A>>((() => {
    switch (props.algoName) {
      case "L1P":
        return new rb.PebbleLayoutSettings(10);
      case "L1S":
        return new rb.RocksLayoutSettings(10);
      case "L1S+":
        return new rb.OutlinedRocksLayoutSettings(10, true);
      case "Blocks":
        return new rb.BlocksLayoutSettings();
      case "S-Blocks":
        return new rb.SBlocksLayoutSettings(10);
    }
  })() as rb.Settings<A>);

  const [renderSettings, setRenderSettings] = react.useState<RenderSettings>({
    renderDistanceMesh: false,
    renderFragmentBoundingBoxes: false
  });

  // Re-render the layouts when the layouts or layoutTree changes.
  react.useEffect(() => {
    if(abortController.current) {
      // Then, a layout is already in progress. We should abort it
      // before starting a new one.
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    const measured = rb.measureLayoutTree(props.layoutTree, props.measure);

    setLayoutResult({
      algoName: props.algoName,
      status: "loading",
    });

    // Kick of the rendering process
    layout(
      measured,
      props.algoName,
      layoutSettings,
      renderSettings,
      props.useWebWorkers,
      abortController.current.signal
    ).then(result => {
      // Note that we only reset the abort controller when we have a
      // _successful_ layout, or a layout which ended in a (non-abort)
      // error. That's because only in those two cases should we _not_
      // attempt to abort the layout if a new layout request comes in.
      abortController.current = null;
      setLayoutResult(result);

      if(result.status === "done") {
        setStatusText(`Last layout took ${describeDuration(result.duration)}`);
      }
    }).catch(error => {
      if(error !== "aborted") {
        // If the `err` is "aborted", then this layout is finishing
        // because a new layout has just started. We shouldn't adjust
        // the `layoutResult` in this case.

        abortController.current = null;
        setLayoutResult({ status: "failed", algoName: props.algoName, error });
      } else {
        console.log("Layout aborted");
      }
    });
  }, [props.layoutTree, layoutSettings, props.measure, renderSettings]);

  function downloadLayout() {
    if (layoutResult.status !== "done") {
      return;
    }

    // The following is based on:
    // https://stackoverflow.com/a/46403589
    const preface = '<?xml version="1.0" standalone="no"?>\r\n';
    const blob = new Blob([preface, layoutResult.svgSrc], {
      type: "image/svg+xml;charset=utf8",
    });
    const dlURL = URL.createObjectURL(blob);
    const dlLink = document.createElement("a");
    dlLink.href = dlURL;
    dlLink.download = props.algoName + ".svg";
    document.body.appendChild(dlLink);
    dlLink.click();
    document.body.removeChild(dlLink);
  }

  return (
    <div className={styles.layoutContainer} key={props.algoName}>
      <div className={styles.upperHalf}>
        <div className={styles.buttonColumn}>
          <Tooltip>
            <div className={styles.tooltipContent}>
              Download this layout as an SVG.
            </div>
            <Button
              label={""}
              icon={faDownload}
              onClick={downloadLayout}
            />
          </Tooltip>
        </div>
        <div>
          <div className={styles.infoContainer}>
            <span style={{ fontWeight: "bold" }} className={styles.label}>
              {props.algoName}
            </span>
            <span style={{ color: "gray" }} className={styles.label}>
              {statusText}
            </span>
          </div>
          <LayoutResultView layoutResult={layoutResult} />
        </div>
      </div>
      <Dropdown
        isOpen={settingsOpen}
        icon={faGear}
        onChange={setSettingsOpen}>
        <LabeledCheckbox
          label="Render distance mesh"
          checked={renderSettings.renderDistanceMesh}
          onChange={(onOff) =>
            setRenderSettings(settings => ({ ...settings, renderDistanceMesh: onOff }))
          }/>
        <br/>
        <LabeledCheckbox
          label="Render fragment bounding boxes"
          checked={renderSettings.renderFragmentBoundingBoxes}
          onChange={(onOff) =>
            setRenderSettings(settings => ({ ...settings, renderFragmentBoundingBoxes: onOff }))
          }/>
        {
          // TODO: Maybe state.algoSettings should expose an interface which provides
          // a description for each setting and a way to modify the setting in a type-safe way.
          [
            ...layoutSettings.viewSettings().map(settingView => {
              let toggle = settingView.asToggle();
              if(toggle !== null) {
                return (
                  <div key={toggle.key}>
                    <LabeledCheckbox
                      label={toggle.description}
                      checked={toggle.value}
                      onChange={(onOff) => {
                        setLayoutSettings((toggle.update(onOff) as rb.Settings<A>));
                      }}
                    />
                  </div>
                );
              }
            }),
          ]
        }{" "}
      </Dropdown>
    </div>
  );
}

function LayoutResultView({ layoutResult }: { layoutResult: LayoutResult }) {
  const lastGoodResult = react.useRef<string | null>(null);

  if(layoutResult.status === "done") {
    lastGoodResult.current = layoutResult.svgSrc;

    return (
        <div
          dangerouslySetInnerHTML={{ __html: layoutResult.svgSrc }}>
        </div>
    );
  } else {
    return (
      <div className={styles.stack}>
        {
          lastGoodResult.current !== null
            ? (<div className={styles.lastGoodResult}
                 dangerouslySetInnerHTML={{ __html: lastGoodResult.current }}>
               </div>)
            : <></>
        }
        {
          layoutResult.status === "loading"
            ? (<div className={styles.throbber}></div>)
            // TODO: Show more info about the layout error.
            : (<div className={styles.errMsg}>{String(layoutResult.error)}</div>)
        }
      </div>
    );
  }
}
