# Turnstile CAPTCHA setup — handoff

Status as of 2026-07-12: widget created in Cloudflare, client code shipped
and verified in a real browser on all 3 call sites. **Only Step 3 remains**
(flip the Supabase dashboard switch) — that's the user's step, done outside
a Claude session. Delete this doc once Step 3 is done and a real signup +
sign-in is confirmed working.

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

## What's left: flip the Supabase switch

**Why it matters:** without it, bot signups keep eating the hourly email
budget (now 100/h instead of 30/h, but still finite — and Resend's free tier
caps at 100/day regardless).

### Step 1 — done: Turnstile widget created

Widget "Crawli Auth" created in Managed mode, hostnames `thecrawli.com` +
`localhost`. Site key: `0x4AAAAAAD0FRzkurcIYXA9Q` (already in `.env`). Secret
key is not stored in this repo — you'll need it again for Step 3 below (from
the Cloudflare Turnstile dashboard, same widget, "view keys again").

### Step 2 — done: client code wired + verified

`app/components/TurnstileWidget.tsx` (explicit-render wrapper, single-use
token reset after each submit). Wired into:
- `app/login/page.tsx` — `signUp()` AND `signInWithPassword()`
- `app/check-email/page.tsx` — both `resend()` paths (signup + reset)
- `app/forgot-password/page.tsx` — `resetPasswordForEmail()`
- Google OAuth (`signInWithOAuth`) is exempt by design — no token needed

`npx tsc --noEmit` clean. Verified live in a real browser on all 3 pages
(Managed mode auto-solved, "Success!" shown, submit buttons correctly
gated on token presence). Widget is inert until `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
is set — it now is, so the widget renders, but CAPTCHA isn't enforced
server-side yet (Step 3 not done).

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
