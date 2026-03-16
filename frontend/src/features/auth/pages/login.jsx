import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await login({ email, password });
      if (data?.user?.is_admin) {
        nav("/admin", { replace: true });
      } else {
        nav("/panel", { replace: true });
      }
    } catch (err) {
      setError(
        err?.payload?.detail || err?.message || "No se pudo iniciar sesión"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap" aria-labelledby="login-title">
      <section className="auth-card">
        <h1 id="login-title" className="auth-title">
          Iniciar sesión
        </h1>
        <p className="auth-subtitle">
          Ingresa tu correo y contraseña para acceder al panel.
        </p>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          style={{ display: "grid", gap: 12 }}
          noValidate
        >
          <label htmlFor="login-email">Correo</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            disabled={busy}
            className="btn btn--primary"
            aria-busy={busy}
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="small" style={{ marginTop: 12 }}>
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="link">
            Regístrate
          </Link>
        </p>
      </section>
    </main>
  );
}
