// Tenants & prospects.

/** Average seconds between prospects with no sign, at 3 stars. */
export const BASE_SPAWN_SECONDS = 45
/** Max prospects waiting at once. Extras just don't show up. */
export const MAX_PROSPECTS = 5
/** Seconds a prospect waits before giving up. */
export const PROSPECT_PATIENCE = 240
/** Chance a prospect asks for a size you already own (keeps the early game moving). */
export const OWNED_SIZE_BIAS = 0.6

/** Bids are list price × a random factor in this range (bell-ish, centred ~0.9). */
export const BID_MIN = 0.5
export const BID_MAX = 1.3

/** VIP odds scale with star rating: 0★ → min, 5★ → max. */
export const VIP_CHANCE_MIN = 0.01
export const VIP_CHANCE_MAX = 0.05
export const VIP_BID_MIN = 1.5
export const VIP_BID_MAX = 2.2

/** Chance a tenant accepts being upsized to a bigger unit at their bid. */
export const UPSIZE_ACCEPT_CHANCE = 0.85

/** Lease length in points. */
export const LEASE_MIN = 4
export const LEASE_MAX = 12
/** What happens when a lease ends (must sum to 1). */
export const LEASE_END = { renew: 0.4, vacate: 0.5, abandon: 0.1 }

/** Blocked-door complaint escalation, in seconds of being cut off. */
export const ANGER_GRACE = 10
export const ANGER_STAGE_2 = 120
export const ANGER_MOVE_OUT = 300

/** Abandoned units: fixed sale offer = bid × random factor in this range. */
export const ABANDON_OFFER_MIN = 2
export const ABANDON_OFFER_MAX = 5
/** Auction: duration = unit timer × this, capped. */
export const AUCTION_DURATION_FACTOR = 3
export const AUCTION_WIN_CHANCE = 0.6
export const AUCTION_WIN_RANGE: [number, number] = [1.1, 2.0]
export const AUCTION_LOSE_RANGE: [number, number] = [0.4, 0.9]

export const FIRST_NAMES = [
  'Dillon', 'Maria', 'Jake', 'Priya', 'Carl', 'Tasha', 'Omar', 'Linda', 'Vince', 'Rosa',
  'Kevin', 'Jada', 'Earl', 'Monique', 'Derek', 'Yuki', 'Barb', 'Luis', 'Shonda', 'Gus',
  'Trish', 'Marcus', 'Deb', 'Andre', 'Heather', 'Ray', 'Nina', 'Walt', 'Keisha', 'Hank',
]
export const LAST_INITIALS = 'ABCDEFGHJKLMNOPRSTVWY'
/** Rare pun tenants. */
export const PUN_NAMES = ['Stu Rage', 'Box Anne', 'Hugh Haul', 'Pat Lock', 'Clara Tter', 'Lee Sing', 'Moe Vinout', 'Rennie Tall']
export const PUN_CHANCE = 0.04
