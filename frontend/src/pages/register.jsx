import { useState, useMemo } from "react";
import { apiFetch } from "../api/client";
import { Link, useNavigate } from "react-router-dom";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordScore(pw) {
  // 0–4: longitud, minúscula, mayúscula, dígito, símbolo
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw)) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

export default function Register() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const score = useMemo(() => passwordScore(password), [password]);
  const emailOk = emailRe.test(email);
  const pwStrong = score >= 3;          // mínimo: 3/4
  const pwMatch = password === confirm;
  const formOk = emailOk && pwStrong && pwMatch;

  async function onSubmit(e) {
    e.preventDefault();
    if (!formOk) return;
    setErr(""); setLoading(true);
    try {
      await apiFetch("/auth/register", {
        method: "POST",
        body: { email, password }
      });
      alert("Registro exitoso. Ahora inicia sesión.");
      nav("/login");
    } catch (e) {
      // mensajes típicos: “El correo ya está registrado.” o “Error de servidor”
      setErr(e.message || "No se pudo registrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{maxWidth:440, margin:"60px auto", padding:"24px",
                 borderRadius:12, boxShadow:"0 10px 30px rgba(0,0,0,.08)"}}>
      <h2 style={{textAlign:"center", marginBottom:18}}>Crear cuenta</h2>

      <form onSubmit={onSubmit} noValidate>
        <label htmlFor="email">Correo</label>
        <input
          id="email" type="email" placeholder="tu@correo.com"
          value={email} onChange={e=>setEmail(e.target.value)}
          aria-invalid={email && !emailOk}
          required
        />
        {!emailOk && email && <small style={{color:"crimson"}}>
          Ingresa un correo válido.
        </small>}

        <label htmlFor="pw" style={{marginTop:12}}>Contraseña</label>
        <input
          id="pw" type="password" value={password}
          onChange={e=>setPassword(e.target.value)}
          aria-invalid={password && !pwStrong}
          required minLength={8}
        />
        <div style={{display:"flex", gap:8, alignItems:"center"}}>
          <meter min="0" max="4" value={score} style={{width:"100%"}} />
          <small>
            {score <= 1 ? "débil" : score === 2 ? "media"
             : score === 3 ? "fuerte" : "muy fuerte"}
          </small>
        </div>
        {password && !pwStrong && (
          <small style={{color:"crimson"}}>
            Debe tener 8+ caracteres e incluir mayúsculas y números.
          </small>
        )}

        <label htmlFor="confirm" style={{marginTop:12}}>Confirmar contraseña</label>
        <input
          id="confirm" type="password" value={confirm}
          onChange={e=>setConfirm(e.target.value)}
          aria-invalid={confirm && !pwMatch}
          required
        />
        {confirm && !pwMatch && <small style={{color:"crimson"}}>
          Las contraseñas no coinciden.
        </small>}

        {err && <p role="alert" style={{color:"crimson", marginTop:12}}>{err}</p>}

        <button
          type="submit"
          disabled={!formOk || loading}
          style={{marginTop:16, width:"100%"}}
        >
          {loading ? "Creando..." : "Registrarme"}
        </button>
      </form>

      <p style={{marginTop:16, textAlign:"center"}}>
        ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}
