// Global visual scale-up (user request: bigger character/enemies/obstacles,
// ~2-3x). Every SPATIAL and VELOCITY/ACCELERATION constant below is derived
// from its original (pre-scale) pixel value times WORLD_SCALE, which keeps
// the gameplay feel identical (jump arcs still cover the same number of
// TILES in the same number of seconds — see PLAN.md Phase 10 notes) while
// everything renders bigger. Durations (ms) and dimensionless values are
// left alone on purpose; scaling those would change timing/feel, not size.
export const WORLD_SCALE = 3

export const TILE_SIZE = 32 * WORLD_SCALE

export const GRAVITY_Y = 1200 * WORLD_SCALE

export const PLAYER_WALK_SPEED = 200 * WORLD_SCALE
export const PLAYER_RUN_SPEED = 300 * WORLD_SCALE
export const PLAYER_ACCEL = 1800 * WORLD_SCALE
export const PLAYER_JUMP_VELOCITY = 520 * WORLD_SCALE

export const COYOTE_TIME_MS = 120
export const JUMP_BUFFER_MS = 120

export const GAMEPAD_DEADZONE = 0.2

// --- Co-op (Phase 2) ---
export const SHARED_LIVES_START = 3
export const BUBBLE_RESCUE_WINDOW_MS = 6000
export const P2_IDLE_LEAVE_MS = 10000
export const CAMERA_EDGE_MARGIN = 48 * WORLD_SCALE
export const CAMERA_LERP = 0.1

// --- Items (Phase 5) ---
export const PLAYER_SMALL_HEIGHT = 40 * WORLD_SCALE
export const PLAYER_BIG_HEIGHT = 56 * WORLD_SCALE
export const HIT_INVINCIBLE_MS = 2000
export const STAR_INVINCIBLE_MS = 8000
export const MUSHROOM_SPEED = 60 * WORLD_SCALE
export const STAR_SPEED = 120 * WORLD_SCALE
export const STAR_BOUNCE_VELOCITY = 420 * WORLD_SCALE
export const FIREBALL_SPEED = 380 * WORLD_SCALE
export const FIREBALL_LIFETIME_MS = 2500

// Level-complete scoring — not spatial, left as-is.
export const LEVEL_CLEAR_BONUS = 500
export const TIME_BONUS_MAX = 300
export const TIME_BONUS_DECAY_PER_SECOND = 5

// --- Pipes / underwater bonus areas (see entities/Pipe.js, GameScene pipe warp) ---
// Multiplier on world gravity while a player is inside an underwater area —
// not spatial/velocity in the WORLD_SCALE sense (it's a ratio), so it's
// deliberately not multiplied by WORLD_SCALE.
export const WATER_GRAVITY_SCALE = 0.35
