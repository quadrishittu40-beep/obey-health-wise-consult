const crypto = require("crypto");

const COOKIE = "ohw_admin";
const SESSION_SECONDS = 8 * 60 * 60;
const STATUSES = ["new", "contacted", "scheduled", "completed", "cancelled"];

function json(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.status(status).send(JSON.stringify(body));
}

function sha(value) {
  return crypto.createHash("sha256").update(String(value)).digest();
}

function safeEqual(a, b) {
  return crypto.timingSafeEqual(sha(a), sha(b));
}

function sign(payload) {
  return crypto.createHmac("sha256", process.env.ADMIN_ACCESS_KEY).update(payload).digest("hex");
}

function makeToken() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  return `${expires}.${sign("admin:" + expires)}`;
}

function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return "";
}

function validToken(token) {
  const [expires, signature] = String(token || "").split(".");
  if (!expires || !signature || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, sign("admin:" + expires));
}

function authorised(req) {
  if (validToken(readCookie(req, COOKIE))) return true;
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return Boolean(bearer) && safeEqual(bearer, process.env.ADMIN_ACCESS_KEY);
}

function setCookie(res, value, maxAge) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${maxAge}`
  );
}

function parseBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body || {};
}

module.exports = async function handler(req, res) {
  if (!["GET", "PATCH", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH, POST, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  }
  if (!process.env.ADMIN_ACCESS_KEY) return json(res, 503, { error: "Admin access is not configured." });

  // Sign out
  if (req.method === "DELETE") {
    setCookie(res, "", 0);
    return json(res, 200, { ok: true });
  }

  // Sign in
  if (req.method === "POST") {
    const body = parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid request data." });
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || !safeEqual(password, process.env.ADMIN_ACCESS_KEY)) {
      await new Promise((r) => setTimeout(r, 800));
      return json(res, 401, { error: "Incorrect password." });
    }
    setCookie(res, makeToken(), SESSION_SECONDS);
    return json(res, 200, { ok: true });
  }

  // GET and PATCH need a valid session
  if (!authorised(req)) return json(res, 401, { error: "Session expired. Please sign in again." });

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return json(res, 503, { error: "Database is not configured." });
  const base = url.replace(/\/$/, "");

  try {
    if (req.method === "GET") {
      const r = await fetch(
        `${base}/rest/v1/service_requests?select=reference,name,phone,email,service,preferred_date,preferred_time,location,notes,status,created_at&order=created_at.desc&limit=100`,
        { headers: { apikey: secret, Authorization: `Bearer ${secret}` } }
      );
      if (!r.ok) return json(res, 502, { error: "Could not load requests." });
      return json(res, 200, { requests: await r.json() });
    }

    const body = parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid request data." });
    const reference = typeof body.reference === "string" ? body.reference.trim().slice(0, 60) : "";
    const status = body.status;
    if (!reference || !STATUSES.includes(status)) {
      return json(res, 400, { error: "A valid request reference and status are required." });
    }
    const r = await fetch(`${base}/rest/v1/service_requests?reference=eq.${encodeURIComponent(reference)}`, {
      method: "PATCH",
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) return json(res, 502, { error: "Could not update the request." });
    const rows = await r.json();
    if (!rows.length) return json(res, 404, { error: "Request not found." });
    return json(res, 200, { ok: true, request: rows[0] });
  } catch (e) {
    console.error("Admin API error", e.message);
    return json(res, 500, { error: "Server error." });
  }
};
