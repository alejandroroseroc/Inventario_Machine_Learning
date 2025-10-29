import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

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
    <section className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Crear cuenta</h1>

      {error && <div className="mb-3 rounded bg-red-100 text-red-700 p-2">{error}</div>}
      {okMsg && <div className="mb-3 rounded bg-green-100 text-green-700 p-2">{okMsg}</div>}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Correo</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoComplete="new-password"
            required
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Confirmar contraseña</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full border rounded px-3 py-2"
            autoComplete="new-password"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>
      </form>

      <p className="text-sm mt-4 text-center">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="text-blue-600 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </section>
  );
}
