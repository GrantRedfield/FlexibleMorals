import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Vote from "./pages/Vote";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/vote" element={<Vote />} />
    </Routes>
  );
}
