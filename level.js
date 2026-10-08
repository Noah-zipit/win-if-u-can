/* WIN IF U CAN — level data + physics constants.
 * Shared between game.js (browser) and validate-level.js (node).
 * Units: pixels. Tile size 70. Canvas 960x540. Ground top surface y=470.
 */
(function (root) {
  const PHYS = {
    gravity: 2200,
    jumpV: -820,      // max jump height = v^2/2g = 152.8px
    speed: 280,       // max horizontal jump dist = 2*v/g*speed = 208.7px
    coyoteMs: 100,
    bufferMs: 120,
    // Design budget (hard but fair): every required jump must fit inside these.
    maxRise: 105,     // 69% of theoretical max
    maxGap: 150,      // 72% of theoretical max
  };

  const LEVEL = {
    width: 6120,
    groundTop: 470,
    spawn: { x: 120, y: 300 },
    // Main ground segments (top surface y=470)
    grounds: [
      { x1: 0, x2: 1050 },
      { x1: 1180, x2: 1600 },
      { x1: 2300, x2: 2750 },
      { x1: 3050, x2: 3950 },
      { x1: 4080, x2: 4600 },
      { x1: 5300, x2: 6120 },
    ],
    // Floating platforms {x1,x2,top}
    platforms: [
      { x1: 2450, x2: 2590, top: 400 },
      { x1: 2650, x2: 2790, top: 330 },
      { x1: 2850, x2: 2990, top: 260 },
    ],
    // Moving platforms. A: vertical (timing). B: horizontal (timing).
    movers: [
      { id: 'A', x: 1650, w: 140, yTop: 375, yBot: 465, axis: 'y', period: 3000 },
      { id: 'B', x1: 1900, x2: 2080, w: 140, top: 350, axis: 'x', period: 3600 },
    ],
    bridge: { x1: 4600, x2: 5300, top: 400 },
    // Spike strips sitting on ground: [x1, x2] (70px each = one tile)
    spikes: [
      [560, 630], [840, 910],          // intro hops
      [2400, 2470],                     // under staircase (fall = death, checkpoint nearby)
      [5400, 5470], [5560, 5630],      // final gauntlet
    ],
    slimes: [
      { x1: 3200, x2: 3450, speed: 70 },
      { x1: 3500, x2: 3700, speed: 85 },
      { x1: 5650, x2: 5850, speed: 90 },
    ],
    flyers: [
      { x: 4800, y: 280, amp: 70, period: 2500 },
      { x: 5100, y: 280, amp: 70, period: 2100 },
    ],
    coins: [
      // arcs over intro spikes
      [575, 380], [595, 360], [615, 380],
      [855, 380], [875, 360], [895, 380],
      // over first pit
      [1075, 380], [1100, 365], [1130, 365], [1155, 380],
      // mover section (reward for timing)
      [1690, 280], [1720, 270], [1750, 280],
      [1960, 260], [2010, 250], [2060, 260],
      // staircase
      [2500, 330], [2540, 330], [2700, 260], [2740, 260], [2900, 190], [2940, 190],
      // over slimes (risky)
      [3290, 360], [3325, 345], [3360, 360],
      [3570, 360], [3600, 345], [3630, 360],
      // bridge run
      [4700, 320], [4800, 320], [4900, 320], [5000, 320], [5100, 320], [5200, 320],
      // final spikes
      [5415, 380], [5435, 360], [5455, 380],
      [5575, 380], [5595, 360], [5615, 380],
    ],
    checkpoints: [140, 1230, 2360, 3120, 4140, 4500, 5850],
    goal: { x1: 5930, x2: 6010, flagX: 5970 },
    // Ordered traversal segments used by the beatability validator.
    // Movers are listed at the phase the player must use (timing is the challenge).
    traversal: [
      { name: 'start ground', x1: 0, x2: 1050, top: 470 },
      { name: 'pit 1', x1: 1180, x2: 1600, top: 470 },
      { name: 'mover A (at top)', x1: 1650, x2: 1790, top: 375 },
      { name: 'mover B (at left)', x1: 1900, x2: 2040, top: 350 },
      { name: 'mover B (at right)', x1: 2080, x2: 2220, top: 350 },
      { name: 'ground 3', x1: 2300, x2: 2750, top: 470 },
      { name: 'stair 1', x1: 2450, x2: 2590, top: 400 },
      { name: 'stair 2', x1: 2650, x2: 2790, top: 330 },
      { name: 'stair 3', x1: 2850, x2: 2990, top: 260 },
      { name: 'slime alley', x1: 3050, x2: 3950, top: 470 },
      { name: 'ground 5', x1: 4080, x2: 4600, top: 470 },
      { name: 'bridge', x1: 4600, x2: 5300, top: 400 },
      { name: 'final ground', x1: 5300, x2: 6120, top: 470 },
    ],
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LEVEL, PHYS };
  } else {
    root.LEVEL = LEVEL;
    root.PHYS = PHYS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
