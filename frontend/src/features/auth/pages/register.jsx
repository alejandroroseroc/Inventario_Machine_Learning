import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

export default function RegisterPage() {
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      // 1) Creo el usuario
      await register({ email, password });

      // 2) Auto-login para entrar directo al panel
      await login({ email, password });

      setOkMsg("¡Usuario creado! Entrando al panel...");
      navigate("/panel", { replace: true });
    } catch (err) {
      setError(err?.message || "No fue posible registrar el usuario.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-wrap" aria-labelledby="register-title">
      <section className="auth-card">
        <h1 id="register-title" className="auth-title">
          Crear cuenta
        </h1>
        <p className="auth-subtitle">
          Regístrate para gestionar el inventario de la droguería.
        </p>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {okMsg && (
          <div
            className="small"
            role="status"
            style={{ marginTop: 6, color: "var(--primary-600)" }}
          >
            {okMsg}
          </div>
        )}

        <form
          onSubmit={onSubmit}
          style={{ display: "grid", gap: 12, marginTop: 12 }}
          noValidate
        >
          <label htmlFor="register-email">Correo</label>
          <input
            id="register-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="register-password">Contraseña</label>
          <input
            id="register-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />

          <label htmlFor="register-confirm">Confirmar contraseña</label>
          <input
            id="register-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="btn btn--primary"
            aria-busy={loading}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <p className="small" style={{ marginTop: 12 }}>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="link">
            Inicia sesión
          </Link>
        </p>
      </section>
    </main>
  );
}
