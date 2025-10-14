const API = import.meta.env.VITE_API_URL;

export async function apiFetch(path, { method="GET", body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.detail || data.message || "Error de servidor";
    throw new Error(msg);
  }
  return data;
}
