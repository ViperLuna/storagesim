import { useEffect } from 'react'
import { useStore } from '../store'
import { money, duration } from '../game/format'
import { defName, nextTier, unitDef } from '../game/defs'
import { itemDraw, isPowered } from '../game/power'
import * as A from '../game/actions'
import { isAccessible, reachable } from '../game/grid'
import { addProspect, step, catchUp, rentMultiplier } from '../game/sim'
import { createRun } from '../game/init'
import { cancelPlacing, commitPlacing, rotatePlacing, startMove, startUpgrade } from './placing'
import { defCost } from '../game/defs'
import { unlockAudio } from '../audio'
import { officeSlots, staffBlocker } from '../game/staff'

export function SelectionPanel() {
  const g = useStore(s => s.game)!
  const id = useStore(s => s.selectedId)
  const mutate = useStore(s => s.mutate)
  const set = useStore(s => s.set)
  const it = g.items.find(i => i.id === id)
  if (!it) return null
  const u = it.unit
  const draw = itemDraw(it)
  const next = nextTier(it)
  const upCost = A.upgradeCost(it)
  const sellFor = A.sellValue(g, it)
  return (
    <div className="selection">
      <div className="row">
        <strong>{it.kind === 'unit' ? `${it.label} · ${unitDef(it.defId).name}` : it.label}</strong>
        <button className="icon-btn" onClick={() => set({ selectedId: null })} aria-label="Close">✕</button>
      </div>
      {u && <UnitInfo />}
      {it.kind === 'office' && <OfficeInfo />}
      {draw > 0 && <div className="small">Power: {draw}⚡ · {it.on ? (isPowered(g, it) ? 'on' : 'on (grid tripped!)') : 'switched off'}</div>}
      <div className="actions">
        {u && (u.pending > 0 || (u.status === 'dirty' && !g.playerClean.queue.includes(it.id) && !g.staff.some(s => s.targetId === it.id))) && (
          <button className="good" onClick={() => mutate(s => A.collect(s, it.id))}>
            {u.status === 'dirty' ? (u.pending > 0 ? `💰 Collect ${money(u.pending)} & clean` : '🧽 Clean') : `💰 Collect ${money(u.pending)}`}
          </button>
        )}
        {u?.status === 'abandoned' && <>
          <button className="good" onClick={() => mutate(s => A.fixedSale(s, it.id))}>💵 Sell contents {money(u.abandonOffer ?? 0)}</button>
          <button onClick={() => mutate(s => A.startAuction(s, it.id))}>🔨 Auction ({duration(A.auctionDuration(it))})</button>
        </>}
        {draw > 0 && <button onClick={() => mutate(s => A.toggle(s, it.id))}>{it.on ? '🔌 Switch off' : '🔌 Switch on'}</button>}
        <button onClick={() => startMove(it.id)}>✋ Move</button>
        {next && upCost !== undefined && (
          <button disabled={g.money < upCost} onClick={() => startUpgrade(it.id, next)}>⬆️ {defName(it.kind, next)} ({money(upCost)})</button>
        )}
        {u?.status !== 'auction' && (
          <button className="bad" onClick={() => {
            if (it.kind === 'office' && g.staff.length && !confirm('Sell the office? All staff will be let go.')) return
            if (u?.status === 'occupied' && !confirm(`Evict ${u.tenant!.name}? They get their ${money(u.tenant!.deposit)} deposit back and your rating takes a hit. 😬`)) return
            mutate(s => A.sell(s, it.id))
            set({ selectedId: null })
          }}>💲 Sell ({money(sellFor)})</button>
        )}
      </div>
    </div>
  )
}

function OfficeInfo() {
  const g = useStore(s => s.game)!
  const set = useStore(s => s.set)
  const blocker = staffBlocker(g)
  return (
    <div className="small info">
      <div>Staff: {g.staff.length}/{officeSlots(g)}</div>
      {blocker && <div className="bad">⚠️ {blocker}</div>}
      <div className="actions"><button onClick={() => set({ menu: 'staff' })}>👷 Manage staff</button></div>
    </div>
  )
}

function CleanInfo() {
  const g = useStore(s => s.game)!
  const mutate = useStore(s => s.mutate)
  const it = g.items.find(i => i.id === useStore.getState().selectedId)!
  const pc = g.playerClean
  const qi = pc.queue.indexOf(it.id)
  const jan = g.staff.find(s => s.targetId === it.id)
  if (qi === 0) return <div>🧽 You're cleaning it — {duration(pc.left)} left. <button className="linkish" onClick={() => mutate(s => A.cancelClean(s, it.id))}>stop</button></div>
  if (qi > 0) return <div>⏳ In your cleaning queue (#{qi + 1}). <button className="linkish" onClick={() => mutate(s => A.cancelClean(s, it.id))}>remove</button></div>
  if (jan) return <div>🧹 The janitor's {jan.mode === 'cleaning' ? `cleaning it — ${duration(jan.cleanLeft)} left` : 'on the way'}.</div>
  return <div>Tenant moved out. Clean it before re-renting ({duration(unitDef(it.defId).cleanTime)} for you).</div>
}

function UnitInfo() {
  const g = useStore(s => s.game)!
  const it = g.items.find(i => i.id === useStore.getState().selectedId)!
  const u = it.unit!
  const d = unitDef(it.defId)
  const accessible = isAccessible(g, it, reachable(g))
  const t = u.tenant
  return (
    <div className="small info">
      {!accessible && <div className="bad">⛔ Door can't be reached from the gate!</div>}
      {u.status === 'vacant' && <div className="muted">Vacant · list {money(d.listPrice)}/pt · every {duration(d.timer)}</div>}
      {u.status === 'occupied' && t && <>
        <div>{t.vip && '👑 '}<b>{t.name}</b> · {money(t.bid * rentMultiplier(g))}/pt · {t.leaseLeft} pts left on lease</div>
        <div>Next point in {duration(d.timer - u.progress)}</div>
      </>}
      {u.status === 'dirty' && <CleanInfo />}
      {u.status === 'abandoned' && <div>Abandoned! Take the fixed offer, or gamble on an auction (~60% it beats the offer).</div>}
      {u.status === 'auction' && <div>🔨 Auction ends in {duration((u.auctionEndsAt ?? 0) - g.time)}</div>}
      {u.pending > 0 && <div>💰 Waiting to collect: <b>{money(u.pending)}</b></div>}
    </div>
  )
}

export function PlacementBar() {
  const p = useStore(s => s.placing)
  const g = useStore(s => s.game)
  if (!p || !g) return null
  const it = p.itemId ? g.items.find(i => i.id === p.itemId) : undefined
  const cost = p.mode === 'new' ? defCost(p.kind, p.defId) : p.mode === 'upgrade' && it ? A.upgradeCost(it) ?? 0 : 0
  const drawItem = { ...(it ?? { id: 0, x: 0, y: 0, rot: 0 as const, on: true, placedAt: 0, label: '' }), kind: p.kind, defId: p.defId }
  const draw = itemDraw(drawItem)
  return (
    <div className="placement-bar">
      <span>
        <b>{p.mode === 'move' ? 'Moving' : p.mode === 'upgrade' ? 'Upgrading to' : 'Placing'} {defName(p.kind, p.defId)}</b>
        {cost > 0 && <> · {money(cost)}</>}
        {draw > 0 && p.mode === 'new' && <> · +{draw}⚡</>}
      </span>
      <span className="small muted hide-mobile">R rotate · click place · Esc cancel</span>
      <div className="actions">
        <button onClick={rotatePlacing}>⟳ Rotate</button>
        <button className="good" onClick={commitPlacing}>✔ Place</button>
        <button className="bad" onClick={cancelPlacing}>✕ Cancel</button>
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore(s => s.toasts)
  const dismiss = useStore(s => s.dismissToast)
  const focusItem = useStore(s => s.focusItem)
  const set = useStore(s => s.set)
  useEffect(() => {
    if (!toasts.length) return
    const oldest = toasts[0]
    const t = setTimeout(() => dismiss(oldest.id), 6000)
    return () => clearTimeout(t)
  }, [toasts, dismiss])
  return (
    <div className="toasts">
      {toasts.map(t => (
        <button key={t.id} className={`toast ${t.entry.tone}`} onClick={() => {
          if (t.entry.focusId) focusItem(t.entry.focusId)
          else if (t.entry.openTenants) set({ menu: 'tenants' })
          dismiss(t.id)
        }}>{t.entry.text}</button>
      ))}
    </div>
  )
}

export function TitleScreen() {
  const hasSave = useStore(s => s.hasSave)()
  const newGame = useStore(s => s.newGame)
  const cont = useStore(s => s.continueGame)
  return (
    <div className="title-screen">
      <h1>StorageSim</h1>
      <p className="muted">Build a self-storage empire.</p>
      <div className="title-buttons">
        {hasSave && <button className="big good" onClick={() => { unlockAudio(); cont() }}>▶ Continue</button>}
        <button className="big" onClick={() => {
          if (hasSave && !confirm('Start a new game? Your current save will be overwritten.')) return
          unlockAudio()
          newGame()
        }}>✨ New Game</button>
      </div>
      <p className="muted small">Alpha v0.1 · colored boxes until the real art shows up</p>
    </div>
  )
}

export function OfflineSummaryModal() {
  const s = useStore(st => st.summary)
  const set = useStore(st => st.set)
  if (!s) return null
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>💤 While you were away ({duration(s.seconds)})</h2>
        <ul>
          <li>💰 {money(s.rent)} in rent piled up on your units — go click it!</li>
          {s.leasesEnded > 0 && <li>🧍 {s.leasesEnded} lease{s.leasesEnded > 1 ? 's' : ''} ended — {s.renewed} renewed, {s.vacated} moved out</li>}
          {s.abandoned > 0 && <li>🏚️ {s.abandoned} unit{s.abandoned > 1 ? 's' : ''} abandoned</li>}
          {s.ragequit > 0 && <li>😡 {s.ragequit} tenant{s.ragequit > 1 ? 's' : ''} left because they couldn't reach their unit</li>}
          {s.auctions > 0 && <li>🔨 {s.auctions} auction{s.auctions > 1 ? 's' : ''} closed</li>}
        </ul>
        <button className="big good" onClick={() => set({ summary: null })}>Let's go</button>
      </div>
    </div>
  )
}

export function LevelOverModal() {
  const g = useStore(s => s.game)
  const replaceGame = useStore(s => s.replaceGame)
  const quit = useStore(s => s.quitToTitle)
  const set = useStore(s => s.set)
  if (!g?.levelOver) return null
  return (
    <div className="modal-bg">
      <div className="modal">
        <h2>💀 Level over</h2>
        <p>{g.levelOver === 'rating'
          ? 'Your rating hit rock bottom and stayed there. Every tenant pulled out.'
          : 'You ran out of money and kept bleeding it. The bank took the keys.'}</p>
        <div className="actions">
          <button className="big good" onClick={() => {
            replaceGame(createRun(g.rebirth))
            set({ selectedId: null, placing: null, fitRequest: useStore.getState().fitRequest + 1 })
          }}>🔄 Restart rebirth #{g.rebirth}</button>
          <button className="big" onClick={() => {
            replaceGame(createRun(g.rebirth))
            quit()
          }}>🏠 Quit</button>
        </div>
      </div>
    </div>
  )
}

export function DebugPanel() {
  const open = useStore(s => s.debugOpen)
  const timeScale = useStore(s => s.timeScale)
  const showReach = useStore(s => s.showReach)
  const mutate = useStore(s => s.mutate)
  const set = useStore(s => s.set)
  const g = useStore(s => s.game)
  if (!open || !g) return null
  return (
    <div className="debug">
      <div className="row"><b>🛠️ Debug</b><button className="icon-btn" onClick={() => set({ debugOpen: false })}>✕</button></div>
      <div className="actions">
        <button onClick={() => mutate(s => { s.money += 1000 })}>+$1K</button>
        <button onClick={() => mutate(s => { s.money += 100000 })}>+$100K</button>
        <button onClick={() => mutate(s => addProspect(s))}>Spawn prospect</button>
        <button onClick={() => mutate(s => addProspect(s, true))}>Spawn VIP</button>
        <button onClick={() => mutate(s => { for (let i = 0; i < 60; i++) step(s, 5) })}>Skip 5 min</button>
        <button onClick={() => {
          const sum = mutate(s => catchUp(s, 3600))
          set({ summary: sum })
        }}>Offline 1h</button>
        <button onClick={() => mutate(s => { s.rating = 5 })}>Rating 5★</button>
        <button onClick={() => mutate(s => { s.rating = 0.05 })}>Rating ~0</button>
        <button onClick={() => mutate(s => { for (const it of s.items) if (it.unit?.status === 'vacant') { it.unit.status = 'dirty'; it.unit.dirtySince = s.time } })}>Dirty vacant units</button>
        <button onClick={() => mutate(s => { s.money = -500; s.cashAtLastPayroll = -500 })}>Cash → -$500</button>
        <button onClick={() => set({ showReach: !showReach })}>{showReach ? 'Hide' : 'Show'} reachable tiles</button>
      </div>
      <label className="small">Time speed ×{timeScale}
        <input type="range" min={1} max={50} value={timeScale} onChange={e => set({ timeScale: Number(e.target.value) })} />
      </label>
      <div className="small muted">t={duration(g.time)} · next tick {duration(g.tickIn)} · rating {g.rating.toFixed(2)} · strikes {g.failStrikes}</div>
    </div>
  )
}
