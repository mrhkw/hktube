const RESEND_API_URL = "https://api.resend.com/emails";
const APP_URL = process.env.APP_URL ?? "https://hktube.vercel.app";

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL?.trim() || "";
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && getFromAddress());
}

async function sendEmail(input: { to: string; subject: string; html: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getFromAddress();
  if (!apiKey || !from) return { sent: false as const, skipped: true as const };

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend email failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  return { sent: true as const, skipped: false as const };
}

export async function sendWelcomeEmail(name: string, email: string) {
  const safeName = name.replace(/[<>]/g, "");
  const result = await sendEmail({
    to: email,
    subject: "Welcome to HkTube",
    text: `Welcome to HkTube, ${safeName}! Your account is ready. Visit ${APP_URL} to start watching, create a channel, and publish videos or Shorts.`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;background:#fff;padding:32px"><div style="max-width:560px;margin:0 auto"><h1 style="margin:0 0 16px;font-size:28px">Welcome to HkTube</h1><p style="font-size:16px">Hi ${safeName}, your HkTube account is ready.</p><p style="font-size:16px">Start watching, create your channel, and publish videos or Shorts.</p><p><a href="${APP_URL}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Open HkTube</a></p></div></div>`,
  });
  return result;
}

export async function sendChannelCreatedEmail(name: string, email: string, handle: string) {
  const safeName = name.replace(/[<>]/g, "");
  const safeHandle = handle.replace(/[^A-Za-z0-9_]/g, "");
  return sendEmail({
    to: email,
    subject: "Your HkTube channel is ready",
    text: `Your HkTube channel @${safeHandle} has been created. Visit ${APP_URL}/profile to manage it.`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111;background:#fff;padding:32px"><div style="max-width:560px;margin:0 auto"><h1 style="margin:0 0 16px;font-size:28px">Channel created</h1><p style="font-size:16px">Hi ${safeName}, your channel <strong>@${safeHandle}</strong> is ready.</p><p><a href="${APP_URL}/profile" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700">Open Creator Profile</a></p></div></div>`,
  });
}
