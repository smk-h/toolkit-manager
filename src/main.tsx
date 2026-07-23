import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { DirectoryConfigProvider } from "./context/DirectoryConfigContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* 目录配置单例 Provider：App/各页面/useDevices 共享同一份 state，
        SettingsPage 改路径后 App 的 toolkitPath 立即同步 */}
    <DirectoryConfigProvider>
      <App />
    </DirectoryConfigProvider>
  </React.StrictMode>,
);
