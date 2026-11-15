import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Font face is declared in index.css (latin subset only).
import "./index.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
