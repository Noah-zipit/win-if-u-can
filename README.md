# WIN IF U CAN

An extremely hard — but beatable — 2D platformer for the web. Precision jumps, moving platforms, stompable enemies, spike pits, checkpoints, and a rank screen for those who survive Level 1.

**Play it:** https://win-if-u-can.vercel.app

## Controls

- **Phone (landscape):** big on-screen ◀ ▶ + JUMP buttons. Multi-touch works — hold run and tap jump at the same time.
- **Desktop:** Arrow keys / A D to move, Space / W / ↑ to jump.

## Features

- Phaser 3 arcade physics: coyote time (100ms), jump buffering (120ms), generous hitboxes
- Checkpoints after every hard section, instant respawn, death counter, timer
- Win screen with time, deaths, coins, and S/A/B/C rank (best time saved locally)
- Synthesized WebAudio SFX — no audio files
- Particles, screen shake, parallax clouds, animated title screen

## Tech

- [Phaser 3](https://phaser.io) via CDN
- Art: [Kenney Platformer Art Deluxe](https://kenney.nl/assets/platformer-art-deluxe) (CC0) — see `assets/KENNEY-LICENSE.txt`

## Beatability

Every required jump in Level 1 is validated by `validate-level.js` (kept out of the deploy) against the game's real physics constants: hardest jumps use ~62% of the theoretical maximum, with coyote time and jump buffering as extra margin. Hard, not unfair.

## License

MIT — see [LICENSE](LICENSE).
