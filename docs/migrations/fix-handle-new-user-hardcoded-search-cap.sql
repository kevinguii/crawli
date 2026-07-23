-- Fix: the 2026-07-17 fix (fix-free-tier-column-defaults.sql) assumed new
-- signups get max_searches_per_period from the profiles column DEFAULT.
-- That was wrong for this one column: public.handle_new_user(), the
-- Supabase auth trigger that inserts the profile row, hardcoded
-- max_searches_per_period to 3 in its explicit INSERT column list. An
-- explicit value in an INSERT always overrides the column DEFAULT, so
-- raising the DEFAULT to 5 never took effect for this column. The other
-- cap columns (max_saved_searches, native_results_cap, max_tracked_listings)
-- were never in the trigger's explicit column list, so those genuinely did
-- (and still do) fall through to DEFAULT correctly.
--
-- Confirmed via pg_get_functiondef('handle_new_user') on 2026-07-23: 3 users
-- who signed up 2026-07-20 through 2026-07-22 all got max_searches_per_period
-- = 3 instead of the current free tier's 5. Backfilled by hand as part of
-- this fix.
--
-- Fix: drop max_searches_per_period from the trigger's explicit INSERT so
-- it also falls through to the (correct) column DEFAULT, same as its
-- neighbors. Any future TIER_CAPS.free.maxSearchesPerPeriod change now only
-- needs an ALTER COLUMN ... SET DEFAULT on public.profiles, nothing else.

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$function$;
