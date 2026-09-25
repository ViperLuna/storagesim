import { useStore, resetSave } from '../store'
import { UNITS, UNIT_POWER_PER_TILE } from '../data/units'
import { SIGNS } from '../data/signs'
import { GENERATORS } from '../data/power'
import { rentMultiplierFor, gridSizeFor } from '../data/rebirths'
import { PROSPECT_PATIENCE } from '../data/tenants'
import { money, duration } from '../game/format'
import { unitDef } from '../game/defs'
import * as A from '../game/actions'
import { startPlacing } from './placing'
import { notice } from './notice'

export function SidePanel() {
  const menu = useStore(s => s.menu)
  const set = useStore(s => s.set)
  if (!menu) return null
  return (
    <aside className="panel">
      <div className="panel-head">
        <h2>{{ build: '🏗️ Build', tenants: '🧍 Tenants', rebirth: '🔁 Rebirth', log: '📜 Message Log', settings: '⚙️ Settings' }[menu]}</h2>
        <button className="icon-btn" onClick={() => set({ menu: null })} aria-label="Close">✕</button>
      </div>
      <div className="panel-body">
        {menu === 'build' && <BuildMenu />}
        {menu === 'tenants' && <TenantsMenu />}
        {menu === 'rebirth' && <RebirthMenu />}
        {menu === 'log' && <LogMenu />}
        {menu === 'settings' && <SettingsMenu />}
      </div>
    </aside>
  )
}

function BuildMenu() {
  const g = useStore(s => s.game)!
  const hasSign = g.items.some(i => i.kind === 'sign')
  const hasGen = g.items.some(i => i.kind === 'generator')
  const firstSign = SIGNS.find(s => s.unlockRebirth <= g.rebirth)!
  return (
    <>
      <h3>Storage units</h3>
      {UNITS.filter(u => u.unlockRebirth <= g.rebirth).map(u => (
        <BuildRow key={u.id} color={u.color} name={u.name} cost={u.cost} money={g.money}
          detail={`${u.w}×${u.h} · ${money(u.listPrice)}/pt · every ${duration(u.timer)} · ${u.w * u.h * UNIT_POWER_PER_TILE}⚡`}
          onClick={() => startPlacing('unit', u.id)} />
      ))}
      <h3>Advertising</h3>
      {hasSign
        ? <p className="muted small">One sign per plot. Select your sign to upgrade it.</p>
        : <BuildRow color={firstSign.color} name={firstSign.name} cost={firstSign.cost} money={g.money}
            detail={`${firstSign.w}×${firstSign.h} · prospects ×${firstSign.spawnBoost} · ${firstSign.power}⚡`}
            onClick={() => startPlacing('sign', firstSign.id)} />}
      <h3>Power</h3>
      {hasGen
        ? <p className="muted small">One power grid per plot. Select it to upgrade.</p>
        : <BuildRow color={GENERATORS[0].color} name={GENERATORS[0].name} cost={GENERATORS[0].cost} money={g.money}
            detail={`${GENERATORS[0].w}×${GENERATORS[0].h} · +${GENERATORS[0].capacity}⚡ capacity`}
            onClick={() => startPlacing('generator', GENERATORS[0].id)} />}
      <p className="muted small">Office & staff, cameras: coming in a later build.</p>
    </>
  )
}

function BuildRow({ color, name, cost, money: cash, detail, onClick }: { color: string; name: string; cost: number; money: number; detail: string; onClick: () => void }) {
  const afford = cash >= cost
  return (
    <button className="build-row" disabled={!afford} onClick={onClick}>
      <span className="swatch" style={{ background: color }} />
      <span className="grow">
        <strong>{name}</strong>
        <span className="small muted">{detail}</span>
      </span>
      <span className={afford ? 'price' : 'price bad'}>{money(cost)}</span>
    </button>
  )
}

function TenantsMenu() {
  const g = useStore(s => s.game)!
  const mutate = useStore(s => s.mutate)
  const focusItem = useStore(s => s.focusItem)
  const tenants = g.items.filter(i => i.unit?.status === 'occupied')
  const mult = rentMultiplierFor(g.rebirth)
  return (
    <>
      <h3>Waiting ({g.prospects.length})</h3>
      {g.prospects.length === 0 && <p className="muted small">Nobody's waiting. A sign brings people in faster.</p>}
      {g.prospects.map(p => {
        const d = unitDef(p.wants)
        const { exact, bigger } = A.eligibleUnits(g, p.wants)
        const left = PROSPECT_PATIENCE - (g.time - p.arrivedAt)
        return (
          <div key={p.id} className={`card ${p.vip ? 'vip' : ''}`}>
            <div className="row">
              <strong>{p.vip && '👑 '}{p.name}</strong>
              <span className="small muted">leaves in {duration(left)}</span>
            </div>
            <div className="small">Wants a <b>{d.name}</b> ({d.w}×{d.h}) · offers <b>{money(p.bid)}/pt</b>
              {mult !== 1 && <> (you get {money(p.bid * mult)})</>}
              <span className="muted"> · list {money(d.listPrice)}</span>
            </div>
            <div className="small muted">Deposit: {money(p.bid * mult)}</div>
            <div className="actions">
              {exact.map(u => (
                <button key={u.id} className="good" onClick={() => mutate(s => A.offerUnit(s, p.id, u.id))}>Accept → {u.label}</button>
              ))}
              {!p.refusedUpsize && bigger.map(u => (
                <button key={u.id} onClick={() => {
                  const r = mutate(s => A.offerUnit(s, p.id, u.id))
                  if (r === 'refused') notice(`${p.name} said no to the ${unitDef(u.defId).name}.`)
                }}>Upsize → {u.label} ({unitDef(u.defId).name})</button>
              ))}
              {exact.length === 0 && (p.refusedUpsize || bigger.length === 0) && <span className="small muted">No suitable vacant unit.</span>}
              <button className="bad" onClick={() => mutate(s => A.decline(s, p.id))}>Decline</button>
            </div>
          </div>
        )
      })}
      <h3>Current tenants ({tenants.length})</h3>
      {tenants.map(it => {
        const t = it.unit!.tenant!
        return (
          <button key={it.id} className="tenant-row" onClick={() => focusItem(it.id)}>
            <span>{it.label}</span>
            <span className="grow">{t.vip && '👑 '}{t.name}{t.complaintStage > 0 && ' 😠'}</span>
            <span className="small muted">{money(t.bid)}/pt · {t.leaseLeft} pts left</span>
          </button>
        )
      })}
    </>
  )
}

function RebirthMenu() {
  const g = useStore(s => s.game)!
  const replaceGame = useStore(s => s.replaceGame)
  const set = useStore(s => s.set)
  const checks = A.rebirthChecks(g)
  const ok = checks.every(c => c.met)
  return (
    <>
      <p>Start over from $0 with a bigger lot and better rent.</p>
      <div className="card">
        <div className="row"><span>Lot</span><b>{g.size}×{g.size} → {gridSizeFor(g.rebirth + 1)}×{gridSizeFor(g.rebirth + 1)}</b></div>
        <div className="row"><span>Rent multiplier</span><b>×{rentMultiplierFor(g.rebirth)} → ×{rentMultiplierFor(g.rebirth + 1)}</b></div>
      </div>
      <h3>Requirements</h3>
      <ul className="checks">
        {checks.map(c => <li key={c.label} className={c.met ? 'met' : ''}>{c.met ? '✅' : '⬜'} {c.label}</li>)}
      </ul>
      <button className="big good" disabled={!ok} onClick={() => {
        if (!confirm('Rebirth? Everything resets except your rebirth count.')) return
        const next = A.rebirth(g)
        if (next) {
          replaceGame(next)
          set({ menu: null, selectedId: null, fitRequest: useStore.getState().fitRequest + 1 })
        }
      }}>🔁 Rebirth</button>
    </>
  )
}

function LogMenu() {
  const log = useStore(s => s.game!.log)
  const focusItem = useStore(s => s.focusItem)
  const set = useStore(s => s.set)
  return (
    <div className="log">
      {log.length === 0 && <p className="muted small">Nothing yet.</p>}
      {[...log].reverse().map(e => (
        <button key={e.id} className={`log-row ${e.tone}`} onClick={() => {
          if (e.focusId) focusItem(e.focusId)
          else if (e.openTenants) set({ menu: 'tenants' })
        }}>
          <span className="small muted">{duration(e.time)}</span> {e.text}
        </button>
      ))}
    </div>
  )
}

function SettingsMenu() {
  const quit = useStore(s => s.quitToTitle)
  const set = useStore(s => s.set)
  const debugOpen = useStore(s => s.debugOpen)
  return (
    <>
      <button className="big" onClick={quit}>🏠 Save & quit to title</button>
      <button className="big" onClick={() => set({ debugOpen: !debugOpen })}>🛠️ {debugOpen ? 'Hide' : 'Show'} debug panel (`)</button>
      <button className="big bad" onClick={() => {
        if (!confirm('Delete your save and start over? This cannot be undone.')) return
        resetSave()
        quit()
        resetSave()
      }}>🗑️ Reset save</button>
      <p className="muted small">Sound settings will live here once sounds exist.</p>
      <p className="muted small">Alpha build · v0.1</p>
    </>
  )
}
