# Threads — pending drafts

Drafted via `scripts/post-to-threads.mjs --draft` (2026-07-07), not yet posted. Each entry's caption is what the model actually produced — read it before posting in case it needs a tweak; the "run to post" command re-drafts fresh (captions aren't deterministic) rather than replaying the exact text below, so a quick skim now saves a surprise later.

To post one for real, drop `--draft` from its command. To tweak the caption yourself instead of letting the model redraft, run with `--draft` again, edit, then post manually via Zernio's dashboard or ask to have the script take a literal caption instead of drafting one.

---

## Nike Dunk Low resale price

**Draft:**
```
$7 on Grailed to $46 on Vestiaire for the same shoe
That's a huge difference for Nike Dunk Lows.
If you're reselling, knowing where to list can really change the game.

https://thecrawli.com/blog/nike-dunk-low-resale-price
```

**Run to post:**
```
node --env-file=.env scripts/post-to-threads.mjs \
  nike-dunk-low-resale-price \
  "Nike Dunk Low Resale Price: Cheapest Sites 2026" \
  "\$7 on Grailed to \$46 on Vestiaire for the same shoe" \
  "https://thecrawli.com/blog/nike-dunk-low-resale-price"
```

---

## North Face Nuptse resale price

**Draft:**
```
$31 on Mercari vs $154 on StockX

the cheapest source is almost never the platform people check first

interesting how much prices swing between marketplaces

https://thecrawli.com/blog/north-face-nuptse-resale-price
```
Note: the closing line ("interesting how much prices swing...") reads a little like filler — worth trimming or letting a re-draft try again before posting.

**Run to post:**
```
node --env-file=.env scripts/post-to-threads.mjs \
  north-face-nuptse-resale-price \
  "North Face Nuptse Resale Price: Cheapest Sites 2026" \
  "\$31 on Mercari vs \$154 on StockX - the cheapest source is almost never the platform people check first" \
  "https://thecrawli.com/blog/north-face-nuptse-resale-price"
```

---

## Levi's 501 resale price

**Draft:**
```
Everyday pairs of Levi's 501s run between $9 and $65. But on StockX, deadstock versions of the same jeans can trade for between $320 and $2,073. It's wild how the same model can have such a different market value.

https://thecrawli.com/blog/levis-501-resale-price
```

**Run to post:**
```
node --env-file=.env scripts/post-to-threads.mjs \
  levis-501-resale-price \
  "Levi's 501 Resale Price: Cheapest Sites 2026" \
  "Everyday pairs run \$9-65, but StockX deadstock 501s trade \$320-2,073 - same model name, different market entirely" \
  "https://thecrawli.com/blog/levis-501-resale-price"
```

---

## Already posted (for reference, not pending)

| Slug | Threads URL |
|---|---|
| `best-secondhand-marketplaces-for-luxury-items` | https://www.threads.com/@thecrawli/post/DaeeOEojClE |
| `how-to-identify-vintage-band-tee` | https://www.threads.com/@thecrawli/post/Daf8NNKDQu3 |
| `supreme-box-logo-hoodie-resale-price` | https://www.threads.com/@thecrawli/post/Daf8R4QjcN0 |
