import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_NAME_LEN = 60;
const MAX_BIO_LEN = 300;

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, string | null> = {};

  if ('display_name' in body) {
    const val = body.display_name;
    if (val !== null && typeof val !== 'string') {
      return NextResponse.json({ error: 'display_name must be string or null' }, { status: 400 });
    }
    const trimmed = val === null ? null : val.trim().slice(0, MAX_NAME_LEN);
    patch.display_name = trimmed === '' ? null : trimmed;
  }

  if ('bio' in body) {
    const val = body.bio;
    if (val !== null && typeof val !== 'string') {
      return NextResponse.json({ error: 'bio must be string or null' }, { status: 400 });
    }
    const trimmed = val === null ? null : val.trim().slice(0, MAX_BIO_LEN);
    patch.bio = trimmed === '' ? null : trimmed;
  }

  if ('avatar_url' in body) {
    const val = body.avatar_url;
    if (val !== null && typeof val !== 'string') {
      return NextResponse.json({ error: 'avatar_url must be string or null' }, { status: 400 });
    }
    patch.avatar_url = val;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id, email, display_name, avatar_url, bio, created_at, updated_at')
    .single();

  if (error) {
    console.error('[/api/profile PATCH] supabase error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
