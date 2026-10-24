const BASE = import.meta.env.VITE_API_URL || "";

export function adminHeaders() {
  const pass = sessionStorage.getItem("glow-admin") || "";
  return pass ? { "X-Admin-Passcode": pass } : {};
}

export async function api(path, { method = "GET", body, admin = false, signal } = {}) {
  const headers = { "Content-Type": "application/json", ...(admin ? adminHeaders() : {}) };
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    const err = new Error("Cannot reach the server. If this is the first visit, it may be waking up.");
    err.status = 0;
    err.data = { error: "NETWORK", message: err.message };
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const getServices = () => api("/api/services");
export const getStats = () => api("/api/stats");
export const getConfig = () => api("/api/config");
export const getAvailability = (date, serviceId, excludeId) =>
  api(
    `/api/availability?date=${date}&serviceId=${serviceId}${excludeId ? `&excludeId=${excludeId}` : ""}`
  );
export const createBooking = (payload) => api("/api/bookings", { method: "POST", body: payload });
export const getBooking = (id, phone) => api(`/api/bookings/${id}?phone=${phone}`);
export const patchBooking = (id, body, admin = false) =>
  api(`/api/bookings/${id}`, { method: "PATCH", body, admin });
export const cancelBooking = (id, phone, admin = false) =>
  api(`/api/bookings/${id}/cancel`, { method: "POST", body: { phone }, admin });
export const listBookings = (params) => {
  const q = new URLSearchParams(params).toString();
  return api(`/api/bookings?${q}`, { admin: true });
};
export const todaySummary = () => api("/api/bookings/summary/today", { admin: true });
export const adminLogin = (passcode) => api("/api/admin/login", { method: "POST", body: { passcode } });
export const sendChat = (messages) => api("/api/chat", { method: "POST", body: { messages } });
export const createInvoice = (payload) => api("/api/invoices", { method: "POST", body: payload, admin: true });
export const getInvoice = (id) => api(`/api/invoices/${id}`, { admin: true });
export const health = () => api("/api/health");
