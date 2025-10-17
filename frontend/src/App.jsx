// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

import Register from "./features/auth/pages/register";
import Login    from "./features/auth/pages/login";

function Panel(){ return <h2>Panel (privado)</h2>; }

export default function App(){
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/register" element={<Register/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/panel" element={<PrivateRoute><Panel/></PrivateRoute>}/>
          <Route path="*" element={<Login/>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
