# StorageSim

An idle self-storage empire game on an expandable grid. Built with React + Vite + TypeScript and deployed to GitHub Pages.

- **Design doc:** [`docs/DESIGN.md`](docs/DESIGN.md) — everything decided in RoundTable.
- **Tuning:** all game numbers live in [`src/data/`](src/data) — change a number, not the code.

## Develop

```bash
npm install
npm run dev      # local dev server
npm test         # game-logic tests
npm run build    # production build (dist/)
```

## Layout

| Path | What |
|---|---|
| `src/data/` | Tunable content: units, signs, power, tenants, economy, rebirths |
| `src/game/` | Pure game logic (no React): grid, pathing, power, simulation, actions |
| `src/ui/` | React components: grid view (pan/zoom), menus, toasts, overlays |
| `src/store.ts` | Zustand store: game state, UI state, save/load, offline catch-up |

## Controls

- **Pan:** drag the map (one finger on mobile) · **Zoom:** scroll wheel / pinch / ➕➖ · 🎯 fits the whole lot
- **Placing:** R rotate · click to place · Esc cancel (touch: tap to position, tap again or ✔ Place)
- **Debug panel:** press <kbd>`</kbd> (or Settings → debug)
