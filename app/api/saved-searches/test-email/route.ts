import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: 'Email not configured on this server.' }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  const email = authUser?.user?.email;
  if (!email) return NextResponse.json({ error: 'No email on file.' }, { status: 400 });

  const resend = new Resend(resendKey);

  const sampleListings = [
    { title: 'Nike Air Jordan 1 Chicago', price: 280, url: 'https://thecrawli.com' },
    { title: 'Supreme Box Logo Hoodie', price: 420, url: 'https://thecrawli.com' },
    { title: 'Levi\'s 501 Vintage Denim', price: 95, url: 'https://thecrawli.com' },
  ];

  const listingLines = sampleListings.map((l) =>
    `• ${l.title}: $${l.price}\n  ${l.url}`,
  ).join('\n\n');

  await resend.emails.send({
    from: 'Crawli Alerts <alerts@thecrawli.com>',
    to: email,
    subject: '3 new matches for "Nike Air Jordan 1" (test email)',
    text: [
      `Hi,`,
      ``,
      `This is a test alert email from Crawli. Here's what a real alert looks like:`,
      ``,
      `Your alert for "Nike Air Jordan 1" found 3 new listings:`,
      ``,
      listingLines,
      ``,
      `View all results: https://thecrawli.com/alerts`,
      ``,
      `Crawli`,
    ].join('\n'),
  });

  return NextResponse.json({ ok: true, sentTo: email });
}
