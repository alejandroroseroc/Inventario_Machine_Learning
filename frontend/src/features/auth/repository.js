// src/features/auth/repository.js
import { AuthAPI } from "./api";

export const AuthRepository = {
  async registerUser({ email, password }) {
    await AuthAPI.register({ email, password });
    return { ok: true };
  },

  async loginUser({ email, password }) {
    const dto = await AuthAPI.login({ email, password });
    // Acepta distintos nombres de campos desde el backend
    const access  = dto?.access || dto?.access_token || dto?.token || "";
    const refresh = dto?.refresh || dto?.refresh_token || "";
    const user    = dto?.user || null;

    if (!access) throw new Error("Login sin access token");
    return {
      token: access,
      refresh,
      user: user ? { id: user.id, email: user.email } : null,
    };
  },

  async getMe() {
    const u = await AuthAPI.me();
    return { id: u.id, email: u.email };
  },
};
