import type { SupabaseClient } from '@supabase/supabase-js';

export async function ensureDefaultFolder(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('collection_folders')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('collection_folders')
    .insert({
      user_id: userId,
      name: 'My Collection',
      is_default: true,
      description: 'Your main collection. Everything saved goes here by default.',
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: retry } = await supabase
        .from('collection_folders')
        .select('id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .maybeSingle();
      return retry?.id ?? null;
    }
    console.error('[ensureDefaultFolder] insert error', error);
    return null;
  }

  return created.id;
}
