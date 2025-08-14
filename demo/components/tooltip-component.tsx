import * as react from "react";
import * as styles from "./tooltip.module.css";
import { createPortal } from "react-dom";

export interface TooltipProps {
  /**
   * The tooltip accepts exactly two children; a child to display
   * inside the tooltip, and a child which, when hovered, will cause
   * the tooltip to display.
   */
  children: [react.ReactNode, react.ReactElement<{ ref: react.Ref<HTMLElement> }>]
};

type TooltipState = {
  visibility: "Visible";
  pageX: number;
  pageY: number;
} | {
  visibility: "NotVisible";
};

export default function Tooltip(props: TooltipProps) {
  const [tooltipState, setTooltipState] = react.useState<TooltipState>({
    visibility: "NotVisible"
  });
  const childRef = react.useRef<HTMLElement>(null);

  react.useEffect(() => {
    let tooltipCountdownId: ReturnType<typeof setTimeout>;

    function onMouseMove(event: MouseEvent) {
      clearTimeout(tooltipCountdownId);

      tooltipCountdownId = setTimeout(() => setTooltipState({
        visibility: "Visible",
        pageX: event.pageX,
        pageY: event.pageY
      }), 1000);
    }

    function onMouseEnter(event: MouseEvent) {
      tooltipCountdownId = setTimeout(() => setTooltipState({
        visibility: "Visible",
        pageX: event.pageX,
        pageY: event.pageY
      }), 1000);

      if(childRef.current) {
        childRef.current.addEventListener("mousemove", onMouseMove);
      }
    }

    function onMouseLeave() {
      clearTimeout(tooltipCountdownId);
      setTooltipState({
        visibility: "NotVisible"
      });

      if(childRef.current) {
        childRef.current.removeEventListener("mousemove", onMouseMove);
      }
    }

    if(childRef.current) {
      childRef.current.addEventListener("mouseenter", onMouseEnter);
      childRef.current.addEventListener("mouseleave", onMouseLeave);
    }

    return () => {
      clearTimeout(tooltipCountdownId);
      if(childRef.current) {
        childRef.current.removeEventListener("mouseenter", onMouseEnter);
        childRef.current.removeEventListener("mouseleave", onMouseLeave);
        childRef.current.removeEventListener("mousemove", onMouseMove);
      }
    }
  }, [props.children]);

  return (
    <>
      {
        react.Children.map(props.children[1], (child, _index) =>
          react.cloneElement(child, { ref: childRef }))
      }
      {
        tooltipState.visibility === "Visible"
          ? <TheTooltip
              pageX={tooltipState.pageX}
              pageY={tooltipState.pageY}>
              {props.children[0]}
            </TheTooltip>
          : <></>
      }
    </>
  );
}

interface TheTooltipProps {
  children: react.ReactNode,
  pageX: number;
  pageY: number;
}

const TOOLTIP_SIZE: number = 10;

function TheTooltip(props: TheTooltipProps) {
  const ref = react.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = react.useState<{ width: number, height: number } | null>(null);

  react.useLayoutEffect(() => {
    if(ref.current) {
      if(dimensions && dimensions.width === ref.current.offsetWidth && dimensions.height === ref.current.offsetHeight) {
        // If the dimensions are unchanged, no need to update the
        // state. (This prevents update loops.)
        return;
      }

      setDimensions({
        width: ref.current.offsetWidth,
        height: ref.current.offsetHeight
      });
    }
  });

  let x = 0;
  let y = 0;
  let flipped = false;

  // The following `if` statement ensures that on the first time that
  // we render this component, we render it in the top-left corner of
  // the screen, and thus get its intrinsic width and height. If we
  // measured it "in place," and this tooltip were close to the edge
  // of the screen, the content of the tooltip might wrap
  // accordingly. However, the tooltip content should look the same no
  // matter where it's instantiated on the screen.
  if(dimensions) {
    x = props.pageX - dimensions.width / 2;
    y = props.pageY - dimensions.height;

    // Now, we shift `x` and `y` so that the tooltip is always on the
    // screen. The screen's visible dimensions can be found with
    // `window.inner{Width/Height}`, which give the visible width and
    // height of the viewport, and `window.page{X/Y}Offset`, which give
    // the offset of the top-left corner of the viewport in page
    // coordinates.
    x = Math.min(Math.max(0, x), (window.innerWidth + window.pageXOffset) - dimensions.width);

    // Check if we should flip the tooltip so that it is below the
    // mouse, rather than above. We add `TOOLTIP_SIZE` here to account
    // for the tooltip tip.
    flipped = y - TOOLTIP_SIZE < window.pageYOffset;
    if(flipped) {
      y = props.pageY;
    }
  }

  return createPortal(
    <>
      <div
        style={{
          left: `${x}px`,
          top:`${y + (flipped ? TOOLTIP_SIZE : -TOOLTIP_SIZE)}px`,
          width: dimensions?.width ?? 0,
          height: dimensions?.height ?? 0 }}
        className={styles.tooltipContentShadow}>
      </div>
      <div
        style={{left: `${props.pageX - TOOLTIP_SIZE / 2}px`, top: `${props.pageY + (flipped ? 0 : -TOOLTIP_SIZE)}px`}}
        className={styles.tooltipTipShadow + (flipped ? " " + styles.flipped : "")}>
      </div>
      <div
        ref={ref}
        style={{left: `${x}px`, top:`${y + (flipped ? TOOLTIP_SIZE : -TOOLTIP_SIZE)}px`}}
        className={styles.tooltipContent + (flipped ? " " + styles.flipped : "")}>
        {props.children}
      </div>
      <div
        style={{left: `${props.pageX - TOOLTIP_SIZE / 2}px`, top: `${props.pageY + (flipped ? 0 : -TOOLTIP_SIZE)}px`}}
        className={styles.tooltipTip + (flipped ? " " + styles.flipped : "")}>
      </div>
    </>,
    document.body
  );
}
