
function json(res, status, body) {
  res.setHeader("Content-Type", "application/json");
  return res.status(status).send(JSON.stringify(body));
}

function clean(v, max = 500) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function sendNotification(payload) {
  const {
    RESEND_API_KEY,
    RESEND_FROM_EMAIL,
    REQUEST_NOTIFICATION_EMAIL
  } = process.env;

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !REQUEST_NOTIFICATION_EMAIL) {
    console.error("Email notification skipped: Resend environment variables are missing.");
    return;
  }

  const safe = {
    reference: escapeHtml(payload.reference),
    name: escapeHtml(payload.name),
    phone: escapeHtml(payload.phone),
    service: escapeHtml(payload.service),
    date: escapeHtml(payload.preferred_date),
    time: escapeHtml(payload.preferred_time),
    location: escapeHtml(payload.location)
  };

  const emailData = {
    from: RESEND_FROM_EMAIL,
    to: [REQUEST_NOTIFICATION_EMAIL],
    subject: `New OBEY HEALTH WISE Request - ${payload.reference}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px">
        <h2 style="color:#087f72">OBEY HEALTH WISE</h2>
        <h3>New Clinical Service Request</h3>
        <p>A new service request has been submitted.</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><td><b>Reference</b></td><td>${safe.reference}</td></tr>
          <tr><td><b>Client Name</b></td><td>${safe.name}</td></tr>
          <tr><td><b>Phone</b></td><td>${safe.phone}</td></tr>
          <tr><td><b>Service</b></td><td>${safe.service}</td></tr>
          <tr><td><b>Preferred Date</b></td><td>${safe.date}</td></tr>
          <tr><td><b>Preferred Time</b></td><td>${safe.time}</td></tr>
          <tr><td><b>Location</b></td><td>${safe.location}</td></tr>
        </table>
        <p>Please log in to your admin dashboard to review this request.</p>
        <p style="color:#777;font-size:12px">
          This is an automated notification from OBEY HEALTH WISE.
        </p>
      </div>
    `
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend failed (${response.status}): ${error.slice(0, 300)}`);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 503, {
      error: "The request system has not been configured yet. Please contact the service administrator."
    });
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return json(res, 400, { error: "Invalid request data." });
    }
  }

  const name = clean(body?.name, 100);
  const phone = clean(body?.phone, 25);
  const email = clean(body?.email, 150);
  const service = clean(body?.service, 100);
  const date = clean(body?.date, 10);
  const time = clean(body?.time, 40);
  const location = clean(body?.location, 180);
  const notes = clean(body?.notes, 500);

  if (!name || !phone || !service || !date || !location || body?.consent !== true) {
    return json(res, 400, {
      error: "Please complete all required fields and accept the contact consent."
    });
  }

  if (!/^\+?[0-9\s()\-]{7,25}$/.test(phone)) {
    return json(res, 400, {
      error: "Please enter a valid phone number."
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date < new Date().toISOString().slice(0, 10)) {
    return json(res, 400, {
      error: "Please choose a valid date that is not in the past."
    });
  }

  const reference = "OHW-" + Date.now().toString(36).toUpperCase();

  const payload = {
    reference,
    name,
    phone,
    email: email || null,
    service,
    preferred_date: date,
    preferred_time: time || "Any available time",
    location,
    notes: notes || null,
    status: "new"
  };

  try {
    const response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/service_requests`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Database insert failed", response.status, error.slice(0, 300));

      return json(res, 502, {
        error: "We could not save your request. Please try again shortly."
      });
    }

    // Email is sent only after the request has been saved successfully.
    try {
      await sendNotification(payload);
    } catch (emailError) {
      console.error("Email notification failed:", emailError.message);
    }

    return json(res, 201, {
      ok: true,
      reference
    });

  } catch (error) {
    console.error("Request API error:", error.message);

    return json(res, 500, {
      error: "A server error occurred. Please try again."
    });
  }
};
