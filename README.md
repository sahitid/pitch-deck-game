# 🃏 PITCH DECK

**A Cards Against Humanity-style multiplayer card game where you combine real startup and tech cards into the most absurd, fundable-sounding pitches imaginable.**

Think **"OnlyFans for LinkedIn for dogs but the founder is 12."**

Played pass-and-play on a single device. 3–10 players. Built as a static web app — no backend, no accounts, just open and play.

---

## How It Works

1. **Each round, one player is the VC Judge** (rotates every round)
2. **Everyone else builds a startup pitch** by combining cards from their hand into the pitch slots:
   - **Slot 1 — The Product:** Pick a product card (e.g., "Uber")
   - **Slot 2 — The Target:** Pick another product OR a market card (e.g., "for astronauts" or "LinkedIn")
   - **Slot 3 — The Twist (optional):** Add a wildcard for chaos (e.g., "but the founder is 12")
   - **Slot 4 — Double Down (optional):** Go all-in with a 4th card
3. **The VC Judge picks the best pitch** — that player earns points
4. **Longer chains = more risk, more reward:**
   - 2 cards → 1 point
   - 3 cards → 2 points
   - 4 cards → 3 points
5. **Most points after all rounds wins**

### Skip & Trade
Bad hand? You can skip your turn to either:
- **Swap** up to 3 cards for new ones
- **Draw 2** extra cards (play with 9 next round)

---

## Card Types

| Type | Count | Color | Examples |
|------|-------|-------|---------|
| **Products** | 134 | Black | Cursor, OnlyFans, Uber, Theranos, FTX, Quibi |
| **Markets** | 109 | White | for dogs, for divorced dads, for people who reply-all |
| **Wildcards** | 100 | Gold | but the founder is 12, and it's literally just email |

**Total: 343 cards**

---

## Tech Stack

- Single-page static web app (HTML/CSS/JS or React)
- Tailwind CSS via Play CDN
- No backend — all game state is in-memory
- Mobile-first, pass-and-play on one device
- Share-to-X feature at game end

---

## Building with Cursor

This repo contains structured prompts designed to be fed into [Cursor](https://cursor.sh) (or any AI code editor) in sequence:

### Prompt Order

| Step | File | What It Does |
|------|------|-------------|
| 1 | `PROMPT.md` | Builds the base game — full game logic, round flow, card mechanics, hand management |
| 2 | `REVISION-PROMPT.md` | Adds slot-based pitch builder, 3–10 player support, 7-card hand, skip/trade mechanic, Tailwind migration |
| 3 | `UI-OVERHAUL-PROMPT.md` | Transforms the UI into a Balatro-inspired green felt poker table aesthetic with tactile cards, fanned hand layout, poker chip scores, warm gold accents |
| 4 | `cards.json` | Card data — 134 products, 109 markets, 100 wildcards |

### Quick Start

```bash
# 1. Create a new project in Cursor
# 2. Paste PROMPT.md as your first prompt → let it build v1
# 3. Paste REVISION-PROMPT.md → applies gameplay + UX fixes
# 4. Paste UI-OVERHAUL-PROMPT.md → applies the Balatro visual overhaul
# 5. Make sure cards.json is in the project root (or embedded in JS)
# 6. Open index.html in a browser and play
```

### Deploying

It's a static site — deploy anywhere:
- **Vercel:** `vercel --prod`
- **Netlify:** drag and drop the folder
- **GitHub Pages:** push to a `gh-pages` branch
- **Cloudflare Pages:** connect the repo

---

## Design Direction

**Balatro-inspired** — green felt poker table, tactile cards with real depth and shadow, warm gold/cream accents, poker chip scores, fanned card hand layout.

The game should feel like a late-night card game with friends, not a web app.

Key visual elements:
- Green felt background with texture and vignette lighting
- Cards with layered box-shadows and warm color tones
- Fanned hand at the bottom with hover-lift interactions
- Poker chip badges for player scores
- Decorative draw piles on the table
- "FUNDED" stamp on winner reveal

---

## Share to X

At game end, players can share their best pitches to X/Twitter with a pre-formatted tweet:

```
🎲 just played PITCH DECK — the startup mashup card game

best pitches:
→ "OnlyFans for LinkedIn but the founder is 12"
→ "Cursor for therapy for dogs"
→ "Robinhood for funerals and a16z already passed"

[winner] won with [X]pts 🏆

play free: [url]
```

---

## License

MIT — do whatever you want with it.

---

*built by someone who has heard "it's like uber but for..." one too many times.*
