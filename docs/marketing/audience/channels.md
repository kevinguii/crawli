# Channel ranking

**Built:** 2026-08-20 · Confidence key: ✅ directly measured this session · 🟡
inferred from measured data · ⚪ not verified, flagged rather than guessed.

**What this is NOT:** a subscriber-count leaderboard. Reddit's `.json` API and
rendered subreddit pages both blocked this session (403, then a bot-check page even
via Playwright — see the note at the end). Rather than assert a number I can't back
up, this ranks on **real engagement pulled from the harvest itself**: how many
distinct people are actually posting and replying, and how hot the best threads run.
That is arguably better signal for "will a post here get seen" than a subscriber
count anyway — subscriber counts include everyone who joined once and never
returned.

---

## Reddit subreddits (from the harvest, `AUDIENCE_AND_HOOKS_PLAN.md` F14c)

✅ All numbers below are computed directly from the 1,000-thread corpus already on
disk — not estimated.

| subreddit | threads seen | comments | unique voices | avg comment score | hottest comment | cohort |
|---|---|---|---|---|---|---|
| **r/poshmark** | 257 | 3,338 | 1,663 | 10.7 | 431 | both |
| **r/Depop** | 238 | 2,017 | 1,276 | 14.1 | 1,101 | both |
| **r/malefashionadvice** | 148 | 1,648 | 1,227 | 10.2 | 357 | buyer |
| **r/vinted** | 126 | 991 | 730 | 10.2 | 475 | buyer |
| **r/Flipping** | 116 | 1,844 | 1,081 | 7.0 | 345 | reseller |
| **r/reselling** | 115 | 840 | 564 | 4.5 | 135 | reseller |

**How people talk there** (✅ actual top-voted comment per sub, so this is
observed tone, not a guess):

- **r/Depop:** fast, meme-first, reaction-heavy. Top comment (1,101 upvotes) is
  "following because what the fuck 😭" — pure reaction, no substance, on a thread
  that clearly went viral for drama, not advice.
- **r/vinted:** dry, self-deprecating. Top comment: "I thought I was bad. This is
  not healthy." — people are comfortable admitting a problem out loud.
- **r/poshmark:** sarcastic, quick to mock bad-faith sellers/buyers. Top comment:
  "The authorities! 😂🤣 'Hello, 911, I'd like to report someone who offered me a
  deal on an item they're selling.'"
- **r/Flipping:** drier, more skeptical, closer to a trade-forum register — see
  language-file §1's "asking prices are not comps" thread for the default tone:
  precise, a little pedantic, allergic to hype.
- **r/reselling:** similar register to r/Flipping but noticeably lower engagement
  per thread (avg score 4.5, the lowest of the six) — reads as a smaller, quieter
  room next to r/Flipping's.
- **r/malefashionadvice:** more measured, closer to genuine advice-giving; top
  comment is a real (if blunt) answer to a real question, not a meme.

**What gets removed:** ⚪ **not verified this session.** AutoModerator is active on
at least r/Flipping and likely others (its boilerplate had to be filtered out of
the harvest, language-file build note), which typically means automated
self-promotion and low-effort-post rules, but the exact rule text was not captured
and should not be asserted. **Before posting anything with a product mention in any
of these subs, read that sub's sidebar rules directly — do not rely on this file
for that.**

**Recommendation:** ✅ **r/Flipping and r/poshmark** are the strongest pair.
r/Flipping because it is the reseller-specific corner where the "asking prices are
not comps" register lives natively — it's this audience already thinking the way
the product's core feature works, unprompted. r/poshmark because it has both the
highest raw engagement of the six *and* both cohorts show up in it natively (see
`profile.md`'s finding that the axis isn't buyer-vs-reseller). r/Depop's top-line
numbers are close, but its top-voted content skews toward drama/meme virality
disconnected from anything product-relevant — good for reading sentiment (which the
harvest already did), weaker ground for posting.

**🟡 Ignore, and why:** r/reselling (lowest engagement of the six, and largely
redundant with r/Flipping's audience) and r/vinted (real engagement, but EU-skewed
pricing/shipping norms that don't map cleanly onto a US-first product without
separate copy). r/malefashionadvice is a maybe-later: real engagement, but it's a
style-advice community first, not a marketplace-behavior one, so a Crawli mention
there needs to earn its place with actual styling value, not just be dropped in.

---

## The three channels currently in use

Per `CLAUDE.md`: Instagram, TikTok, YouTube Shorts.

### TikTok — ✅ measured

Full detail in `AUDIENCE_AND_HOOKS_PLAN.md` F6/F7. Summary: `tiktok_performance`
table, synced weekly via n8n, currently healthy (last sync 2026-08-16). August 2026
founder-led motion: 6 posts, avg 143 views, 2 comments — small n, but the first
content in the project's history to visibly move the signup rate (F11: signups
~5x'd in the same window, correlation not proven causation).

### Instagram — ⚪ completely unmeasured

**F7's real finding, worth restating plainly: there is no table for this at all.**
Zero data exists on IG performance, follower count, or whether any post has ever
driven a signup. Not "unmeasured this session" — unmeasured, period, since the
channel started. Any claim about IG's performance would be invented.

### YouTube Shorts — ⚪ completely unmeasured

Same as Instagram. No table, no data, ever. `CLAUDE.md` names Shorts as an active
channel but nothing in the codebase or database captures anything from it.

---

## The recommendation this forces

**You cannot rank three channels when two of them have never produced a single
number.** The article's rule — "pick two and drop the rest" — cannot honestly be
answered as "TikTok is 3x better than IG" or similar, because there is nothing to
compare TikTok against. What can be said:

1. **TikTok is the only channel with any evidence behind it**, and that evidence
   (F11) is the first sign in this project's history that content moves signups.
   Keep it, and keep it as the primary channel for any hook testing in phase 5 —
   it's the only place a result will be measurable.
2. **Before dropping Instagram or Shorts, build the measurement first.** Not doing
   so is the same mistake `GROWTH_PLAN.md` already diagnosed for the June TikTok
   burst: 55 posts run with no UTM/referrer attribution, so the project couldn't
   tell what worked even after the fact. Killing a channel you never measured isn't
   a decision, it's a guess with extra steps.
3. **r/Flipping and r/poshmark** are the two Reddit communities worth testing
   content in, on the engagement evidence above — but see the moderation caveat: verify
   each sub's self-promotion rules directly before posting anything product-shaped.

**This is a recommendation, not the "pick two" the plan called for**, because two of
the three existing channels can't be honestly ranked yet. Flagging that as the real
finding rather than forcing a false-precision pick. **Kevin: does building IG/Shorts
tracking (even lightweight — manual view/like/comment logging, matching
`tiktok_performance`'s shape) happen before or after phase 5's hooks ship?** If
hooks go out on all three channels with no way to read IG/Shorts results, the same
measurement gap repeats.

---

## Note on why subscriber counts aren't in this file

Attempted three ways this session, all didn't pan out, recorded so a future session
doesn't repeat the same three attempts:
1. Reddit's `.json` API — 403 from this machine (already known, F3).
2. A subreddit's rendered HTML page — serves only an empty JS shell over plain
   HTTP; needs a real browser to render.
3. Playwright navigating the real page directly — hit Reddit's bot-check
   ("Prove your humanity") interstitial. Not something to push through.
4. A third-party aggregator (subredditstats.com) via WebFetch — the page's own
   numbers are populated by JS and didn't render in the fetched content; the site
   also self-reports its data may be stale since Reddit restricted the API.

The harvest-derived engagement numbers above are a reasonable substitute and have
the advantage of being first-party and already verified.
