import { useStore } from '../store'
import { NAV } from './nav'
import { duration, money } from '../game/format'
import { powerCapacity, powerDraw } from '../game/power'
import { stars } from '../game/tenants'
import { rentMultiplierFor } from '../data/rebirths'

export function Hud() {
  const g = useStore(s => s.game)!
  const set = useStore(s => s.set)
  const draw = powerDraw(g), cap = powerCapacity(g)
  const st = stars(g)
  return (
    <header className="hud">
      <div className="brand">StorageSim</div>
      <Stat label="Cash" value={money(g.money)} tone={g.money < 0 ? 'bad' : undefined} />
      <Stat label="Rating" value={<Stars value={st} />} tone={g.failStrikes ? 'bad' : undefined} onClick={() => set({ menu: 'money' })} />
      <Stat label="POWER" value={`${fmt(draw)} / ${fmt(cap)}`} tone={g.tripped ? 'bad' : draw > cap * 0.85 ? 'warn' : undefined} />
      {(g.staff.length > 0 || g.loan) && <Stat label="Payday" value={duration(g.tickIn)} tone={g.bankruptStrikes ? 'bad' : undefined} />}
      <Stat label="Rebirth" value={`#${g.rebirth} · ×${rentMultiplierFor(g.rebirth)}`} />
      <Stat label="Lot" value={`${g.size}×${g.size}`} />
    </header>
  )
}

const fmt = (n: number) => (Number.isInteger(n) ? n : n.toFixed(2)).toString()

function Stat({ label, value, tone, onClick }: { label: string; value: React.ReactNode; tone?: 'bad' | 'warn'; onClick?: () => void }) {
  const cls = `stat ${tone ?? ''} ${onClick ? 'clickable' : ''}`
  const body = <><span className="stat-label">{label}</span><span className="stat-value">{value}</span></>
  return onClick ? <button className={cls} onClick={onClick}>{body}</button> : <div className={cls}>{body}</div>
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" title={value.toFixed(2)}>
      {[0, 1, 2, 3, 4].map(i => {
        const fill = Math.max(0, Math.min(1, value - i))
        return <span key={i} className="star"><span style={{ width: `${fill * 100}%` }}>★</span>★</span>
      })}
    </span>
  )
}

export function Nav() {
  const menu = useStore(s => s.menu)
  const set = useStore(s => s.set)
  const waiting = useStore(s => s.game?.prospects.length ?? 0)
  return (
    <nav className="nav">
      {NAV.map((n, i) => (
        <button key={n.id} className={menu === n.id ? 'active' : ''} onClick={() => set({ menu: menu === n.id ? null : n.id })}>
          <span className="nav-icon">{n.icon}</span>
          <span className="nav-label">{n.label}</span>
          <span className="nav-key">{i + 1}</span>
          {n.id === 'tenants' && waiting > 0 && <span className="dot">{waiting}</span>}
        </button>
      ))}
    </nav>
  )
}
