import { useState } from "react";
import { apiFetch } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [loading,setLoading]=useState(false);

  async function onSubmit(e){
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      const data = await apiFetch("/auth/login", { method:"POST", body:{ email, password } });
      login({ access: data.access, user: data.user });
      nav("/panel");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  return (
    <div style={{maxWidth:420, margin:"60px auto"}}>
      <h2>Iniciar sesión</h2>
      <form onSubmit={onSubmit}>
        <label>Correo</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/>
        <label>Contraseña</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/>
        {err && <p style={{color:"crimson"}}>{err}</p>}
        <button disabled={loading}>{loading?"Entrando...":"Entrar"}</button>
      </form>
      <p>¿No tienes cuenta? <Link to="/register">Regístrate</Link></p>
    </div>
  );
}
