import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Navbar from "./components/Navbar";

import Register from "./features/auth/pages/register";
import Login    from "./features/auth/pages/login";
import Panel    from "./features/panel/pages/panel";
import ProductosPage from "./features/productos/pages/ProductosPage";

import "./styles/panel.css";

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/"          element={<PrivateRoute><Panel/></PrivateRoute>} />
          <Route path="/panel"     element={<PrivateRoute><Panel/></PrivateRoute>} />
          <Route path="/productos" element={<PrivateRoute><ProductosPage/></PrivateRoute>} />
          <Route path="/login"     element={<Login/>}/>
          <Route path="/register"  element={<Register/>}/>
          <Route path="*"          element={<Login/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
