/**
 * Thin GA4 event wrapper.
 *
 * gtag is loaded in `app/layout.tsx` with `strategy="afterInteractive"` and only
 * when NEXT_PUBLIC_GA_ID is set, so it is absent in local dev and for a beat
 * after hydration in prod. Every call here no-ops safely rather than throwing —
 * analytics must never be able to break a signup or a search.
 *
 * Events fired here still need to be marked as key events in the GA4 UI
 * (Admin → Events) before they show up as conversions in channel reports.
 * See docs/reference/SERVER_REFERENCE.md "GA4 key events".
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Where a primary CTA was clicked. Kept as a union so a typo can't create a
 *  phantom GA4 dimension value that quietly splits the funnel. */
export type CtaLocation =
  | 'nav'
  | 'hero'
  | 'sold_comps'
  | 'flip_calculator'
  | 'cta_section'
  | 'compare_search_miss';

type AnalyticsEvent =
  // Homepage search box. `outcome` distinguishes a catalogue hit from a miss;
  // the miss queries are the compare-item roadmap, so search_term matters most
  // on those.
  | { name: 'hero_search'; params: { search_term: string; outcome: 'match' | 'no_match' } }
  // Any click on the unified "Start comparing free" action.
  | { name: 'cta_click'; params: { location: CtaLocation } }
  // Account created. Google OAuth signups can't be distinguished from returning
  // logins client-side, so this fires for the email path only — use
  // onboarding_complete for a method-agnostic activation count.
  | { name: 'sign_up'; params: { method: 'email' } }
  // Every new account is gated through /onboarding regardless of auth method,
  // so this is the one reliable cross-method activation signal.
  | { name: 'onboarding_complete'; params: { persona: string } }
  // A free user was shown a locked price-intelligence panel. Without this, a null
  // conversion result cannot distinguish "nobody reached the wall" from "the wall
  // does not persuade" — which is exactly the ambiguity that made EXP-002
  // unreadable. Fires once per surface per mount, not per render.
  | { name: 'paywall_view'; params: { surface: PaywallSurface } }
  // Click on an upgrade CTA rendered by a locked panel.
  | { name: 'upgrade_click'; params: { surface: PaywallSurface } };

/** Where a paywall was shown or actioned. Union'd for the same reason as
 *  CtaLocation: a typo must not silently fork the funnel in GA4. */
export type PaywallSurface = 'search_results' | 'price_check' | 'onboarding_tail';

export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', event.name, event.params);
  } catch {
    // Never let a tracking failure surface to the user.
  }
}
