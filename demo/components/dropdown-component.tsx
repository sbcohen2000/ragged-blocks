import Button from "./button-component";
import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { PropsWithChildren } from "react";

export type DropdownProps = {
  /**
   * The name of an icon (from font awesome)
   */
  icon?: IconDefinition,
  /**
   * What is the dropdown called?
   */
  label?: string,
  /**
   * True if the dropdown is open, showing its contents.  false
   * otherwise.
   */
  isOpen?: boolean,
  /**
   * Called when the dropdown is clicked. Passes `!isOpen`.
   */
  onChange?: (newState: boolean) => void,
};

export default function Dropdown(props: PropsWithChildren<DropdownProps>) {
  function onClick() {
    if(props.onChange) {
      props.onChange(!(props.isOpen ?? false));
    }
  }

  return (
    <div>
      <Button
        onClick={onClick}
        icon={props.icon}
        label={props.label ?? ""}
        enabled={props.isOpen}/>
      {
        (props.isOpen ?? false)
          ? <div>{props.children}</div>
          : <></>
      }
    </div>
  );
}
