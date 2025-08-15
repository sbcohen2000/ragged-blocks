import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { CSSProperties, Ref } from "react";

import * as style from "./button.module.css";

export interface ButtonProps {
  /**
   * The name of an icon (from font awesome)
   */
  icon?: IconDefinition;
  /**
   * The buttont text.
   */
  label?: string;
  /**
   * Is the button enabled?
   */
  enabled?: boolean;
  /**
   * A function which is called when the button is clicked.
   */
  onClick?: () => void;
  /**
   * Additional inline styles to apply to the element's root
   * component.
   */
  style?: CSSProperties
  /**
   * A reference to the root of this component.
   */
  ref?: Ref<HTMLSpanElement>
}

export default function Button(props: ButtonProps) {
  // We repeat the contents of the button twice, the first copy to
  // establish the button's size (but is invisible), and the second
  // copy with absolute positioning so that we can bold the button
  // text without changing its size.
  return (
    <span ref={props.ref} style={props.style} className={style.button + (props.enabled ? (" " + style.enabled) : "")} onClick={props.onClick}>
      <span className={style.buttonContentsContainer}>
        {
          props.icon ?
            <FontAwesomeIcon
              icon={props.icon}
              size={"xs"}/> : <></>
        }
        {props.label ?? "button"}
        <span className={style.buttonContents}>
          {
            props.icon ?
              <FontAwesomeIcon
                icon={props.icon}
                size={"xs"}/> : <></>
          }
          {props.label ?? "button"}
        </span>
      </span>
    </span>
  );
}
