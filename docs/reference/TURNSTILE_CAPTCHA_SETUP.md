# Turnstile CAPTCHA setup — handoff

Status as of 2026-07-11: all auth code paths audited and fixed. CAPTCHA is the
one remaining piece, deliberately not started — it needs a Site Key first and
must be sequenced correctly or it breaks all sign-in.

## What's already done (this session)

**Diagnosed:** "slow signup confirmation email" was two Supabase-side issues,
not Resend (Resend delivers fine — verified via Resend logs, all `delivered`):
1. Auth → Rate Limits → email cap was the default 30/h, shared across every
   auth email type. **Raised to 100/h** (saved in dashboard, confirmed).
2. CAPTCHA is disabled, so bot signups (visible in the logs —
   `radiant-flow.org` addresses etc.) burn that hourly budget for free.
   **This doc is that fix.**

**Fixed:** a real dead-end bug found during the investigation — a user with a
Google-only account tried email/password signup, got sent to a "check your
email" screen that could never receive anything (`resend()` silently no-ops
for already-confirmed accounts, still returns success). `app/login/page.tsx`
and `app/check-email/page.tsx` now handle this correctly — verified live in a
browser for all three states (new signup, existing-account signup, password
reset). Full detail: `docs/core/PITFALLS.md` → search "identities:[]".

**All sign-in code paths were re-audited this session** and are correct:
- Email/password signup (new + existing account)
- Google OAuth (new + existing account, including auto sign-in for
  already-linked accounts)
- Password reset / forgot-password (`app/forgot-password/page.tsx`,
  `app/auth/reset-password/page.tsx`) — confirmed via SQL that
  `updateUser({password})` correctly attaches a working password credential
  to an OAuth-only account
- `app/auth/callback/route.ts` — single callback route correctly handles both
  the OAuth code exchange and the email-confirmation code exchange (both use
  Supabase's PKCE `code` param)

None of the above needs further work. **Do not re-litigate the `identities:[]`
signup logic in the next session** — it was rebuilt and verified end-to-end.

## What's left: enable Turnstile

**Why it matters:** without it, bot signups keep eating the hourly email
budget (now 100/h instead of 30/h, but still finite — and Resend's free tier
caps at 100/day regardless).

### Step 1 — you: create the Turnstile widget

1. Go to https://dash.cloudflare.com/?to=/:account/turnstile (free, no need
   for your DNS to be on Cloudflare)
2. **Add widget** → Mode: **Managed** → Hostnames: `thecrawli.com` AND
   `localhost` (so `npm run dev` keeps working)
3. Copy both the **Site Key** (public) and **Secret Key** (private) — you'll
   need both in the next chat

### Step 2 — next chat session: wire the client code

Give Claude the Site Key and Secret Key and say: *"Implement Turnstile CAPTCHA
per docs/reference/TURNSTILE_CAPTCHA_SETUP.md"*. It should:

1. Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to env config, gated so the widget is
   inert if unset (nothing breaks pre-rollout)
2. Add the Turnstile widget + token to **every** call site that will require
   it once enabled — CAPTCHA in Supabase applies per-request, not just to
   signup:
   - `app/login/page.tsx` — `signUp()` AND `signInWithPassword()`
   - `app/check-email/page.tsx` — the `resend()` calls (signup + reset)
   - `app/forgot-password/page.tsx` — `resetPasswordForEmail()`
   - Google OAuth (`signInWithOAuth`) does **not** need a token — it's a
     redirect flow, exempt by design
3. Pass the token via `options: { captchaToken }` on each call (see
   https://supabase.com/docs/guides/auth/auth-captcha for the exact API)
4. `npx tsc --noEmit` clean, then **visually verify in a real browser** —
   don't just trust the typecheck (this project's CLAUDE.md rule)

### Step 3 — you: flip the switch (LAST, only after step 2 ships)

1. Docs: https://supabase.com/docs/guides/auth/auth-captcha
2. Dashboard:
   https://supabase.com/dashboard/project/peyqxfijdrziqfjkxjsn/auth/protection
3. Enable CAPTCHA → Provider: **Turnstile** → paste the Secret Key
4. Test a real signup + a real sign-in immediately after — if the client
   code in step 2 isn't deployed yet, this will break every auth request
   with a missing-captcha-token error

## Reference

- Turnstile client-side rendering guide:
  https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
- Supabase project ID: `peyqxfijdrziqfjkxjsn`
- Rate limits page (already at 100/h, no further action needed):
  https://supabase.com/dashboard/project/peyqxfijdrziqfjkxjsn/auth/rate-limits
