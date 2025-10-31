import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function Login(){
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e){
    e.preventDefault();
    setError(""); setBusy(true);
    try{
      await login({ email, password });
      nav("/panel", { replace: true });
    }catch(err){
      setError(err?.payload?.detail || err?.message || "No se pudo iniciar sesión");
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="panel-wrap" style={{maxWidth:480}}>
      <h2 className="panel-title">Iniciar sesión</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={onSubmit} style={{display:"grid", gap:12}}>
        <label>Correo</label>
        <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required />

        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required />

        <button className="nav__logout" type="submit" disabled={busy} style={{background:"#16a34a"}}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p style={{marginTop:12}}>¿No tienes cuenta? <Link to="/register">Regístrate</Link></p>
    </div>
  );
}
