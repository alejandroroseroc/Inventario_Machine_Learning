// src/api/http.js
const API = import.meta.env.VITE_API_URL;

function getToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

async function request(path, { method="GET", body, auth=false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  const res = await fetch(`${API}${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined
  });

  // DRF a veces devuelve arrays/obj por campo; parseamos con fallback
  const raw = await res.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

  if (!res.ok) {
    let message = "Error de servidor";
    if (data) {
      if (data.detail) message = data.detail;
      else if (data.message) message = data.message;
      else {
        const firstKey = Object.keys(data)[0];
        if (firstKey) {
          const v = data[firstKey];
          message = Array.isArray(v) ? v.join(", ") : String(v);
        }
      }
    }
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    if (import.meta.env.DEV) console.warn("API error", res.status, data);
    throw err;
  }
  return data;
}

export const http = {
  get:  (p, o) => request(p, { ...o, method:"GET" }),
  post: (p, o) => request(p, { ...o, method:"POST" }),
  put:  (p, o) => request(p, { ...o, method:"PUT" }),
  del:  (p, o) => request(p, { ...o, method:"DELETE" }),
};
