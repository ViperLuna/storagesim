# StorageSim — Design Doc

> Living document. Captures what's been **locked** in RoundTable (RT) discussions.
> Numbers marked *placeholder* are for tuning once the game is playable.

## Elevator pitch

An idle self-storage empire on an expandable grid. Place storage units, keep
their doors reachable from the gate, rent them to picky (and sometimes cheap)
tenants, click to collect rent, grow the lot, and eventually rebirth (prestige)
to unlock more.

## Platform & tech

- **React + Vite + TypeScript**, deployed to **GitHub Pages** via GitHub Actions.
  - Vite `base` must be set to `/storagesim/` for Pages.
- **PC first, mobile-ready:**
  - Input via **Pointer Events** (mouse/touch/pen share one path). No HTML5 drag-and-drop API.
  - **Game logic is plain TypeScript, separate from React** (e.g. `canPlace(grid, item, x, y)`).
    UI only renders state and calls logic.
  - Grid scales to the viewport; no fixed pixel layouts.
  - PC: side panel menus. Mobile (later): bottom tab bar + slide-up sheets.
- Rendering: DOM / CSS Grid. Colored shapes with text until real art exists.
- State: Zustand (tentative) + localStorage save. No backend.

## The grid

- Starts small, expands over time (expansion model: **TBD**).
- Has a **gate / main entrance** tile — the root of all access.
- Walkways are **just empty tiles**. No path tiles to build.

## Placement (sandbox)

- Everything placed via a **ghost** that follows the cursor:
  - 🟩 **Green** — fits (on grid, no overlap)
  - 🟥 **Red** — off grid or overlapping
- Ghost shows a **door arrow** so you can see facing. It does **not** warn about
  access — the game lets you screw up (RollerCoaster Tycoon style).
- **R** rotates (mobile: rotate button). Rotation changes door direction.
- **Esc cancels** any placement/move/upgrade — nothing changes.

### Tools

| Action | Behavior |
|---|---|
| **Place** | Buy from Build menu → ghost → click to place. |
| **Move** | Pick up existing item → ghost (old spot counts as free) → drop, or Esc to snap back. **Free.** Occupied units move with the tenant (timer pauses while held). |
| **Sell** | Partial refund (*placeholder:* 50%; idea: 100% within a short "oops" window). Selling an occupied unit = **eviction** (confirm popup, reputation hit). |
| **Upgrade** | Upgraded version becomes a ghost (old footprint counts as free) → place anywhere valid → old one removed, pay the difference. Esc = no change. |

## Access / pathing

- Every unit has a **door on one side**.
- A **flood fill (BFS) from the gate** across empty tiles marks reachable tiles.
- A unit is **accessible** if the tile outside its door is empty **and** reachable.
- Re-evaluated whenever the grid changes (placing one thing can cut off others).
- **Inaccessible units stop earning** and their tenant complains (see Tenants).
- Signs and anything else can block paths. Player's problem.

## Storage units & economy

Rule: **bigger units cost more, take longer per point, pay more per point, and
earn more per hour — and more per tile.** A grid of lockers must never beat big units.

A **point** = one payout, when a unit's timer hits zero.

| Unit | Size | Timer | Payout | $/sec | $/sec/tile |
|---|---|---|---|---|---|
| Locker | 1×1 | 10s | $10 | 1.0 | 1.0 |
| Small | 1×2 | 30s | $72 | 2.4 | 1.2 |
| Medium | 2×2 | 90s | $540 | 6.0 | 1.5 |
| Large | 2×3 | 4 min | $2,592 | 10.8 | 1.8 |
| XL | 2×4 | 10 min | $10,560 | 17.6 | 2.2 |

*All placeholder.* Actual rent per point is set by the tenant's accepted bid (see below);
the table is the "list price" baseline.

## Collecting

- **Click to collect** rent when a unit's point is ready.
- A **Manager** (hired employee) automates collecting later.
- **Employees are paid per minute** and must be tunable so you still profit while paying them.

## Offline

- Time keeps running while away. On return, the game **simulates** what happened:
  - Leases progressed; tenants **renewed**, **vacated** (lease done), or **abandoned**.
  - Rent **accumulates** for every point a tenant was actually present.
- You still **click to collect** the accumulated rent when you're back
  (so refreshing / going offline is not a shortcut).
- Blocked-door units earn **no rent** offline either — and the tenant will likely rage-quit before you're back.
- You may return to all-vacant, all-occupied, or a mix.

## Tenants

### Prospects (arrivals)

- Spawn on a **random timer**. Slow with no advertising.
- Arrival shows a **toast** in a screen corner (click → opens Tenant menu).
  If the Tenant menu is already open, they just appear in the list live.
- Each prospect has:
  - a **wanted unit size**
  - a **bid** (price per point) — some bids are garbage. That's life.
- Player options:
  - **Accept** — assign to a vacant unit of that size at their bid.
  - **Upsize** — offer a bigger vacant unit at their bid. Tenant may **accept or refuse**.
  - **Decline** — they leave. **No penalty.** Just wait for the next spawn.
- No haggling / counter-offers.

### Security deposit

- Paid **up front** when a tenant moves in (instant cash on accept).
- Amount **varies per customer**; shown alongside their bid in the Tenant menu.
- Refund rules: **TBD** (see open questions).

### VIP tenants

- Rarer prospects who **bid higher** and pay **bigger deposits**.
- Visually distinct (e.g. gold toast / badge).
- Spawn odds possibly tied to reputation / sign tier (**TBD**).

### Leases

- Lease length is measured in **points** (`n` payouts).
- At lease end the tenant either **renews** or **vacates** (packs up, unit goes vacant).
- Some tenants **abandon**: stop paying and leave their stuff behind.

### Complaints

- A tenant whose door is unreachable → **timer pauses** and they complain:
  1. "Dillon A. can't get to his storage unit."
  2. "Dillon A. is VERY annoyed he can't reach his unit."
  3. "Dillon A. has moved out. 😡" → unit vacant, **reputation** hit.
- Clicking a complaint **jumps to and highlights** the unit.
- Names: first name + last initial, with the occasional pun tenant.

### Reputation

- Hurt by evictions and rage-quits. Affects prospect spawn speed / bids (details TBD).

## Advertising (signs)

- **One sign per plot.** It sits on the grid, eats real estate, and can block paths.
- Placed anywhere empty.
- Bigger sign = faster prospect spawns. Change via **Upgrade** or **Sell + rebuy**.

| Sign | Size | Spawn rate |
|---|---|---|
| None | — | 1× |
| Small | 1×1 | 1.5× |
| Medium | 1×2 | 2.25× |
| Billboard | 2×3 | 3.5× |

*Placeholder.*

## Menus (draft)

- 🏗️ **Build** — units, signs
- 🧍 **Tenants** — waiting prospects, current tenants & status
- 💰 **Finances** — income/sec, history, per-unit breakdown
- ⬆️ **Upgrades** — managers/employees, boosts
- 🔁 **Prestige** — later
- 📜 **Message log** — every toast, scrollable
- ⚙️ **Settings** — save/export, sound

More to come as RT continues.

## 🅿️ Parked (later)

- **Prestige / rebirth** — what resets, what persists, what unlocks. (Viper thinking on it.)
- **Grid expansion** model (buy chunks vs grow rows/cols).
- **Abandoned units → auctions** (Storage Wars-style random loot).
- Lease length ranges & renew/abandon odds.
- Other complaint types (dirty units, break-ins → cameras/fences).
- Non-grid advertising (newspaper/radio/online) as prestige unlocks.
- Other employees beyond Manager.

## ❓ Open questions

- Security deposit: refunded when a lease ends normally? Kept on abandonment? Refunded on eviction?
- VIP odds: flat rare chance, or boosted by reputation / sign tier?

- Online timer behavior when a point is ready but uncollected — see RT note on
  refresh exploit (units stall vs keep accumulating).
