# Audience profile

**Built:** 2026-08-20 · Sources: `AUDIENCE_AND_HOOKS_PLAN.md` F2b/F2c (product
telemetry, 23 onboarded users) + `language-file.md` (1,000 Reddit threads, 10,678
comments). Read `language-file.md` first — every claim here traces back to a
verbatim quote there.

**This is your checkpoint.** Read this before any hook gets written. If it doesn't
sound like someone you recognize from actually running Crawli, say so — the rest of
this program is built on top of it.

---

## The decision this profile forces

Per the article: pick ONE person, not a market. The data argues against picking on
the buyer/reseller axis at all.

**F2c already found it: buyer and reseller queries are indistinguishable** (both
type `brand + garment` — `Stussy crewneck`, `Levi's baggy jeans`). **The Reddit
corpus explains why:** the search-is-bad complaint and the manual
Google-plus-Poshmark-plus-eBay workaround were both found *independently in both
cohorts*. A reseller sourcing to flip and a buyer hunting a piece for themselves hit
the identical wall — a marketplace's internal search is bad, and there is no way to
see what a thing has actually sold for without checking multiple sites by hand.

**So the single person is not "the reseller" or "the buyer." It is defined by the
moment, not the identity: someone who already knows what they want and is being
failed by one platform's search.** Whether they resell it afterward is a fact about
them, not a fact about what they need in that moment.

This resolves the tension in `COMPETITIVE_POSITIONING.md` section 4 without
declaring either reading of section 4's "unresolved tension" correct. It isn't that
buyers were the wrong 36, or that there's no reachable reseller demand. It's that the
axis itself was wrong. **Crawli's actual person is defined by the problem
(fragmented search, opaque pricing), not by their downstream intent (keep it vs.
resell it).**

---

## The person

**Confidence key:** ✅ = directly evidenced in the corpus or telemetry · 🟡 =
inferred, reasonable but not directly stated · ⚪ = a guess, flagged for
verification.

### Demographics

- ✅ Active on Depop, Poshmark, Vinted, r/Flipping, r/reselling. Age skews young
  adult (the streetwear/Y2K vocabulary — Bape, Stussy, YZY, "y2k low rise baggy
  jeans light wash W25" — is a younger register), but no direct age data exists.
  🟡 Roughly 18-32.
- ✅ US and UK/EU mixed — Vinted-specific threads carry £/€ pricing and non-US
  shipping norms natively, and this was not filtered by geography during harvest.
- 🟡 Device: phone-first. The one-second social cost of checking a phone came up
  unprompted in an in-person sourcing context (language-file §2), which only makes
  sense if phone-checking is the default action being interrupted.
- ⚪ Income: not stated anywhere in the corpus. Do not guess a number.

### Psychographics

- ✅ **Wants to know a number is right before acting on it**, not to be told a
  number is right. The entire "asking prices are not comps" thread (language-file
  §1) is one person building an evidence-based argument for *why* sold data beats
  ask data — this is someone who thinks in receipts, not vibes.
- ✅ **Already distrusts the platform's own search** enough to have built a
  workaround by hand (Google + cross-platform checking). This is a person who has
  already tried the free tools and formed an opinion, not someone hearing about the
  problem for the first time from an ad.
- ✅ **Low-grade chronic annoyance, not crisis.** Nearly every quote in language-file
  §3 is exhaustion, not anger — "tired of," "sad watching," "miserable," a resigned
  "yes" to doing a spreadsheet. This is not someone in a moment of acute pain who
  needs rescuing. It's someone doing a repetitive chore who would take a shortcut if
  one existed and were credible.
- ✅ **Afraid of being scammed, but this is NOT Crawli's problem to solve** —
  see the constraint at the end of language-file §5. Scam fear is the loudest single
  emotion in the whole corpus and also the loudest in the older `reddit_research`
  data (F5). Do not build a hook around it; the product cannot pay it off.
- 🟡 Would be embarrassed to admit spending real time on this — "shameless about it"
  (Google-lensing at a garage sale, language-file §2) implies the *default* reaction
  to being caught price-checking is embarrassment, which this person has decided not
  to feel.

### A day in their life — confidence-flagged, not a fabricated hour-by-hour

The corpus does not contain diary-style data, so a fabricated hour-by-hour would be
invented, not evidenced. What IS evidenced:

- ✅ **Phone-checking happens in bursts around a specific find**, not on a fixed
  schedule — someone spotted an item, then immediately cross-references it. The
  "I will hold a conversation with the garage sale owner while using Google lens"
  quote places this in real time, mid-interaction, not as a planned research session.
- ✅ **The daily/weekly admin (spreadsheets, tracking) is done separately and is
  experienced as a chore**, distinct from the in-the-moment lookup. Two different
  modes: fast lookup in the field, slow bookkeeping later.
- 🟡 Scrolls a marketplace app passively (not always searching for something
  specific) and gets ambushed by bad recommendations — the "brands I don't buy... in
  size xs or xxs" complaint (29 upvotes) describes an algorithmic feed failure, which
  implies this happens during idle browsing, not active search.
- ⚪ Time of day, exact routine: not evidenced. Do not invent one.

### What they've already tried, and why it failed

Full detail and quotes in language-file §2. Summary:
- ✅ Manual cross-platform checking (Google + the platform's own listings + eBay) —
  works, but is manual and doesn't scale past a few checks
- ✅ Google Lens / reverse image search in person — works for identification, not
  for pricing
- ✅ Spreadsheets for tracking cost/sale — works, universally described without
  enthusiasm, framed as an obligation ("Should I? Yes.")
- ✅ A named competitor, Flipwise — different job (relisting/inventory), not price
  comparison, so not direct competition but worth knowing it's in this audience's
  toolkit already

### The words they use for the problem — not marketing language

Pulled directly from language-file §1, not paraphrased:
- "asking prices are not comps"
- "sold comps expose the truth"
- "impossible to find anything in the search"
- "I don't use the internal search anymore, I search on Google"
- "sift through... to get to real humans"
- "miserable search function... filling it with nonsense"

**None of these people say "price comparison" or "cross-platform search."** They
describe the failure (bad search, unclear prices) and the workaround (Google, manual
cross-checking), never the category. Copy that leads with "cross-platform price
comparison" is marketing language describing the solution; copy that leads with "the
search on every one of these apps is bad, so I check them all by hand" is their own
words describing the problem. The second is what should open a hook.

### Three things that would make them distrust someone selling this to them

1. **Any claim about scam protection, authentication, or seller verification** —
   Crawli does none of this, and this audience already has sharp, specific triggers
   for spotting a scam pitch themselves (language-file §5: "Friends and Family,"
   "kindly," suspiciously round-cheap prices). A product that claims safety it
   doesn't deliver reads exactly like the sketchy sellers they already know to avoid.
2. **A single blended "best price" claim.** This audience has already articulated,
   unprompted, why one number across platforms is misleading (the sold-vs-asking
   distinction, the "date, condition, shipping... all matter" caveat). Section 6b's
   claim ledger already forbids implying a blended price (C1) — this profile
   confirms that's not just a legal-safety rule, it's something this exact audience
   would call out as B.S. on sight.
3. **Hype language ("game-changing," "the ultimate tool").** Nobody in 10,678
   comments talks like that. This audience communicates in specific, checkable
   claims ("sold for $400 last week," "look at comps, your $200 price is absurdly
   high"). Vague superlatives read as exactly the kind of asking-price inflation
   they've spent this whole corpus learning to distrust.

---

## What this means for the product framing question (Q2)

`AUDIENCE_AND_HOOKS_PLAN.md` Q2 asked whether the product should follow the more
numerous, more engaged buyers (F2b) or keep chasing the underperforming reseller
positioning in `COMPETITIVE_POSITIONING.md` section 4.

**This profile suggests the real answer is: neither framing is what the language
supports.** The product should not lead with "for resellers" (contradicted by F2b's
engagement data) or "for buyers" (contradicted by F2c's identical query shape and
this corpus's identical pain in both cohorts). It should lead with **the specific
moment**: you found something, the platform's own search or pricing isn't giving you
a straight answer, and you want one before you act. That framing is supported by
both engagement data and 10,678 comments of unprompted language, in a way neither
persona label is.

This is a recommendation, not a decision — Q2 stays open for Kevin. But it is now
better evidenced than either alternative in section 4.
