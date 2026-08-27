# Implementation Summary: Crawli Shorts Meme Videos

**Three ideas, ready to shoot.** Each lives in its own file with shot lists, scripts, and timing. This doc ties them together and gives you a step-by-step path from here to "posted on Shorts."

---

## The three ideas (quick recap)

| Idea | Format | Runtime | Difficulty | Best for |
|---|---|---|---|---|
| **#1: Workflow Split** (idea-1-workflow-split.md) | Split-screen: chaos vs. calm | 4–5 sec | Low–Med | Proving the pain point is real, showing the payoff |
| **#2: Pricing Reveal** (idea-2-pricing-reveal.md) | Side-by-side: $180 asking vs. $95 sold | 3–4 sec | Low | Pure data hook, no opinions, just numbers |
| **#3: Drake-style** (idea-3-drake-style-comparison.md) | Top/bottom panels: reject vs. approve | 3 sec | Low | Founder personality, meme-native format, fast |

**Recommended shooting order:**
1. **#3 first** (easiest, just you in two poses)
2. **#2 second** (easiest screen recording, one on-camera moment)
3. **#1 last** (most complex, multiple screen recordings + on-camera)

---

## 1-hour pre-production checklist

**Before you shoot anything, do this today:**

### Sourcing (30 min)
- [ ] **For Idea #2:** Pick a real item currently listed on Poshmark/Grailed. Screenshot the asking price. Search it in Crawli. Screenshot the sold comps. (The gap between the two is your hook.)
- [ ] **For Idea #1:** Gather 4–5 real marketplace tabs you'd normally have open (Poshmark, eBay, Vinted, Depop, Grailed). Have them bookmarked and ready to quickly open.
- [ ] **Sounds:** Download one "chaos" sound and one "reveal" sound from YouTube Audio Library or Freesound (use the links in asset-sourcing-guide.md). Save them to your Downloads folder.
- [ ] **Lighting:** Find a spot with natural window light (best for on-camera footage). Test by taking a selfie. If you look good in the selfie, you're golden.

### Gear check (10 min)
- [ ] Phone/camera battery charged
- [ ] QuickTime (Mac) or Xbox Game Bar (Windows) ready to screen-record
- [ ] DaVinci Resolve open and ready to import

### Mental prep (10 min)
- [ ] Read the **on-camera direction** section for each idea. Decide which gestures feel natural to you (e.g., thumbs up vs. hand-to-heart).
- [ ] Pick the idea you'll shoot first (#3 Drake is recommended).

---

## 2-3 hour production workflow

### Phase 1: Shoot on-camera moments (45 min)

**Idea #3 (Drake-style) — START HERE**

1. Set up your camera (phone tripod, or prop your phone against something stable) in good lighting
2. Shoot the **rejection pose** (hand out, head shake, dismissive) — take 2–3 tries
3. Shoot the **approval pose** (thumbs up, nod, or hand to heart) — take 2–3 tries
4. Move the files to a "footage" folder on your desktop

**Idea #2 (Pricing reveal)**

1. Same camera setup
2. Shoot the **shock/surprise reaction** — take 2–3 tries (eyes wide, hand to chest, hold for 2 sec)
3. Move the file to the same "footage" folder

**Idea #1 (Workflow split)** — OPTIONAL FOR THIS SESSION

1. This one has more moving parts (screen recordings, on-camera moments)
2. If you have time, shoot the **overwhelmed** and **satisfied** on-camera moments
3. You can do the screen recordings separately (they're harder to time live)

### Phase 2: Screen recordings (30 min)

**Idea #2 (if not done yet):**
1. Open Poshmark/Grailed to the listing you screenshotted
2. Open Crawli to the search results for the same item (showing sold comps)
3. Use QuickTime or Xbox Game Bar to screen-record both (separately or together)
4. Save as `.mov` (Mac) or `.mp4` (Windows)

**Idea #1 (if doing it this session):**
1. Open 4–5 marketplace tabs (Poshmark, eBay, Vinted, Depop, Grailed) in a browser
2. Screen-record yourself rapidly switching between them, scrolling, opening calculator — looks chaotic (1 min)
3. Then screen-record a clean Crawli search result with the margin calculator visible (30 sec)
4. Save both as separate files

**Idea #3:**
No screen recording needed (unless you want to add a Crawli screen as the final frame).

### Phase 3: Resolve editing (60–90 min)

**Pick one idea and edit it completely** (don't try to do all three at once).

**Recommended first video: Idea #3 (Drake-style)**

1. Open DaVinci Resolve
2. Create a new project (File > New Project) → set resolution to 1080×1350, timeline fps to 30
3. Import your two on-camera clips (rejection + approval)
4. Drag them to the timeline (reject 0:00–1:30, approval 1:30–3:00)
5. Use Fusion or the Edit page to position them top/bottom (see idea-3-drake-style-comparison.md for exact instructions)
6. Add text overlays (File > Add Title):
   - Top text: "Guessing the price and hoping it sells"
   - Bottom text: "Checking what it actually sold for first"
7. Add audio (optional): Drag your "nope" sound to the audio track at 0:00, drag your "approval" sound at 1:30
8. Export: File > Export Video > MP4, 1080×1350, 30fps, quality "Medium"
9. Save as `crawli-shorts-idea-3-drake.mp4`

**If you finish that and have time, move to Idea #2:**

1. Import your screenshot (Poshmark listing) as an image to the timeline
2. Import your screen recording (Crawli sold comps)
3. Position them side-by-side (left = image, right = video)
4. Add text: "$180" on the left, "$95" or "Actually sold for $95" on the right
5. Sync the reveal sound to hit when the right side appears (1:00 mark)
6. Cut your on-camera reaction shot in at 1:50
7. Export as `crawli-shorts-idea-2-pricing.mp4`

---

## Estimated timeline (best-case scenario)

- **Pre-production:** 1 hour (sourcing, gear check)
- **Phase 1 (on-camera):** 45 min for 2 ideas
- **Phase 2 (screen recording):** 30 min for 2 ideas
- **Phase 3 (Resolve):** 90 min for 2 fully polished videos

**Total:** ~3.5 hours to ship 2 complete, polished Shorts videos.

If you shoot all 3 on-camera today and screen-record separately tomorrow, you can edit all 3 tomorrow evening. Flexibility.

---

## File organization (keep this clean)

```
~/Desktop/crawli-shorts-production/
├── footage/
│   ├── idea-3-rejection.mp4
│   ├── idea-3-approval.mp4
│   ├── idea-2-shock-reaction.mp4
│   ├── idea-1-overwhelmed.mp4
│   ├── idea-1-satisfied.mp4
├── screen-recordings/
│   ├── idea-1-chaos-tabs.mp4
│   ├── idea-1-crawli-calm.mp4
│   ├── idea-2-poshmark-listing.png
│   ├── idea-2-crawli-comps.mp4
├── audio/
│   ├── chaos-sound.mp3
│   ├── approval-sound.mp3
│   ├── reveal-sound.mp3
├── resolve-projects/
│   ├── idea-1-workflow-split.drp
│   ├── idea-2-pricing-reveal.drp
│   ├── idea-3-drake-style.drp
└── final-exports/
    ├── crawli-shorts-idea-1.mp4
    ├── crawli-shorts-idea-2.mp4
    ├── crawli-shorts-idea-3.mp4
```

Keep this folder structure and you won't lose any files.

---

## Dos and don'ts (quick reference)

**DO:**
- ✅ Use REAL data (real Poshmark listings, real Crawli results, real items you're actually researching)
- ✅ Test on your phone before uploading (AirDrop the video to yourself, watch it)
- ✅ Keep text out of the bottom 20% and right 15% (Shorts' UI eats that space)
- ✅ Hard-cut between clips (no fancy transitions; Shorts algorithm favors sharp cuts on beat drops)
- ✅ Use trending sounds (audience engagement is higher if you pick a sound people recognize)
- ✅ Sync sound to video (the "reveal" sound should hit exactly when the number appears)

**DON'T:**
- ❌ Fake data or numbers (this audience distrusts hype and unverified claims — profile.md is clear)
- ❌ Use copyrighted music or celebrity clips without license (YouTube Audio Library and Freesound are safe)
- ❌ Overact on camera (authentic > performed; founder-led content is winning per F6)
- ❌ Make multiple edits trying different transitions (hard cuts work; fancy fades don't)
- ❌ Upload without testing on mobile first (desktop exports can look fine but read wrong on a 6-inch screen)

---

## Shortcuts & hacks

**If your on-camera footage has bad lighting:**
- Resolve's color panel has a "Lift, Gamma, Gain" tool that can brighten faces without making them look blown out
- Color > Curves > drag the mid-tones up slightly
- Test on your phone before finalizing

**If your screen recording has bad audio (keyboard noise, fan noise):**
- Mute the video track's original audio (right-click > unlink audio)
- Use your external audio file instead (the sound effects you downloaded)

**If you're not happy with your first take:**
- You have 2–3 other takes in the footage folder
- Drag them into the timeline and compare
- Pick the best one

**If Resolve crashes mid-edit:**
- DaVinci saves auto-backups every 5 minutes
- File > Open Recent > find your auto-saved version
- Save as a new project so it doesn't get overwritten

---

## Success criteria (before posting to Shorts)

- [ ] Video is 3–5 seconds
- [ ] Text reads on a mobile phone (small screen test)
- [ ] Sound syncs with video (reveal sound hits on beat, not before/after)
- [ ] No voiceover (Shorts favors natural sound or silence over talking)
- [ ] Data is real (no faked numbers or listings)
- [ ] Aspect ratio is 1080×1350 (4:5 for Shorts)
- [ ] Looks good in both light and dark mode
- [ ] You've watched it 3 times and you're still happy with it

---

## Next steps after filming

1. **Tonight:** Organize files, do a file backup (copy to an external drive or cloud storage)
2. **Tomorrow:** Do the screen recordings, start Resolve edits
3. **Tomorrow evening:** Finish 2–3 videos, export
4. **Day 3:** Post the first one to YouTube Shorts, monitor engagement (views, comments, shares)
5. **After 48 hours:** Check performance, decide if you want to:
   - Post the second idea as a follow-up
   - Tweak the hook based on comments
   - Move to a different idea entirely

**Log results in `COMPETITIVE_POSITIONING.md` §6c** (the obfuscation-rule experiment tracking sheet) once they post — D2 requires logging what hooks you test and how they perform, not just guessing.

---

## Files in this folder

1. **idea-1-workflow-split.md** — Full shot list, script, Resolve assembly for the chaos-to-calm video
2. **idea-2-pricing-reveal.md** — Full shot list, script, Resolve assembly for the split-screen pricing hook
3. **idea-3-drake-style-comparison.md** — Full shot list, script, Resolve assembly for the reject-vs-approve video
4. **asset-sourcing-guide.md** — Where to find gifs, sounds, stock footage; Resolve shortcuts; file format reference
5. **IMPLEMENTATION-SUMMARY.md** — This file. Your roadmap.

**Print or bookmark this folder.** Refer back to it while shooting and editing.

---

## Common questions

**Q: Can I use one Crawli search for multiple videos?**
A: Yes. If you search for a specific item once and capture the result, you can reuse that screen recording across Ideas #1 and #2 (different angles, different framing).

**Q: What if I don't have good lighting for on-camera footage?**
A: Idea #1 can be shot entirely faceless (just screen recordings + chaos/calm gifs). Start with Ideas #2 and #3 (both need on-camera moments but are short/forgiving). Do #1 last, or skip it for the first round.

**Q: Should I post all three at once or space them out?**
A: Space them out. Post one every 2–3 days. Shorts algorithm treats this as a consistent creator signal (not a one-off spam dump). Log each one in `COMPETITIVE_POSITIONING.md` §6c as you post.

**Q: What if a video tanks (low engagement)?**
A: That's data. Note it. Try a different hook, different sound, or a different idea entirely. The first one is a test. Not every hook lands — that's why the triage picked four ideas.

**Q: Can I use TikTok sounds on YouTube Shorts?**
A: Yes, but cross-platform licensing is messy. Stick to YouTube Audio Library (guaranteed safe for Shorts) or Freesound (Creative Commons, safe for Shorts).

**Q: Do I need to watermark my videos?**
A: No. Shorts has its own attribution. Let the algorithm do its job.

---

## You're ready.

Go shoot idea #3 first. It's the easiest (just you in two poses). You'll have your first Shorts video edited and ready by tonight.
