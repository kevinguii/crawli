import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PLATFORM_DOMAINS } from '@/lib/types';

const ALL_PLATFORMS = Object.keys(PLATFORM_DOMAINS);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const defaultPlatforms = user.user_metadata?.default_platforms ?? null;
  return NextResponse.json({ default_platforms: defaultPlatforms });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  if (!Array.isArray(body.default_platforms)) {
    return NextResponse.json({ error: 'default_platforms must be an array' }, { status: 400 });
  }

  const platforms = body.default_platforms.filter((p: unknown) =>
    typeof p === 'string' && ALL_PLATFORMS.includes(p)
  );

  const { error } = await supabase.auth.updateUser({
    data: { default_platforms: platforms },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ default_platforms: platforms });
}
