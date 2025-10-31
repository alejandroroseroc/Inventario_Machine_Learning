import { http } from "../../api/http";

export function getKpis() {
  return http.get("/panel/kpis", { auth: true });
}
