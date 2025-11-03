import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Vote from "./pages/Vote";
import About from "./pages/About"; // 👈 Add this line

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/vote" element={<Vote />} />
      <Route path="/about" element={<About />} /> {/* ✅ This line is essential */}
    </Routes>
  );
}
