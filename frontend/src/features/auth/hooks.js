// src/features/auth/hooks.js
import { useState } from "react";
import { AuthService } from "./service";

export function useRegister() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function submit({ email, password }) {
    setError(""); setLoading(true);
    try {
      await AuthService.register({ email, password });
      return { ok: true };
    } catch (e) { setError(e.message); return { ok:false, error:e.message }; }
    finally { setLoading(false); }
  }
  return { submit, loading, error };
}
