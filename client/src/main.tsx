import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { BASE_PATH } from "@/lib/basePath";

// Root-relative fetch("/api/...") calls throughout the app need BASE_PATH
// prepended when deployed under a subpath -- patched globally here rather
// than editing every call site (see pf-cwh's basePath.ts for the same
// pattern/rationale).
if (BASE_PATH) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith("/") && !input.startsWith(BASE_PATH + "/")) {
      input = BASE_PATH + input;
    }
    return originalFetch(input, init);
  };
}

createRoot(document.getElementById("root")!).render(<App />);
