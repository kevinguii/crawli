# Idea triage and hooks

**Built:** 2026-08-20 · **TikTok only** — IG Reels and YouTube Shorts are straight
reposts of whatever ships here (F16b), so every hook below is written and evaluated
for TikTok specifically.

**This is your checkpoint.** Read the hooks before anything ships.

Every idea is scored against `profile.md` (does it match the person defined there —
"someone who knows what they want and is being failed by the platform's own
search/pricing," not a buyer/reseller label) and `COMPETITIVE_POSITIONING.md` §6b
(the claim ledger — a hook resting on a non-Validated or Falsified claim gets
flagged, not quietly shipped).

---

## Part 1 — Triage of the existing backlog

Your ~25 ideas plus the feedback notes, sorted into four buckets. "X"-marked ideas
in your original list (tried a version, no real hook attempt) are triaged for a
rehook, not treated as already covered.

### KEEP — full hook treatment this batch (Part 2 below)

| Idea | Why it survives | Claim check |
|---|---|---|
| **Sold comps vs. asking prices** (new, sourced from language-file §1) | This is literally this audience's own argument, word for word, unprompted, upvoted. Zero rehook needed on the concept — the corpus already wrote the thesis | C1 (Grailed + Poshmark only, never Mercari, never a blended price) |
| **Copy their style, find the real price** (your "seeing an image of a person wearing something cool" idea) | Matches `profile.md`'s defining moment exactly — someone who already knows what they want, failed by one platform's search | C1, C4 |
| **Pure feature demo — search → sold comps → flip calc** (your "real walkthrough, no voiceover" + "flip margin calculator wow moment" ideas, merged) | Show-don't-tell is this audience's preferred register — language-file §3/§5 show they trust specific/checkable claims over hype | C1, C5 |
| **Fees, explained with real numbers** (your existing script, already posted 2026-08-11/12) | Already has a real script and a real (if modest) post to build from — lowest lift, good baseline to test a sharper hook against the same content | Fee figures only — verify current before reposting, `lib/marketplaceFees.ts` "verified 2026-06-28" is 2 months stale |

### NEEDS REWRITE — concept is good, framing has a problem

| Idea | Problem | Fix |
|---|---|---|
| "Your reselling business isn't taking off... you don't have the right tools to **source and list correctly**" | Not an overclaim once corrected: Crawli doesn't post or crosslist a listing, but sold comps + flip margin (C1, C5) directly inform the price and platform you list on — that's real listing input, not just sourcing | Keep both, but be precise: "the tools to know what to charge when you list," not "list for you" |
| "Your product isn't the reason your stuff isn't selling, **your audience is**" (Depop vs Grailed example) | Crawli doesn't tell you who your audience is on a platform. It shows what things sold for. | Rescope from an audience claim to a price-per-platform claim: same item, different sold price on different platforms — that's C1-safe |
| "POV: you finally see all your resale options in one place" (already posted) | "all your resale options" is marketing language — language-file's own distrust trigger #3 | Replace with their actual words: "I stopped using the app's search and just check it myself now" register |
| 10/10 tools listicle (eBay app, Crawli, Voodoo, thermal printer) / 4-tools listicle (Trends, Lens, sold listings, Crawli) | Not broken, just not this batch — good format (multi-tool, not a hard sell) but lower evidence-priority than the four above | Good next-batch candidate, not dropped |
| "search/alerts" (too vague as stated) | No specific angle | Now has one: F12's alert-matching fix is a real, recent, honest hook — "alerts that actually find your thing now" — next-batch candidate once F12's fix has a few days of real matches behind it to show, not fabricate |

### LOWER PRIORITY — real ideas, wrong shape for a single-hook test

Format commitments (a series, a recurring cadence, a pinned reference post), not a
single creative decision to A/B. Worth doing once the format-level hooks below have
a result to build a cadence around, not before.

- Day 1/30 challenge series
- "Best Crawli finds of the week" (recurring format)
- Official release / pinned reference video (3-months-building recap)

### DROP

| Idea | Why |
|---|---|
| Generic founder-led "what the product does" explainer with no specific hook | Already tried in a version (your PAST list), underperformed, and a plain feature-dump is marketing language — exactly what language-file §3 flags as a distrust trigger |
| "I made a website... for people trying to impress their crush" | No evidence anywhere in the corpus or telemetry supports this angle. A campy tangent isn't worth the slot next to four ideas that are directly evidenced |
| Long hard-sell script ("you're gonna miss out on thousands in profits... if you don't") | Hypey, unfalsifiable, and leads with reseller framing exclusively — contradicts `profile.md`'s central finding that the axis isn't buyer-vs-reseller |
| "Funny collections vid, making fun of the dude" | Not enough context in the brief to score this one — flagging rather than guessing at what it means |
| "How to price secondhand clothes" / "best sites for secondhand fashion" (SEO/blog ideas) | Out of scope by standing instruction — `COMPETITIVE_POSITIONING.md` §5 Step 3: "stop writing blog posts." Not a judgment call, a rule already in force |

---

## Part 2 — Hooks

Four ideas, 15 hooks each, mixing the article's five types (a specific number ·
a named mistake · a contradiction of a belief · a plain result · a question they
can't answer). Written in the corpus's language, not marketing language — every
hook is checked against a phrase or pattern that actually appears in
`language-file.md`.

**On tone: per F16b/D2, both a soft and an explicit-CTA variant get tested — this
is the logged experiment (Part 3).** Ranked top 3 per idea, with reasoning.

---

### Idea E — Sold comps vs. asking prices

**The pitch:** the corpus already wrote this thesis (language-file §1's "asking
prices are not comps... sold comps expose the truth" thread, and the "if an item
shows up between two sold prices, the seller took an offer between them" detail).
The hook is showing that logic applied live to a real item.

**Cover concept:** split screen, left = an asking-price listing at a high number,
right = the same item's actual sold price, lower. No text overlay needed beyond the
two numbers — the gap IS the hook, per the article's "make someone ask a question
they need the answer to" rule.

| # | Type | Hook | Promise | Can Crawli deliver it? |
|---|---|---|---|---|
| 1 | number | "This listing says $180. It's never sold for more than $95." | shows a real gap between ask and sold | ✅ if the comp is real and current |
| 2 | mistake | "The mistake everyone flipping makes: checking the asking price instead of the sold price." | names a specific, common error | ✅ — this is literally C1's thesis |
| 3 | contradiction | "Active listings are not comps. Nobody tells you that." | contradicts a common (wrong) belief | ✅, and it's their own phrase |
| 4 | plain result | "I checked what this actually sold for on two platforms before I paid for it." | states an outcome, not a promise | ✅ |
| 5 | unanswerable | "How do you know if $180 is a real price or just a hopeful one?" | poses a question the viewer can't answer alone | ✅ — pays it off with sold data |
| 6 | number | "One item, two platforms, a $240 difference in what it actually sold for." | specific number, cross-platform | ✅, C1-safe wording ("what it sold for" only true for Grailed, not Poshmark — see flag below) |
| 7 | mistake | "Don't trust a listing price. Trust what it sold for last week." | | ✅ |
| 8 | contradiction | "Everyone prices off what they WANT. This is what people actually PAID." | | ✅ |
| 9 | plain result | "Sold for $95. Not $180. Not $150. $95. Here's how I knew." | | ✅ |
| 10 | unanswerable | "If a seller took an offer, would you even know?" | | ✅ — pays off with the "sold between two prices = offer accepted" detail |
| 11 | number | "5 items I checked this week. 4 of them never sold anywhere near the asking price." | | ✅ if real |
| 12 | mistake | "I almost paid $180 for this. Then I checked what it actually sold for." | | ✅ |
| 13 | contradiction | "The listing isn't lying. It's just not telling you the whole story." | | ✅ |
| 14 | plain result | "Same jacket. Sold for $95 on one site. Never sold at all on another." | | ✅ |
| 15 | unanswerable | "What did this actually go for? Not what's it listed for — what did it SELL for?" | | ✅ |

**⚠️ Wording flag on #6 and any hook using "actually sold for":** C1 forbids that
exact phrasing for Poshmark (accepted offers are hidden, so "what it actually sold
for" is only true of Grailed). Every hook above using that phrase must cite a
Grailed example, or be reworded to "the completed-sale price" for a Poshmark example.

**Top 3, ranked:** #3 ("Active listings are not comps. Nobody tells you that.") —
it's their own words verbatim, states a fact not an opinion, and creates the
question the video answers. #1 (the two-number split) — the article's own rule that
the image should make someone ask a question, and a number gap does that without any
copy. #10 (offer-accepted question) — teaches something genuinely non-obvious even
to someone who already checks sold prices, so it doesn't feel like beginner content.

---

### Idea B — Copy their style, find the real price

**The pitch:** `profile.md`'s defining moment — someone saw a piece, wants it or
wants to copy it, and the platform's own search fails them. Streetwear/Y2K register
per the actual query language (F2c): Bape, Stussy, YZY, not "vintage fashion."

**Cover concept:** the outfit/piece photo itself as the cover (no product UI), text
kept out of the bottom ~20%/right ~15% per the TikTok-UI constraint already in
CLAUDE.md. First frame answers nothing — it's the "how do I get this" question.

| # | Type | Hook | Promise | Can Crawli deliver? |
|---|---|---|---|---|
| 1 | unanswerable | "Saw this fit. Had no idea what it actually cost anywhere." | | ✅ |
| 2 | mistake | "I used to search one app at a time for this. That's the mistake." | | ✅ |
| 3 | number | "Checked 8 sites for this jacket. Found it $60 cheaper on the 6th one." | | ✅ if real, keep the exact platform count honest |
| 4 | contradiction | "The app's own search couldn't find it. Google could." | | ✅ — matches language-file §2's actual workaround, verbatim |
| 5 | plain result | "Found the exact jacket. Not something similar. The exact one." | | ✅ |
| 6 | unanswerable | "You've seen the fit. Do you know what it actually costs?" | | ✅ |
| 7 | number | "One search. 8 marketplaces. The cheapest one wasn't the one I expected." | | ✅ |
| 8 | mistake | "Searching Depop's own search bar for this is the slow way." | | 🟡 platform-naming risk — keep generic ("the app's own search") to avoid singling out one platform unless it's demonstrably true that day |
| 9 | contradiction | "I thought Depop would have it cheapest. It didn't." | | 🟡 same flag as #8 |
| 10 | plain result | "Same piece, 3 platforms, 3 different prices. Picked the real one." | | ✅ |
| 11 | unanswerable | "Where do you even start looking for something this specific?" | | ✅ |
| 12 | number | "This exact piece exists on 4 different sites right now, for 4 different prices." | | ✅ |
| 13 | mistake | "Don't screenshot it and forget. Search it once, everywhere, right now." | | ✅ |
| 14 | contradiction | "I don't use the app's search anymore. I stopped trusting it." | | ✅ — near-verbatim quote from language-file §2 |
| 15 | plain result | "Found it. Not a lookalike. The actual piece, for less." | | ✅ |

**⚠️ Wording flag on #8/#9:** naming a specific platform as "worse" risks being
wrong on a given day (search quality varies) and reads as picking a fight rather
than solving a problem — softer, generic phrasing is safer and still true.

**Top 3, ranked:** #4 ("The app's own search couldn't find it. Google could.") —
this is language-file §2's actual workaround stated as a contradiction, which is
exactly the article's "contradiction of something they already believe" hook type,
and it's true rather than invented. #14 — same source material, plain-result framing,
strong as a caption under a demo. #1 — the cleanest unanswerable-question opener,
pure curiosity, no claim to defend.

---

### Idea C — Pure feature demo: search → sold comps → flip calculator

**The pitch:** show, don't tell. Language-file §5's distrust-trigger analysis says
this audience responds to specific, checkable claims over hype — a real screen
recording is the most checkable claim there is. Your own note flags the flip
calculator specifically as "a screen-recordable wow moment."

**Cover concept:** a single frozen frame of the flip-calculator result (net
profit/margin numbers visible, real data) — per the article's "two seconds to make
someone ask a question" rule, the number itself is the hook.

| # | Type | Hook | Promise | Can Crawli deliver? |
|---|---|---|---|---|
| 1 | plain result | "One search. Every marketplace. No tabs." | | ✅ — matches C4 |
| 2 | number | "This took 40 seconds. Search to margin." | | 🟡 — time claim, must be genuinely re-timed on camera, not asserted |
| 3 | mistake | "Stop pricing your flips off a gut feeling." | | ✅ |
| 4 | contradiction | "You don't need 6 tabs open. You need one search." | | ✅ |
| 5 | unanswerable | "How much would you actually make on this flip? Watch." | | ✅ — pays off with the calculator |
| 6 | plain result | "Search. Sold price. Margin. In that order, one screen." | | ✅ |
| 7 | number | "$14 sourcing cost. Here's exactly what's left after every fee." | | ✅ if using real numbers on camera |
| 8 | mistake | "The mistake: pricing to sell fast instead of pricing to actually profit." | | ✅ |
| 9 | contradiction | "This isn't a listing price calculator. It's a 'did I actually make money' calculator." | | ✅ |
| 10 | unanswerable | "Is this flip actually worth it, after every platform fee?" | | ✅ |
| 11 | plain result | "No voiceover. Just watch what it actually does." | | ✅ — matches your own "no voiceover, just sound" note |
| 12 | number | "9 marketplaces. 1 search bar." | | ✅ |
| 13 | mistake | "Guessing your margin is how people lose money flipping." | | ✅ |
| 14 | contradiction | "Fees eat more than you think. This shows exactly how much." | | ✅ |
| 15 | unanswerable | "What's actually left after eBay's cut? Poshmark's? Vinted's?" | | ✅ |

**Top 3, ranked:** #11 (no voiceover, just watch) — you already tried this format
once; a plain-result hook that just says "watch" fits it exactly and needs no new
claim. #9 (the reframe from "listing price" to "did I actually make money") — this
is the sharpest, most specific value distinction in the batch and nobody else is
saying it this precisely. #7 (a real number on camera) — the article's "specific
number" hook type done literally, with the calculator as the payoff.

---

### Idea D — Fees, explained (rehook of an existing script)

**The pitch:** you already have a working script and a real (if modest) post —
121 views, 2 likes, 2026-08-12. This isn't a new video, it's a new hook on the same
content, so it's the cleanest A/B in this batch: same script, different opener.

**Fee figures checked 2026-08-20 against `lib/marketplaceFees.ts`
(`FEES_LAST_VERIFIED`): last verified 2026-08-11, 9 days ago — current, no
re-verification needed before reposting. (Earlier in this session I cited a stale
"verified 2026-06-28" figure from a HANDOFF.md excerpt read before the 2026-08-11
Pro-repricing work touched this file — checking the code directly, not the doc,
caught it.)

| # | Type | Hook | Promise | Can Crawli deliver? |
|---|---|---|---|---|
| 1 | number | "Poshmark takes 20%. Vinted takes 0%. Here's every platform, ranked." | | ✅ if figures reverified |
| 2 | contradiction | "Depop advertises 0% commission. It isn't 0%." | | ✅ — matches your own script's actual finding |
| 3 | mistake | "The mistake: comparing sale price instead of what you actually keep." | | ✅ |
| 4 | plain result | "I built the real math into the tool I use to price my own flips." | | ✅ — matches your existing script's closer |
| 5 | unanswerable | "You know the price. Do you know what you actually keep?" | | ✅ |
| 6 | number | "eBay's headline rate is 13.6%. The real number is closer to 14%." | | ✅ if reverified |
| 7 | mistake | "Nobody reads the payment-processing line. That's where the real fee hides." | | ✅ |
| 8 | contradiction | "'0% commission' and '0% fees' are not the same sentence." | | ✅ |
| 9 | plain result | "9 platforms. 9 different real take-home rates. Here they all are." | | ✅ |
| 10 | unanswerable | "Which platform actually takes the biggest cut? Not the one you'd guess." | | ✅ |
| 11 | number | "Poshmark's flat fee changes the math completely under $15." | | ✅ |
| 12 | mistake | "Pricing the same on every platform is a mistake once you see the real fees." | | ✅ |
| 13 | contradiction | "Grailed used to match Poshmark's cut. Not anymore." | | ✅ if still current — reverify |
| 14 | plain result | "As the rates move, this catches it. Here's today's numbers." | | ✅ |
| 15 | unanswerable | "What does each platform actually leave you, on the same $100 item?" | | ✅ |

**Top 3, ranked:** #2 ("Depop advertises 0%. It isn't 0%.") — a specific,
fact-checkable contradiction, and it's the strongest single finding your original
script already contains. #10 — genuine curiosity gap, and the payoff (a platform
most people wouldn't guess) is real if the reverified numbers still support it. #1 —
the cleanest side-by-side, works as a title-card-style opener for the existing
walkthrough footage.

---

## Part 3 — The obfuscation-rule experiment (D2, per §6c requirements)

**Hypothesis:** an explicit CTA / visible brand mention performs at least as well
on comments-per-post as the old obfuscated rule, which produced 0 comments across 55
posts (`GROWTH_PLAN.md` §1).

**Design:** each of the four ideas above ships in two tone variants of its top-ranked
hook — same footage/script, different closing line only:
- **Soft:** no CTA, Crawli named once naturally if at all (closer to the old rule,
  kept as the control since it's the only version with baseline data)
- **Explicit:** plain CTA in the caption or final line, consistent with the August
  2026 founder-led posts that are already outperforming the June motion (F6)

**Kill criterion, written before posting per §6c's own rule:** if the explicit
variant does not beat the soft variant on comments-per-post after both have run
across at least 2 of the 4 ideas, revert to soft-only for anything after that.

**Baseline to beat:** August 2026 founder-led motion — 6 posts, avg 143 views, 2
comments (F6). Not the June 55-post/0-comment baseline, which is a different (already
abandoned) motion.

**To be logged in `COMPETITIVE_POSITIONING.md` §6c** once the first pair actually
posts — not before, since §6c logs experiments as they ship, not as they're planned.

---

## What's deliberately not in this batch

Five ideas from the triage (fees listicle variants, alert-fix hook, and the three
lower-priority series formats) are real and evidenced but held back — writing 15
hooks for nine ideas before any of the first four have a result is exactly the
premature-volume mistake the article warns against ("test two of everything," not
everything at once). They're recorded in Part 1 so nothing is lost, and are the
natural next batch once these four have run.
