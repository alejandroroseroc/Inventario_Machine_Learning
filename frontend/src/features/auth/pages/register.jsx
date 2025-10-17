// src/features/auth/pages/register.jsx
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRegister } from "../hooks";
import PasswordStrength from "../components/PasswordStrength";

const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register(){
  const nav = useNavigate();
  const { submit, loading, error } = useRegister();  // mantengo tu API
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const emailOk = useMemo(()=>emailRx.test(email),[email]);
  const pwOk = useMemo(()=>password.length>=8,[password]);
  const match = useMemo(()=>password && password===confirm,[password,confirm]);
  const valid = emailOk && pwOk && match && !loading;

  async function onSubmit(e){
    e.preventDefault();
    if(!valid) return;
    const res = await submit({ email, password });
    if(res?.ok !== false){               // tu hook retorna ok? maneja ambos casos
      alert("Registro exitoso. Ahora inicia sesión.");
      nav("/login");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-title">Crear cuenta</h1>
        <p className="auth-subtitle">Regístrate para usar el sistema</p>

        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" value={email}
                 onChange={e=>setEmail(e.target.value)} required />

          <label htmlFor="pw">Contraseña</label>
          <input id="pw" type="password" value={password}
                 onChange={e=>setPassword(e.target.value)} required minLength={8}/>
          <PasswordStrength value={password}/>
          <p className="small">Mínimo 8 caracteres, combina mayúsculas, números y símbolos.</p>

          <label htmlFor="pw2">Confirmar contraseña</label>
          <input id="pw2" type="password" value={confirm}
                 onChange={e=>setConfirm(e.target.value)} required />

          {error && <div className="error" role="alert">{error}</div>}

          <div className="actions">
            <button disabled={!valid}>{loading ? "Creando..." : "Registrarme"}</button>
          </div>
        </form>

        <p className="small" style={{marginTop:12}}>
          ¿Ya tienes cuenta? <Link className="link" to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
