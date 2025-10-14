import { useState } from "react";
import { apiFetch } from "../api/client";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await apiFetch("/auth/register", { method:"POST", body:{ email, password } });
      alert("Registro exitoso. Ahora inicia sesión.");
      nav("/login");
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div style={{maxWidth:420, margin:"60px auto"}}>
      <h2>Crear cuenta</h2>
      <form onSubmit={onSubmit}>
        <label>Correo</label>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}/>
        {err && <p style={{color:"crimson"}}>{err}</p>}
        <button disabled={loading}>{loading?"Creando...":"Registrarme"}</button>
      </form>
      <p>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></p>
    </div>
  );
}
