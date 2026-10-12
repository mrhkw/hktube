const RESEND_URL = "https://api.resend.com/emails";
const APP_URL = process.env.APP_URL || "https://hktube.vercel.app";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const payload = req.body || {};
  const email = payload.user?.email || payload.email || "";
  const emailData = payload.email_data || {};
  const token = emailData.token || emailData.token_new || "";
  const action = emailData.email_action_type || "verification";

  if (!email || !token) {
    return res.status(400).json({ error: "Invalid Supabase Auth hook payload" });
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("[auth-hook] RESEND_API_KEY is not configured");
    return res.status(503).json({ error: "Email provider is not configured" });
  }

  const safeEmail = escapeHtml(email);
  const safeToken = escapeHtml(token);
  const subject = action === "recovery" ? "Your HKW password reset code" : "Your HKW verification code";
  const text = `Your HKW verification code is ${token}. It expires soon. If you did not request this, ignore this email.`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ff;font-family:Arial,Helvetica,sans-serif;color:#171225"><div style="max-width:560px;margin:40px auto;padding:32px;background:#fff;border:1px solid #e9d5ff;border-radius:24px"><div style="font-size:14px;font-weight:800;letter-spacing:.18em;color:#7c3aed">HKW</div><h1 style="margin:18px 0 8px">Verification code</h1><p style="color:#5b5568">Use this code to continue with ${safeEmail}.</p><div style="margin:28px 0;padding:20px;text-align:center;background:#f5f3ff;border-radius:16px;font-size:36px;font-weight:800;letter-spacing:10px;color:#6d28d9">${safeToken}</div><p style="color:#5b5568">This code expires soon. If you did not request it, you can ignore this email.</p><p style="font-size:12px;color:#8b8498">${APP_URL}</p></div></body></html>`;

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL?.trim() || "HKW <onboarding@resend.dev>",
      to: [email],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[auth-hook] Resend failed", response.status, detail.slice(0, 300));
    return res.status(502).json({ error: "Email provider rejected the message" });
  }

  return res.status(200).json({});
}

module.exports = handler;
