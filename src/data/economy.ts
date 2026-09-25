// General economy, rating, and timing knobs.

/** One "business tick": rating updates (and payroll, once staff exist). */
export const TICK_SECONDS = 300

export const SELL_REFUND = 0.5
/** Full refund if sold within this many seconds of placing (misclick grace). */
export const SELL_GRACE_SECONDS = 10

export const RATING_START = 3
export const RATING_MAX = 5
/** Passive climb per tick when nothing is wrong. */
export const RATING_GAIN_PER_TICK = 0.1
/** Drop per tick for each ongoing problem (angry tenant, blackout, long-dirty unit). */
export const RATING_LOSS_PER_ISSUE = 0.15
export const RATING_EVICTION_HIT = 0.5
/** A vacated unit left dirty this many ticks starts hurting the rating. */
export const DIRTY_TICKS_BEFORE_ISSUE = 3
/** Bonus rent at a full 5 stars. */
export const FIVE_STAR_RENT_BONUS = 0.1
/** Ticks at zero rating with no gain before everyone pulls out. */
export const FAIL_STRIKES = 3

/** Offline catch-up is capped at this many hours. */
export const OFFLINE_CAP_HOURS = 72
