import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'Email not configured.' }, { status: 503 });
  }

  let body: { name?: string; email?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim();
  const message = (body.message ?? '').trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: 'Message too long.' }, { status: 400 });
  }

  const resend = new Resend(resendKey);

  await resend.emails.send({
    from: 'Crawli Contact <noreply@thecrawli.com>',
    to: 'hello@thecrawli.com',
    replyTo: `${name} <${email}>`,
    subject: `Crawli feedback from ${name}`,
    text: [
      `From: ${name} <${email}>`,
      '',
      message,
    ].join('\n'),
  });

  return NextResponse.json({ ok: true });
}
