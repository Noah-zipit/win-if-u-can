# WIN IF U CAN

An extremely hard — but beatable — 2D platformer set in **hell**. You are a little imp trying to escape. Precision jumps over lava pits, moving platforms, stompable hellspawn, spike gauntlets, checkpoints, and a rank screen for those who survive Level 1.

**Play it:** https://win-if-u-can.vercel.app

## Controls

- **Phone (landscape):** big glowing DOM ◀ ▶ + JUMP buttons — true multi-touch, run and jump at the same time. Rotate your phone sideways; a ⛶ button toggles real fullscreen.
- **Desktop:** Arrow keys / A D to move, Space / W / ↑ to jump.

## Features

- **Real-time 3D player:** a Quaternius goblin (CC0, hell-tinted into an imp with glowing eyes) rendered by Three.js and synced to the physics body every frame — idle / run / jump / fall / death / win animations. Falls back to the 2D sprite if WebGL or the model fails.
- Phaser 3 arcade physics: coyote time (100ms), jump buffering (120ms), generous hitboxes
- Checkpoints after every hard section, instant respawn, death counter, timer
- Win screen with time, deaths, coins, and S/A/B/C rank (best time saved locally)
- Dark synthesized WebAudio SFX — no audio files
- Hellfire particles, screen shake, rising embers, blood moon, animated title screen

## Tech

- [Phaser 3](https://phaser.io) via CDN, `resolution` set to devicePixelRatio for crisp rendering
- [Three.js](https://threejs.org) overlay (transparent canvas, orthographic 1:1 screen mapping)
- Art: [Kenney Platformer Art Deluxe](https://kenney.nl/assets/platformer-art-deluxe) (CC0) — see `assets/KENNEY-LICENSE.txt`
- Character: [Quaternius](https://quaternius.com) Animated Goblin (CC0)

## Beatability

Every required jump in Level 1 is validated against the game's real physics constants (`level.js` is the single source of truth, shared with the validator): hardest jumps use ~62% of the theoretical maximum, with coyote time and jump buffering as extra margin. Hard, not unfair.

## License

MIT — see [LICENSE](LICENSE).
