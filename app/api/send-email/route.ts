import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Escape HTML to prevent XSS / email injection
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: Request) {
  // Guard: ensure server env is configured
  if (!process.env.RESEND_API_KEY) {
    console.error('[send-email] RESEND_API_KEY is not set');
    return Response.json({ error: 'Email service is not configured.' }, { status: 500 });
  }

  const supportEmail = process.env.SUPPORT_EMAIL;
  if (!supportEmail) {
    console.error('[send-email] SUPPORT_EMAIL is not set');
    return Response.json({ error: 'Email service is not configured.' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { name, text, fromEmail } = body;

    // ── Field presence validation ──────────────────────────────────────────
    if (!name || typeof name !== 'string' || !text || typeof text !== 'string') {
      return Response.json({ error: 'Missing required fields: name and text.' }, { status: 400 });
    }

    // ── Field length limits ────────────────────────────────────────────────
    if (name.trim().length < 2 || name.trim().length > 100) {
      return Response.json({ error: 'Name must be between 2 and 100 characters.' }, { status: 400 });
    }
    if (text.trim().length < 5 || text.trim().length > 2000) {
      return Response.json({ error: 'Message must be between 5 and 2000 characters.' }, { status: 400 });
    }

    // ── Sanitize all user input before embedding in HTML email ─────────────
    const safeName = escapeHtml(name.trim());
    const safeText = escapeHtml(text.trim());
    const safeFromEmail = fromEmail && typeof fromEmail === 'string'
      ? escapeHtml(fromEmail.trim())
      : null;

    const data = await resend.emails.send({
      from: 'Broadcast Hub <onboarding@resend.dev>',
      to: supportEmail,
      subject: `New Message from ${safeName}`,
      replyTo: safeFromEmail || undefined,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:24px;">
          <h2 style="color:#1e3a5f;">New Message from Broadcast Hub</h2>
          <hr style="border:1px solid #e2e8f0;" />
          <p><strong>Name:</strong> ${safeName}</p>
          ${safeFromEmail ? `<p><strong>Email:</strong> ${safeFromEmail}</p>` : ''}
          <p><strong>Message:</strong></p>
          <blockquote style="border-left:4px solid #3b82f6;padding-left:12px;color:#334155;">
            ${safeText}
          </blockquote>
          <hr style="border:1px solid #e2e8f0;" />
          <p style="font-size:12px;color:#94a3b8;">Broadcast Hub – automated notification</p>
        </div>
      `,
    });

    return Response.json({ success: true, id: data.data?.id });

  } catch (err) {
    // Log full error server-side only; return generic message to client
    console.error('[send-email] Unexpected error:', err);
    return Response.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 });
  }
}