import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { DonorProvider } from "./context/DonorContext.tsx";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <DonorProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DonorProvider>
    </AuthProvider>
  </React.StrictMode>
);
