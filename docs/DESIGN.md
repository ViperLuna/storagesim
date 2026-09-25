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
- **Data-driven:** all tunable game content (units, signs, cameras, employees, office tiers,
  rebirth requirements, unlock timeline, tenant names, etc.) lives in plain typed data files
  under `src/data/` — edit numbers there, never hunt through game logic.
- **Debug / tuning panel** (dev-only, hidden from players): tweak data values live while
  playing, plus handy cheats (add money, skip time, spawn prospect, force rebirth) for testing.

## The grid

- Starts small. **Grid size is fixed within a run — the only way to expand is to rebirth.**
- **Each rebirth adds one ring of tiles around the whole perimeter** (N×N → (N+2)×(N+2)).
- The **gate is not a tile** — it sits **on the perimeter** at the bottom-middle edge.
- The **3 bottom-middle tiles** directly inside the gate are **locked** (nothing can be
  placed on them). They're the root of all access — the flood fill starts there.
- On expansion the gate and locked tiles just drop to the new bottom row.
  - Width must be **odd** so the 3 locked tiles sit dead center (ring expansion keeps it odd).

Example layout (7×7), per Viper's sketch — the office is placed by the player, not fixed:

```
. . . . . . .
. . . . . . .
. . . . . . .
. . . . . . .
. . . . . . .
O O . . . . .
O O L L L . .
    ═GATE═
```
`O` = office (2×2), `L` = locked entrance tiles.
- Starting size: **7×7**.
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

| Unit | Size | Timer | Payout | $/hr | $/hr/tile |
|---|---|---|---|---|---|
| Locker | 1×1 | 1 min | $10 | $600 | $600 |
| Small | 1×2 | 3 min | $72 | $1,440 | $720 |
| Medium | 2×2 | 9 min | $540 | $3,600 | $900 |
| Large | 2×3 | 24 min | $2,592 | $6,480 | $1,080 |
| XL | 2×4 | 60 min | $10,560 | $10,560 | $1,320 |

Timers are deliberately slow (even lockers wait a minute) so income ramps up smoothly
as each unit is added.

*All placeholder.* Actual rent per point is set by the tenant's accepted bid (see below);
the table is the "list price" baseline.

## Collecting

- Rent **accumulates on the unit** (💰 counter) — online and offline alike. Timers never stall.
- **Click the unit to collect** its pile into your wallet. (Refreshing gains nothing.)
- When a tenant **vacates**, the unit shows as needing attention: **clicking it collects
  any remaining rent and cleans it out**. It can't be rented again until you do.
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

- **Non-refundable. Never goes back.** It's just money.
- **Deposit = the accepted bid** (one point's rent), paid instantly on move-in.
  - e.g. accept an $11/pt bid → +$11 deposit now, +$11 at the first point = $22 on day one.

### VIP tenants

- **Rare** — gacha-feel. Higher bids (so higher deposits too), gold toast / badge.
- **Better reputation = better VIP odds**, but always rare.
  - *Placeholder:* ~1% at bad reputation → ~5% at max reputation.

### Leases

- Lease length is measured in **points** (`n` payouts).
- At lease end the tenant either **renews** or **vacates** (packs up, unit goes vacant).
- Some tenants **abandon**: stop paying and leave their stuff behind.

### Abandoned units

When a unit is abandoned, you're offered a choice:

- **Fixed sale** — take the offered price now, unit is cleared immediately.
- **Auction** — unit is locked while the auction runs (**duration scales with unit size**),
  then pays out **more or less** than the fixed offer:
  - ~**60%** chance of beating the offer, ~40% chance of coming in under.
  - *Placeholder ranges:* win = 1.1×–2.0× offer, lose = 0.4×–0.9× offer (EV ≈ 1.2×).
  - The real cost is time: the unit can't earn rent while it's up for auction.

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

## Rebirth (prestige)

- Rebirth **resets you to zero**.
- **Every run starts the same:** **$0 cash** and ~**3 cheap storage units** (lockers). No office, no sign, nothing else.
  (Only the grid size and rent multiplier differ.)
- The 3 starting units are **pre-placed in the same pattern every run**, anchored to the gate
  (so the pattern is identical on bigger grids). They can be moved for free like anything else.
  - *Draft pattern:* 3 lockers in a row, centered above the locked tiles with one empty row
    between, doors facing down toward the gate:

    ```
    . . . . . . .
    . . . . . . .
    . . . . . . .
    . . . . . . .
    . . ▼ ▼ ▼ . .
    . . . . . . .
    . . L L L . .
        ═GATE═
    ```
- Each rebirth gives a **bigger grid**.
- **Rent multiplier:** tenants' bids stay in the same familiar range every run
  (keeps things routine), but actual **rent payout is multiplied** by a
  rebirth multiplier that grows each rebirth.
  - e.g. tenant bids $11/pt; at a 1.5× multiplier each point pays $16.50.
- **Requirements stack up each rebirth** (each one pushes a new mechanic):

  | Rebirth | Requirements |
  |---|---|
  | 1st | Money |
  | 2nd | Money + a sign |
  | 3rd | Money + a sign + at least one employee |
  | 4th+ | TBD — more stacked conditions |

  - Money = **cash on hand** at the moment of rebirth. Amount scales per rebirth (math TBD).
  - Maybe a "grid filled" condition — iffy; TBD.
- Still TBD: multiplier curve, what else carries over / unlocks.

## Office

- A structure on the grid — **2×2** for the first office. Holds **1 staff member**.
- **Player-placed** like everything else (sandbox). Move/sell/upgrade rules apply.
- **Staff need an office slot** — no office, no employees.
- The first employee available is the **Janitor**.
- **No office upgrades.** Bigger offices are **new buildings** (costs more) — sell the old
  one and build the new one.
- When security unlocks (~5th rebirth), a **3×3 office** becomes available.
  - Its purpose is **security**: the extra space fits the monitors/computers.
    **Cameras require the 3×3 office** to function.
  - Staff slots: still 1 (TBD). One office per plot (TBD, assumed).
- **Needs an accessible door**, same rule as units. Blocked office = staff can't work.

## Employees

- Hired from the Upgrades menu. Wages paid on an interval (**per minute or every 5 minutes** — TBD).
  Must always be profitable to employ; wages tuned so the math holds.
- **Can't make payroll → staff still get paid and your cash goes negative.**

## Debt, loans & bankruptcy (draft)

- Cash can go **negative** (payroll is the main cause).
- **Bank loan**: a **fixed amount** with **interest**. One loan at a time (assumed).
  - **Grace period:** no payments for the first ~**6 pay periods**.
  - After that, repayment installments are taken **automatically at each payroll** until paid off.
  - Loan amount probably scales with rebirth level (TBD).
- **Bankruptcy = lose the run**: you restart **the current rebirth level** from scratch
  (keep rebirth count / grid size / multiplier; lose everything built this run).
- **Trigger: too many pay periods in the red with no gain.**
  - Each payroll where cash is **below $0 and hasn't improved** since the last payroll = a **strike**.
  - Any payroll where cash went up resets strikes. *Placeholder:* 3 strikes = bankrupt.
  - Big red warning with the strike count (e.g. "⚠️ 2/3 — bankruptcy next payroll").
- **Ways out of the hole:** sell stuff (cameras, units, sign…), **fire staff** (stops their wages),
  or take a loan. Then build income back up before re-expanding.
- **Offline safety:** the offline simulation **pauses payroll once cash hits $0**, so you can wake up
  broke but never bankrupt from sleeping.
- Each employee takes an **office slot**.
- **Leasing Agent** — auto-handles prospects using **player-set rules**:
  - **Minimum bid** (as % of list price, possibly per unit size). Can be set anywhere —
    lenient ("as long as they pay") or so strict that *nobody* ever qualifies. The player
    has to learn what works.
  - **Allow upsizing** yes/no.
  - Prospects that fail the rules are declined (or left for the player — TBD).
  - Works offline too: with a Janitor, vacated units get cleaned and re-rented while you're away.
- **Manager** — auto-collects rent. Pure convenience (rent accumulates anyway), so it comes last.
- **Unlock order (locked):** **Janitor → Security → Leasing Agent → Manager**.
  - Security arrives with the ~5th rebirth (3×3 office, cameras, burglaries).
  - Security is a staff member watching the monitors → 3×3 office needs **2 slots** (Janitor + Security).
  - Agent / Manager unlock rebirths TBD.
- **Janitor** — auto-cleans vacated units (so they're ready to rent again).
  - Shown as a **dot that walks the pathways** (empty tiles) from the office door to the
    dirty unit's door, cleans it, then heads to the next job or back to the office.
  - Uses the shortest path (BFS). Can't reach a unit → can't clean it.
  - **Upgrades:** movement speed, cleaning speed.
  - Job order (nearest vs oldest first) — TBD.
- **Security** — a staff member in the 3×3 office watching the monitors (not visible on the grid).
  Useless without cameras; cameras useless without them. Takes an office slot.

## Electricity (draft)

- **The first 5 storage units run free.** Beyond that you need a **power grid** — a small
  structure placed on the grid (eats real estate, can block paths).
- Power grid provides **capacity**; things **consume** it:
  - Storage units: **1 per tile** (locker = 1, Medium 2×2 = 4, XL = 8).
  - **2×2 office: 5** (a bit more than 1 per tile).
  - **Sign: draws power** (*draft:* 1 per tile).
  - **Cameras: a fraction** (*draft:* e.g. 0.25 each, or per covered tile — TBD).
- The **power grid can be upgraded** for more capacity — each upgrade gets pricier.
  (Upgrade uses the usual ghost flow if the footprint grows.)
- **No utility bill.** Electricity is capacity only; the cost is in buying/upgrading the grid.
- Still TBD: over-capacity behavior (draft: newest units lose power → no rent + complaint),
  whether the office counts against the free allowance.

## Cameras (overlay layer)

- Cameras live on their **own layer above the grid**. They **must be mounted on a
  structure** — only tiles occupied by a structure are valid (ghost is 🟥 on empty tiles).
  They don't eat real estate and never block paths.
- Valid mounts: **storage units and the sign** (the locked entrance tiles have nothing to mount on).
- Cameras are **rotatable** and **see through buildings** — if the FOV reaches a tile, it's visible.
- Lower-tier cameras are low quality: **shorter range and narrower angle**.
- Moving/selling a structure with a camera on it — *tentative:* camera rides along on move;
  selling warns and sells both.
- ⚠️ **WIP** — real camera/burglary functionality still being designed.
- Coverage drawn as a translucent overlay (SVG). Burglaries inside coverage get caught.
- Tiers:
  - **Directional (cone) cameras** — cheaper. Pie-slice field of view, rotated with **R**
    like everything else.
  - **360° (dome) cameras** — upgrade. Full circle radius.
- A tile is covered if its center is within range (and inside the cone angle for directional cameras).
- *Placeholder:* one camera per tile.
- More TBD.

## Unlock timeline (draft)

Rebirths unlock new stuff, not just a bigger grid.

| Rebirth | Unlocks (draft) |
|---|---|
| Start | Begins with ~3 cheap units. Buildable: storage units, **small sign**, 2×2 office + Janitor |
| 5th (17×17) | **Burglaries** begin; **cameras** unlocked; **3×3 office** + Security staff |
| Later | TBD |

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

- **Rebirth details** — requirement to rebirth, multiplier curve, grid sizes, extra unlocks.
- Lease length ranges & renew/abandon odds.
- Other complaint types (dirty units, break-ins → cameras/fences).
- Non-grid advertising (newspaper/radio/online) as prestige unlocks.
- Burglaries: frequency, consequences, guard vs cameras.
- **Leasing Agent / Manager** unlock timing (which rebirth) and office slots for them.
- Tenant bid distribution (e.g. ~50%–130% of list price; VIPs higher).

## ❓ Open questions


