import { useEffect, useState } from 'react'
import { useStore, resetSave } from '../store'
import type { GameState } from '../game/types'
import { isPowered } from '../game/power'
import { defName, nextTier } from '../game/defs'
import { UNITS, UNIT_POWER_PER_TILE } from '../data/units'
import { SIGNS } from '../data/signs'
import { GENERATORS } from '../data/power'
import { rentMultiplierFor, gridSizeFor } from '../data/rebirths'
import { PROSPECT_PATIENCE } from '../data/tenants'
import { aOrAn, money, duration } from '../game/format'
import { unitDef } from '../game/defs'
import * as A from '../game/actions'
import { startPlacing, startReplace } from './placing'
import { OFFICES } from '../data/office'
import { CAMERAS, BURGLARY_UNLOCK_REBIRTH } from '../data/cameras'
import { startCameraPlacing } from './camPlacing'
import { securityBlocker, activeCameraCount } from '../game/cameras'
import { STAFF, UPGRADES } from '../data/staff'
import { LOG_CATS, categorize, type LogCat } from './logFilter'
import { LOAN_GRACE, LOAN_INSTALLMENTS, LOAN_INTEREST, loanAmountFor } from '../data/bank'
import { FAIL_STRIKES, RATING_GAIN_PER_TICK, RATING_LOSS_PER_ISSUE, RATING_MAX, TICK_SECONDS } from '../data/economy'
import { ratingIssues } from '../game/sim'
import { Stars } from './Hud'
import { janitorCleanFactor, janitorSpeed, office, officeSlots, payrollMax, payrollOwed, staffBlocker } from '../game/staff'
import { getVolume, isMuted, playSound, setMuted, setVolume } from '../audio'
import { notice } from './notice'

export function SidePanel() {
  const menu = useStore(s => s.menu)
  const set = useStore(s => s.set)
  if (!menu) return null
  return (
    <aside className="panel">
      <div className="panel-head">
        <h2>{{ build: '🏗️ Build', tenants: '🧍 Tenants', staff: '👷 Staff', money: '💰 Money & Rating', rebirth: '🔁 Rebirth', log: '📜 Message Log', settings: '⚙️ Settings' }[menu]}</h2>
        <button className="icon-btn" onClick={() => set({ menu: null })} aria-label="Close">✕</button>
      </div>
      <div className="panel-body">
        {menu === 'build' && <BuildMenu />}
        {menu === 'tenants' && <TenantsMenu />}
        {menu === 'staff' && <StaffMenu />}
        {menu === 'money' && <MoneyMenu />}
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
      <h3>Office</h3>
      {(() => {
        const current = g.items.find(i => i.kind === 'office')
        return (
          <>
            {current && <p className="muted small">One office per plot. You have the {current.label}. Replacing it sells the old one and your staff move right over.</p>}
            {OFFICES.filter(o => o.unlockRebirth <= g.rebirth && o.id !== current?.defId).map(o => {
              const cost = current ? A.replaceCost(g, current, o.id) : o.cost
              return (
                <BuildRow key={o.id} color={o.color} name={current ? `Replace with ${o.name}` : o.name} cost={cost} money={g.money}
                  detail={`${o.w}×${o.h} · ${o.slots} staff slot${o.slots > 1 ? 's' : ''} · ${o.power}⚡ · door must be reachable${current ? ` · ${money(o.cost)} minus old office` : ''}`}
                  onClick={() => (current ? startReplace(current.id, o.id) : startPlacing('office', o.id))} />
              )
            })}
            {OFFICES.filter(o => o.unlockRebirth > g.rebirth).map(o => (
              <p key={o.id} className="muted small">🔒 {o.name} ({o.w}×{o.h}, {o.slots} slots) unlocks at rebirth {o.unlockRebirth}.</p>
            ))}
          </>
        )
      })()}
      <h3>Security cameras</h3>
      {g.rebirth < BURGLARY_UNLOCK_REBIRTH ? (
        <p className="muted small">🔒 Unlocks at rebirth {BURGLARY_UNLOCK_REBIRTH} — along with burglars, the Security Office, and a Security guard.</p>
      ) : (
        <>
          <p className="muted small">Mount on a unit or your sign. They only record with the Security Office and a Security guard on duty. A burglar is caught if the tile outside the door is watched.</p>
          {CAMERAS.filter(c => c.unlockRebirth <= g.rebirth).map(c => (
            <BuildRow key={c.id} color="#2a3140" name={`${c.fov >= 360 ? '◉' : '📹'} ${c.name}`} cost={c.cost} money={g.money}
              detail={`${c.fov >= 360 ? 'all around' : `${c.fov}° view`} · ${c.range} tiles · ${c.power}⚡`}
              onClick={() => startCameraPlacing(c.id)} />
          ))}
        </>
      )}
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

/** Little hint so the wiggle is readable: good deals are easy yeses, pricey ones are iffy. */
function dealHint(p: { upsizeWiggle?: number }): string {
  const w = p.upsizeWiggle ?? 1
  return w <= 0.96 ? '👍' : w >= 1.04 ? '🤔' : ''
}

/** How long a tenant card's buttons stay locked after it appears or moves in the list. */
const ARM_MS = 1000

/** Buttons that only become pressable a moment after they appear — no mis-taps when the list shifts. */
function ArmedActions({ children }: { children: React.ReactNode }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), ARM_MS)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className={`actions arming ${armed ? 'armed' : ''}`} style={{ '--arm-ms': `${ARM_MS}ms` } as React.CSSProperties}
      onClickCapture={e => { if (!armed) { e.stopPropagation(); e.preventDefault() } }}>
      {children}
    </div>
  )
}

/** "Nobody's waiting" — with a tip that actually fits your sign situation. */
function emptyWaitingHint(g: GameState): string {
  const sign = g.items.find(i => i.kind === 'sign')
  if (!sign) return "Nobody's waiting. A sign brings people in faster."
  if (!isPowered(g, sign)) return "Nobody's waiting — and your sign is dark. Power it up to bring people in."
  const next = nextTier(sign)
  if (next && SIGNS.find(x => x.id === next)!.unlockRebirth <= g.rebirth) return `Nobody's waiting. Upgrading to a ${defName('sign', next)} brings people in faster.`
  return "Nobody's waiting. Hang tight — someone will show up soon."
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
      {g.prospects.length === 0 && <p className="muted small">{emptyWaitingHint(g)}</p>}
      {A.sortedProspects(g).map(({ p, exact, bigger }, index) => {
        const d = unitDef(p.wants)
        const left = PROSPECT_PATIENCE - (g.time - p.arrivedAt)
        return (
          <div key={p.id} className={`card ${p.vip ? 'vip' : ''} ${exact.length === 0 && (p.refusedUpsize || bigger.length === 0) ? 'nofit' : ''}`}>
            <div className="row">
              <strong>{p.vip && '👑 '}{p.name}</strong>
              <span className="small muted">leaves in {duration(left)}</span>
            </div>
            <div className="small">Wants {aOrAn(d.name).split(' ')[0]} <b>{d.name}</b> ({d.w}×{d.h}) · offers <b>{money(p.bid)}/pt</b>
              {mult !== 1 && <> (you get {money(p.bid * mult)})</>}
              <span className="muted"> · list {money(d.listPrice)}</span>
            </div>
            <div className="small muted">Deposit: {money(p.bid * mult)}</div>
            {/* Keyed by position: a card that's new or just moved remounts and arms again. */}
            <ArmedActions key={`${p.id}@${index}`}>
              {exact.map(u => (
                <button key={u.id} className="good" onClick={() => mutate(s => A.offerUnit(s, p.id, u.id))}>Accept → {u.label}</button>
              ))}
              {!p.refusedUpsize && bigger.map(u => (
                <button key={u.id} onClick={() => {
                  const r = mutate(s => A.offerUnit(s, p.id, u.id))
                  if (r === 'refused') notice(`${p.name} said no to the ${unitDef(u.defId).name}.`)
                }}>Upsize → {u.label} {unitDef(u.defId).name} @ {money(A.upsizePrice(p, u.defId))}/pt {dealHint(p)}</button>
              ))}
              {exact.length === 0 && (p.refusedUpsize || bigger.length === 0) && <span className="small muted">No suitable vacant unit.</span>}
              <button className="bad" onClick={() => mutate(s => A.decline(s, p.id))}>Decline</button>
            </ArmedActions>
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

const STAFF_BLURB: Record<string, string> = {
  janitor: 'Walks the paths and cleans units after tenants move out. Nearest job first.',
  security: 'Watches the monitors in the Security Office. Cameras only record while a guard is on duty. Paid only while there are cameras to watch.',
}

function StaffMenu() {
  const g = useStore(s => s.game)!
  const mutate = useStore(s => s.mutate)
  const set = useStore(s => s.set)
  const o = office(g)
  const slots = officeSlots(g)
  const blocker = staffBlocker(g)
  const wages = payrollMax(g)
  const owed = payrollOwed(g)
  return (
    <>
      {!o && <p className="muted small">You need an office before you can hire anyone. Build one from the 🏗️ Build menu.</p>}
      {o && <p className="small">🏢 {o.label}: {g.staff.length}/{slots} slot{slots > 1 ? 's' : ''} filled</p>}
      {o && blocker && g.staff.length > 0 && <p className="bad small">⚠️ Staff can't work: {blocker}.</p>}
      <h3>Hire</h3>
      {STAFF.filter(d => d.unlockRebirth <= g.rebirth).map(d => {
        const count = g.staff.filter(x => x.role === d.id).length
        const err = !o ? 'Needs an office' : d.needsOffice && o.defId !== d.needsOffice ? `Needs the ${OFFICES.find(x => x.id === d.needsOffice)!.name}` : g.staff.length >= slots ? 'No free office slot' : count >= d.max ? `Max ${d.max} for now` : g.money < d.hireCost ? 'Not enough money' : null
        return (
          <div key={d.id} className="card">
            <div className="row"><strong>{d.icon} {d.name}</strong><span className="small muted">up to {money(d.wage)} / payroll</span></div>
            <div className="small muted">{STAFF_BLURB[d.id]}</div>
            <div className="actions">
              <button className="good" disabled={!!err} onClick={() => {
                const e = mutate(s => A.hire(s, d.id))
                if (e) notice(e)
              }}>Hire ({money(d.hireCost)})</button>
              {err && <span className="small muted">{err}</span>}
            </div>
          </div>
        )
      })}
      <h3>Employees ({g.staff.length})</h3>
      {g.staff.length === 0 && <p className="muted small">Nobody yet.</p>}
      {g.staff.map(st => {
        const d = STAFF.find(x => x.id === st.role)!
        const secBlock = st.role === 'security' ? securityBlocker(g) : null
        const doing = blocker ? `idle — ${blocker.toLowerCase()}`
          : st.role === 'security' ? (secBlock ? `idle — ${secBlock.toLowerCase()}` : activeCameraCount(g) ? `watching ${activeCameraCount(g)} camera${activeCameraCount(g) > 1 ? 's' : ''}` : 'idle — no cameras to watch')
          : st.mode === 'idle' ? 'in the office' : st.mode === 'toJob' ? 'heading to a job' : st.mode === 'cleaning' ? 'cleaning' : 'walking back'
        return (
          <div key={st.id} className="card">
            <div className="row"><strong>{d.icon} {d.name}</strong><span className="small muted">{doing}</span></div>
            <div className="actions">
              {st.targetId && <button onClick={() => useStore.getState().focusItem(st.targetId!)}>📍 Show job</button>}
              <button className="bad" onClick={() => { if (confirm(`Fire the ${d.name}?`)) mutate(s => A.fire(s, st.id)) }}>Fire</button>
            </div>
          </div>
        )
      })}
      {wages > 0 && <p className="small">Payroll: up to <b>{money(wages)}</b> every {duration(TICK_SECONDS)} — only for time spent working. So far this period: <b>{money(owed)}</b> (payday in {duration(g.tickIn)}).</p>}
      <h3>Upgrades</h3>
      <p className="small muted">Walk speed {janitorSpeed(g).toFixed(1)} tiles/s · cleans in {Math.round(janitorCleanFactor(g) * 100)}% of your time</p>
      {UPGRADES.map(u => {
        const lvl = g.upgrades[u.id] ?? 0
        const maxed = lvl >= u.costs.length
        const cost = u.costs[lvl]
        return (
          <button key={u.id} className="build-row" disabled={maxed || g.money < cost} onClick={() => {
            const e = mutate(s => A.buyUpgrade(s, u.id))
            if (e) notice(e)
          }}>
            <span className="grow"><strong>{u.name} · Lv {lvl}/{u.costs.length}</strong><span className="small muted">{u.desc}</span></span>
            <span className="price">{maxed ? 'MAX' : money(cost)}</span>
          </button>
        )
      })}
      <button className="big" onClick={() => set({ menu: 'money' })}>💰 Payroll & bank →</button>
    </>
  )
}

function RatingCard() {
  const g = useStore(s => s.game)!
  const focusItem = useStore(s => s.focusItem)
  const issues = ratingIssues(g)
  return (
    <>
      <h3>⭐ Rating</h3>
      <div className="card">
        <div className="row"><Stars value={g.rating} /><b>{g.rating.toFixed(1)} / {RATING_MAX}</b></div>
        {issues.length === 0 ? (
          <div className="small">✅ Nothing's wrong — {g.rating >= RATING_MAX ? "you're maxed out (+10% rent!)" : `+${RATING_GAIN_PER_TICK} in ${duration(g.tickIn)}`}.</div>
        ) : (
          <>
            <div className="small bad">−{(RATING_LOSS_PER_ISSUE * issues.length).toFixed(2)} in {duration(g.tickIn)} unless you fix:</div>
            {issues.map((i, n) => (
              <button key={n} className="log-row bad" onClick={() => i.focusId && focusItem(i.focusId)}>{i.text}</button>
            ))}
          </>
        )}
        <div className="small muted">Goes up {RATING_GAIN_PER_TICK} every {duration(TICK_SECONDS)} when nothing's wrong. Never drops while you're offline.</div>
      </div>
    </>
  )
}

function MoneyMenu() {
  const g = useStore(s => s.game)!
  const mutate = useStore(s => s.mutate)
  const wages = payrollMax(g)
  const owed = payrollOwed(g)
  const pendingRent = g.items.reduce((sum, i) => sum + (i.unit?.pending ?? 0), 0)
  const amount = loanAmountFor(g.rebirth)
  return (
    <>
      <div className="card">
        <div className="row"><span>Cash</span><b className={g.money < 0 ? 'bad' : ''}>{money(g.money)}</b></div>
        <div className="row"><span>Rent waiting on units</span><b>{money(pendingRent)}</b></div>
        <div className="row"><span>Payroll this period (so far)</span><b>{money(owed)}</b></div>
        {wages > 0 && <div className="row small muted"><span>Full-time max</span><span>{money(wages)} / {duration(TICK_SECONDS)}</span></div>}
        {g.loan && <div className="row"><span>Loan payment</span><b>{g.loan.graceLeft > 0 ? `starts in ${g.loan.graceLeft} payrolls` : money(g.loan.installment)}</b></div>}
        <div className="row"><span>Next payday</span><b>{duration(g.tickIn)}</b></div>
      </div>
      <RatingCard />
      {g.bankruptStrikes > 0 && <p className="bad small">⚠️ Bankruptcy strikes: {g.bankruptStrikes}/{FAIL_STRIKES}. Each payday in the red without gaining ground is a strike.</p>}
      <h3>🏦 Bank</h3>
      {g.loan ? (
        <div className="card">
          <div className="row"><span>Still owed</span><b>{money(g.loan.owed)}</b></div>
          <div className="small muted">{g.loan.graceLeft > 0 ? `Grace period: ${g.loan.graceLeft} more payroll${g.loan.graceLeft > 1 ? 's' : ''}.` : `${money(g.loan.installment)} comes out every payday.`}</div>
        </div>
      ) : (
        <div className="card">
          <div className="row"><span>Loan</span><b>{money(amount)}</b></div>
          <div className="small muted">{Math.round(LOAN_INTEREST * 100)}% interest · no payments for {LOAN_GRACE} paydays · then {LOAN_INSTALLMENTS} automatic payments of {money(amount * (1 + LOAN_INTEREST) / LOAN_INSTALLMENTS)}.</div>
          <div className="actions">
            <button className="good" onClick={() => { if (confirm(`Borrow ${money(amount)}?`)) mutate(s => A.takeLoan(s)) }}>Take loan</button>
          </div>
        </div>
      )}
      <p className="muted small">Getting out of a hole: sell stuff, fire staff, or borrow. Payroll pauses while you're offline once you hit $0.</p>
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
  const [cats, setCats] = useState<LogCat[]>([])
  const [query, setQuery] = useState('')
  const tagged = log.map(e => ({ e, cat: categorize(e) }))
  const counts = Object.fromEntries(LOG_CATS.map(c => [c.id, tagged.filter(t => t.cat === c.id).length]))
  const q = query.trim().toLowerCase()
  const shown = tagged.filter(t => (!cats.length || (t.cat && cats.includes(t.cat))) && (!q || t.e.text.toLowerCase().includes(q)))
  const toggle = (c: LogCat) => setCats(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]))
  return (
    <div className="log">
      <input className="log-search" type="search" placeholder="🔎 Search the log (name, unit #, anything)" value={query} onChange={e => setQuery(e.target.value)} />
      <div className="chips">
        <button className={`chip ${cats.length === 0 ? 'on' : ''}`} onClick={() => setCats([])}>All {log.length}</button>
        {LOG_CATS.map(c => (
          <button key={c.id} className={`chip ${cats.includes(c.id) ? 'on' : ''}`} onClick={() => toggle(c.id)}>{c.label} {counts[c.id]}</button>
        ))}
      </div>
      {shown.length === 0 && <p className="muted small">{log.length ? 'Nothing matches.' : 'Nothing yet.'}</p>}
      {[...shown].reverse().map(({ e }) => (
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

function SoundSettings() {
  const [volume, setVol] = useState(getVolume)
  const [muted, setMute] = useState(isMuted)
  return (
    <div className="sound-settings">
      <label className="row">
        <span>🔊 Volume</span>
        <input type="range" min={0} max={100} step={5} value={Math.round(volume * 100)} disabled={muted} onChange={e => {
          const v = Number(e.target.value) / 100
          setVol(v)
          setVolume(v)
        }} onPointerUp={() => playSound('prospect')} onKeyUp={() => playSound('prospect')} />
        <span className="small muted">{Math.round(volume * 100)}%</span>
      </label>
      <label className="row">
        <input type="checkbox" checked={muted} onChange={e => { setMute(e.target.checked); setMuted(e.target.checked) }} />
        <span>Mute all sounds</span>
      </label>
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
      <SoundSettings />
      <p className="muted small">Alpha build · v0.1</p>
    </>
  )
}
