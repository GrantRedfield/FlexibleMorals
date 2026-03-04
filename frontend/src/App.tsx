import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Vote from "./pages/Vote";
import Comments from "./pages/Comments";
import About from "./pages/About";
import DonorProfile from "./pages/DonorProfile";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/vote" element={<Vote />} />
      <Route path="/comments/:postId" element={<Comments />} />
      <Route path="/about" element={<About />} />
      <Route path="/donor" element={<DonorProfile />} />
    </Routes>
  );
}
