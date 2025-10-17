// src/features/auth/repository.js
import { AuthAPI } from "./api";

// Mapea DTOs del backend a objetos de dominio (por si cambian mañana)
export const AuthRepository = {
  async registerUser({ email, password }) {
    await AuthAPI.register({ email, password });
    // El BE devuelve mensaje, no hace falta mapear.
    return { ok: true };
  },

  async loginUser({ email, password }) {
    const dto = await AuthAPI.login({ email, password });
    // dto: { access, refresh, user:{id, email} }
    return {
      token: dto.access,
      refresh: dto.refresh,
      user: { id: dto.user?.id, email: dto.user?.email },
    };
  },

  async getMe() {
    const dto = await AuthAPI.me();
    return { id: dto.id, email: dto.email };
  },
};
