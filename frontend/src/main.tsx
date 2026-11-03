import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/public-sans";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA 离线缓存注册失败不影响功能 */
    });
  });
}
