import { createRoot } from "react-dom/client";
import Root from "./components/root-component";

document.addEventListener("DOMContentLoaded", () => {
  document.body.innerHTML = "<div id=\"app\"></div>";
  const root = createRoot(document.getElementById("app")!);
  root.render(<Root/>);
});
