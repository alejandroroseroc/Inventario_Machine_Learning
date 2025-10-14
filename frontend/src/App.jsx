import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/login";
import Register from "./pages/register";
import PrivateRoute from "./components/PrivateRoute";

function Panel() { return <h2>Panel (privado)</h2>; }

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/panel" element={<PrivateRoute><Panel/></PrivateRoute>}/>
          <Route path="*" element={<Login/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
