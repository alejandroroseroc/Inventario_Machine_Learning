const API = import.meta.env.VITE_API_URL;

function getAccess() {
  try { return localStorage.getItem("access") || localStorage.getItem("token") || ""; }
  catch { return ""; }
}
function getRefresh() {
  try { return localStorage.getItem("refresh") || ""; }
  catch { return ""; }
}

async function doFetch(method, path, body, headers) {
  const isFormData = body instanceof FormData;
  const options = {
    method,
    headers: { ...headers },
    body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
  };

  if (!isFormData && body !== undefined) {
    options.headers["Content-Type"] = "application/json";
  }

  return fetch(`${API}${path}`, options);
}


function firstErrorFromPayload(p) {
  if (!p) return null;
  if (typeof p === "string") return p;
  if (typeof p === "object") {
    if (p.detail) return String(p.detail);
    for (const k of Object.keys(p)) {
      const v = p[k];
      if (Array.isArray(v) && v.length) return String(v[0]);
      if (typeof v === "string") return v;
    }
  }
  return null;
}

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (auth) {
    const t = getAccess();
    if (t) headers.Authorization = `Bearer ${t}`;
  }

  let res = await doFetch(method, path, body, headers);

  // Reintento con refresh si expira
  if (auth && res.status === 401 && getRefresh()) {
    try {
      const r = await doFetch("POST", "/auth/refresh", { refresh: getRefresh() });
      if (r.ok) {
        const j = await r.json();
        if (j?.access) {
          localStorage.setItem("access", j.access);
          headers.Authorization = `Bearer ${j.access}`;
          res = await doFetch(method, path, body, headers); // reintento
        }
      }
    } catch (_) { /* ignore */ }
  }


  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { }
    if (import.meta.env.DEV) console.warn("API error", res.status, data);
    const err = new Error(firstErrorFromPayload(data) || `Error ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

export const http = {
  get: (p, o) => request(p, { ...o, method: "GET" }),
  post: (p, o) => request(p, { ...o, method: "POST" }),
  put: (p, o) => request(p, { ...o, method: "PUT" }),
  patch: (p, o = {}) => request(p, { ...o, method: "PATCH" }), // <- tolera omitir options
  del: (p, o) => request(p, { ...o, method: "DELETE" }),
};

export default http;
