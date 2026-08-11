import * as React from "react";

type Callbacks = {
  onPointerDown?: (e: PointerEvent) => void,
  onPointerUp?: (e: PointerEvent) => void,
  onPointerMove?: (e: PointerEvent) => void,
};

export type WithPointerEventsProps = {
  ref: React.RefObject<HTMLElement | null>,
} & Callbacks;

export default function WithPointerEvents(props: WithPointerEventsProps) {
  // Note: we store the callbacks in a reference so that when this
  // function is called again on state updates, we'll use the new
  // definitions of the functions, which capture different values of
  // props, etc.
  //
  // If we just called the callbacks directly in the below
  // `useEffect`, they'd only capture the first value of `props` in
  // their respective components.
  const callbacks = React.useRef<Callbacks>({});
  callbacks.current.onPointerDown = props.onPointerDown;
  callbacks.current.onPointerUp = props.onPointerUp;
  callbacks.current.onPointerMove = props.onPointerMove;

  React.useEffect(() => {
    const elt = props.ref.current;
    if(!elt) {
      return;
    }

    const onPointerMove = (e: PointerEvent) => {
      if(callbacks.current.onPointerMove) {
        callbacks.current.onPointerMove(e);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      elt.addEventListener("pointermove", onPointerMove);
      elt.setPointerCapture(e.pointerId);

      if(callbacks.current.onPointerDown) {
        callbacks.current.onPointerDown(e);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      elt.removeEventListener("pointermove", onPointerMove);
      elt.releasePointerCapture(e.pointerId);

      if(callbacks.current.onPointerUp) {
        callbacks.current.onPointerUp(e);
      }
    };

    elt.addEventListener("pointerdown", onPointerDown);
    elt.addEventListener("pointerup", onPointerUp);
    return () => {
      elt.removeEventListener("pointerdown", onPointerDown);
      elt.removeEventListener("pointerup", onPointerUp);
    };
  }, []);
}
