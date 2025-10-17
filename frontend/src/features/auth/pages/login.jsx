// src/features/auth/pages/login.jsx
import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { login as loginService } from "../service";

export default function Login(){
  const { login } = useAuth();
  const nav = useNavigate();
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [err,setErr] = useState("");
  const [loading,setLoading] = useState(false);

  async function onSubmit(e){
    e.preventDefault(); setErr(""); setLoading(true);
    try{
      const data = await loginService({ email, password });
      login({ access: data.access, user: data.user });
      nav("/panel");
    }catch(e){ setErr(e.message); }
    finally{ setLoading(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">Ingresar</h1>
        <p className="auth-subtitle">Ingrese sus credenciales para acceder al sistema.</p>

        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" value={email}
                 onChange={e=>setEmail(e.target.value)} required />

          <label htmlFor="pw">Contraseña</label>
          <input id="pw" type="password" value={password}
                 onChange={e=>setPassword(e.target.value)} required />

          <div className="row">
            <input id="remember" type="checkbox" disabled />
            <label htmlFor="remember" className="small">Recordarme</label>
            <div style={{flex:1}}/>
            <a href="#" className="link" onClick={e=>e.preventDefault()}>¿Olvidaste tu contraseña?</a>
          </div>

          {err && <div className="error" role="alert">{err}</div>}

          <div className="actions">
            <button disabled={loading}>{loading ? "Ingresando..." : "iniciar sesión"}</button>
          </div>
        </form>

        <p className="small" style={{marginTop:12}}>
          ¿Aún no tienes una cuenta? <Link className="link" to="/register">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
