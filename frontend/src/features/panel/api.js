import { http } from "../../api/http";

// GET /api/panel/kpis (protegido con JWT)
export async function getKpis(){
  // VITE_API_URL ya debe incluir /api
  return http.get("/panel/kpis", { auth: true });
}
