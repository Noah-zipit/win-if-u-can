/* WIN IF U CAN — a brutally hard but beatable 2D platformer.
 * Phaser 3 + Kenney Platformer Art Deluxe (CC0, kenney.nl).
 * Mobile-first: big thumb buttons, multi-touch, landscape.
 */
'use strict';

/* Bridge shared with char3d.js (Three.js overlay) and the DOM touch buttons. */
window.WIUC = window.WIUC || { char: null, charRendered: false, charFailed: false };
window.WIUCInput = window.WIUCInput || null;

/* ================= WebAudio synth SFX — dark hell mix ================= */
const SFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },
  jump()   { this.tone(150, 0.16, 'sawtooth', 0.08, 420); },
  coin()   { this.tone(620, 0.08, 'sine', 0.10); this.tone(466, 0.14, 'sine', 0.10, null, 0.08); },
  death()  { this.tone(110, 0.7, 'sawtooth', 0.16, 32); this.tone(55, 0.7, 'square', 0.10, 28, 0.05); },
  stomp()  { this.tone(150, 0.14, 'square', 0.14, 45); },
  check()  { this.tone(392, 0.12, 'triangle', 0.12); this.tone(523, 0.20, 'triangle', 0.12, null, 0.10); },
  win()    { [220, 261.63, 329.63, 440, 523.25].forEach((f, i) => this.tone(f, 0.30, 'triangle', 0.13, null, i * 0.13)); },
  click()  { this.tone(320, 0.06, 'square', 0.07, 180); },
};

function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* noop */ }
}
window.SFX = SFX; // exposed for the DOM touch-button wiring in index.html

function fmtTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

/* ================= Boot: preload everything ================= */
class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  preload() {
    const A = 'assets/';
    // player
    this.load.image('p1_stand', A + 'p1_stand.png');
    this.load.image('p1_jump', A + 'p1_jump.png');
    this.load.image('p1_hurt', A + 'p1_hurt.png');
    this.load.image('p1_front', A + 'p1_front.png');
    this.load.atlas('p1walk', A + 'p1_walk.png', A + 'p1_walk.json');
    // enemies
    this.load.image('slime1', A + 'slimeWalk1.png');
    this.load.image('slime2', A + 'slimeWalk2.png');
    this.load.image('slimeDead', A + 'slimeDead.png');
    this.load.image('fly1', A + 'flyFly1.png');
    this.load.image('fly2', A + 'flyFly2.png');
    // items
    this.load.image('coin', A + 'coinGold.png');
    this.load.image('spikes', A + 'spikes.png');
    this.load.image('cloud1', A + 'cloud1.png');
    this.load.image('cloud2', A + 'cloud2.png');
    this.load.image('cloud3', A + 'cloud3.png');
    this.load.image('flag', A + 'flagGreen.png');
    this.load.image('flagOff', A + 'flagGreen2.png');
    this.load.image('star', A + 'star.png');
    // tiles
    ['grassMid', 'grassLeft', 'grassRight', 'grassCenter',
     'grassHalfMid', 'grassHalfLeft', 'grassHalfRight',
     'dirtMid', 'dirtCenter', 'box',
     'hill_large', 'hill_small'].forEach(t => this.load.image(t, A + t + '.png'));
  }
  create() {
    // wait (briefly) for the display font so canvas text doesn't FOUT
    const go = () => this.scene.start('title');
    if (document.fonts && document.fonts.load) {
      Promise.race([
        document.fonts.load('80px Bungee'),
        new Promise(r => setTimeout(r, 1600)),
      ]).then(go).catch(go);
    } else go();
  }
}

/* ================= Shared: hell sky gradient ================= */
function makeSky(scene, key) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 4, 540);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 540);
  g.addColorStop(0.0, '#030204');
  g.addColorStop(0.35, '#120607');
  g.addColorStop(0.62, '#2e0a08');
  g.addColorStop(0.82, '#5e1508');
  g.addColorStop(1.0, '#8a2a08');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 540);
  tex.refresh();
}

/* ================= Shared: procedural hell-rock tiles ================= */
function makeHellTiles(scene) {
  if (scene.textures.exists('hellTop')) return;
  const T = 70;
  const rock = (g, w, h, topEdge) => {
    g.fillStyle(0x171215, 1); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      g.fillStyle(Phaser.Utils.Array.GetRandom([0x0e0b0d, 0x21161a, 0x2b1c1e]), 1);
      g.fillRect(Phaser.Math.Between(1, w - 7), Phaser.Math.Between(1, h - 7),
        Phaser.Math.Between(2, 7), Phaser.Math.Between(2, 6));
    }
    // glowing lava cracks: 3 jagged polylines, wide dim orange under thin bright core
    for (let c = 0; c < 3; c++) {
      const pts = [];
      let px = Phaser.Math.Between(6, w - 6), py = Phaser.Math.Between(8, h - 8);
      pts.push([px, py]);
      for (let s = 0; s < 4; s++) {
        px = Phaser.Math.Clamp(px + Phaser.Math.Between(-16, 16), 2, w - 2);
        py = Phaser.Math.Clamp(py + Phaser.Math.Between(-14, 14), 2, h - 2);
        pts.push([px, py]);
      }
      const trace = () => {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) g.lineTo(pts[k][0], pts[k][1]);
        g.strokePath();
      };
      g.lineStyle(6, 0xff3d00, 0.30); trace();
      g.lineStyle(2, 0xffb13a, 0.90); trace();
    }
    if (topEdge) {
      // molten rim along the top edge
      g.fillStyle(0xff5a1a, 0.95); g.fillRect(0, 0, w, 5);
      g.fillStyle(0xffd23a, 0.95); g.fillRect(0, 0, w, 2);
      g.fillStyle(0xff5a1a, 0.18); g.fillRect(0, 5, w, 12);
    }
  };
  let g = scene.add.graphics();
  rock(g, T, T, true); g.generateTexture('hellTop', T, T); g.destroy();
  g = scene.add.graphics();
  rock(g, T, T, false); g.generateTexture('hellMid', T, T); g.destroy();
  g = scene.add.graphics();
  rock(g, T, 35, true); g.generateTexture('hellHalf', T, 35); g.destroy();
  // soft ember dot for particle systems
  g = scene.add.graphics();
  g.fillStyle(0xffffff, 1); g.fillCircle(8, 8, 7);
  g.fillStyle(0xffffff, 0.35); g.fillCircle(8, 8, 8);
  g.generateTexture('emberDot', 16, 16); g.destroy();
}

/* ================= Title screen ================= */
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    SFX.init();
    document.body.classList.add('on-title');
    makeSky(this, 'skyGrad');
    makeHellTiles(this);
    const W = 960, H = 540;
    this.add.image(W / 2, H / 2, 'skyGrad').setDisplaySize(W, H).setScrollFactor(0);

    // blood moon with hellish glow
    const moon = this.add.circle(800, 110, 46, 0x8a0f0f).setScrollFactor(0);
    this.add.circle(800, 110, 46, 0x4a0808, 0.55).setScrollFactor(0);
    this.add.circle(800, 110, 66, 0xff2a00, 0.22).setScrollFactor(0);
    this.tweens.add({ targets: moon, scale: 1.06, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // rising embers
    this.embers = this.add.particles(0, 0, 'emberDot', {
      speedY: { min: -70, max: -25 }, speedX: { min: -20, max: 20 },
      lifespan: { min: 4000, max: 7000 }, scale: { min: 0.12, max: 0.4 },
      alpha: { start: 0.85, end: 0 }, tint: [0xff5a1a, 0xff8c2a, 0xffd23a, 0xff2a00],
      frequency: 140, blendMode: 'ADD',
    }).setDepth(-6).setScrollFactor(0);
    this.embers.setEmitZone({ source: new Phaser.Geom.Rectangle(-40, 0, W + 80, H + 40) });

    // drifting smoke at 3 depths
    this.clouds = [];
    const cloudDefs = [
      { key: 'cloud1', y: 90, s: 1.6, v: 14, a: 0.55 }, { key: 'cloud3', y: 150, s: 1.2, v: 22, a: 0.5 },
      { key: 'cloud2', y: 210, s: 1.9, v: 10, a: 0.45 }, { key: 'cloud1', y: 260, s: 1.0, v: 30, a: 0.4 },
      { key: 'cloud3', y: 60, s: 0.8, v: 38, a: 0.35 },
    ];
    cloudDefs.forEach(c => {
      const img = this.add.image(Phaser.Math.Between(0, W), c.y, c.key)
        .setScale(c.s).setAlpha(c.a).setTint(0x3a3040).setScrollFactor(0);
      img._v = c.v; this.clouds.push(img);
    });

    // jagged dark rock silhouettes
    for (let i = 0; i < 8; i++) {
      this.add.image(i * 140 + 40, 470, i % 2 ? 'hill_small' : 'hill_large')
        .setScale(2.2).setAlpha(0.6).setTint(0x140a0c).setScrollFactor(0);
    }
    // scorched ground strip (hell tiles)
    for (let x = 0; x < W; x += 70) {
      this.add.image(x + 35, 505, 'hellTop');
    }

    // the 3D imp hero is rendered by the Three.js overlay (see char3d.js);
    // its screen position is written in update() below.
    // a hellspawn wandering by
    const slime = this.add.image(820, 462, 'slime1').setTint(0xb32312);
    const se1 = this.add.circle(0, 0, 3.4, 0xff2a00).setBlendMode(Phaser.BlendModes.ADD);
    const se2 = this.add.circle(0, 0, 3.4, 0xff2a00).setBlendMode(Phaser.BlendModes.ADD);
    this._titleEyes = { slime, se1, se2 };
    this.tweens.add({ targets: slime, x: 700, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onYoyo: () => slime.setFlipX(true), onRepeat: () => slime.setFlipX(false) });
    this.time.addEvent({ delay: 400, loop: true, callback: () =>
      slime.setTexture(slime.texture.key === 'slime1' ? 'slime2' : 'slime1') });

    // big burning title
    const title = this.add.text(W / 2, 170, 'WIN IF U CAN', {
      fontFamily: 'Bungee, sans-serif', fontSize: '88px', color: '#ff3d12',
      stroke: '#000000', strokeThickness: 12,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff5a1a', blur: 22, fill: true },
    }).setOrigin(0.5).setScrollFactor(0);
    this.tweens.add({ targets: title, y: 158, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(W / 2, 246, 'ESCAPE HELL — IF U CAN', {
      fontFamily: 'Bungee, sans-serif', fontSize: '22px', color: '#ffb37a',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0);

    // coins arc decoration
    for (let i = 0; i < 5; i++) {
      const c = this.add.image(330 + i * 75, 330 - Math.sin(i / 4 * Math.PI) * 46, 'coin').setScale(0.55);
      this.tweens.add({ targets: c, y: c.y - 10, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // best time
    const best = localStorage.getItem('wiuc_best');
    this.add.text(W / 2, 300, best ? 'BEST ESCAPE  ' + fmtTime(parseFloat(best)) : 'BEST ESCAPE  --:--', {
      fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#ff8c5a',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0);

    // tap to start
    const tap = this.add.text(W / 2, 380, 'TAP TO DESCEND', {
      fontFamily: 'Bungee, sans-serif', fontSize: '34px', color: '#ffd9b0',
      stroke: '#5e1508', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0);
    this.tweens.add({ targets: tap, alpha: 0.25, scale: 1.06, duration: 650, yoyo: true, repeat: -1 });

    this.add.text(W / 2, 440,
      'PHONE: use the on-screen buttons (landscape)   |   DESKTOP: arrows / A D + SPACE to jump', {
      fontFamily: 'Verdana, sans-serif', fontSize: '15px', color: '#e8a37a',
    }).setOrigin(0.5).setScrollFactor(0);
    this.add.text(W / 2, 518, 'Art: Kenney · Character: Quaternius  (CC0)', {
      fontFamily: 'Verdana, sans-serif', fontSize: '12px', color: '#a35a3a', fontStyle: 'italic',
    }).setOrigin(0.5).setScrollFactor(0);

    this.input.once('pointerdown', () => { SFX.init(); SFX.click(); this.scene.start('game'); });
  }
  update(time, delta) {
    const d = delta / 1000;
    this.clouds.forEach(c => {
      c.x += c._v * d;
      if (c.x > 960 + 130) c.x = -130;
    });
    // hellspawn eye glow follows the wanderer
    if (this._titleEyes) {
      const t = this._titleEyes;
      t.se1.setPosition(t.slime.x - 8, t.slime.y - 7);
      t.se2.setPosition(t.slime.x + 8, t.slime.y - 7);
    }
    // drive the 3D imp hero on the title screen (feet at y=470)
    if (window.WIUC && !window.WIUC.charFailed) {
      const rect = this.game.canvas.getBoundingClientRect();
      window.WIUC.char = {
        x: rect.left + 150 * (rect.width / 960),
        y: rect.top + 470 * (rect.height / 540),
        state: 'idle', face: 1, visible: true,
      };
    }
  }
}

/* ================= Game ================= */
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    SFX.init();
    document.body.classList.remove('on-title');
    const LV = LEVEL, PH = PHYS;
    this.playing = false; this.won = false; this.dead = false;
    this.time_s = 0; this.deaths = 0; this.coins = 0;
    this.coyoteUntil = 0; this.bufferUntil = 0;
    this.respawnX = LV.spawn.x;
    this.touch = { left: false, right: false };

    /* DOM touch buttons drive this.touch via window.WIUCInput (see index.html).
       Registered here so the buttons work the moment the scene boots. */
    window.WIUCInput = {
      left: (d) => { this.touch.left = !!d; },
      right: (d) => { this.touch.right = !!d; },
      jump: () => this.requestJump(),
    };

    makeSky(this, 'skyGrad');
    makeHellTiles(this);
    this.add.image(0, 0, 'skyGrad').setOrigin(0).setDisplaySize(LV.width, 540).setScrollFactor(1).setDepth(-10);
    // blood moon (world-locked, far)
    this.add.circle(500, 100, 40, 0x8a0f0f, 0.95).setDepth(-9);
    this.add.circle(500, 100, 40, 0x4a0808, 0.5).setDepth(-9);
    this.add.circle(500, 100, 62, 0xff2a00, 0.20).setDepth(-9);

    // ambient rising embers across the whole level
    this.embers = this.add.particles(0, 0, 'emberDot', {
      speedY: { min: -70, max: -25 }, speedX: { min: -20, max: 20 },
      lifespan: { min: 4000, max: 7000 }, scale: { min: 0.12, max: 0.4 },
      alpha: { start: 0.85, end: 0 }, tint: [0xff5a1a, 0xff8c2a, 0xffd23a, 0xff2a00],
      frequency: 150, blendMode: 'ADD',
    }).setDepth(-6);
    this.embers.setEmitZone({ source: new Phaser.Geom.Rectangle(-50, 0, LV.width + 100, 560) });

    // world decor: dark rock silhouettes, drifting smoke
    this.decorDrift = [];
    for (let x = 200; x < LV.width; x += 620) {
      this.add.image(x + Phaser.Math.Between(-80, 80), 440, 'hill_large').setScale(2).setAlpha(0.55).setTint(0x1c0e10).setDepth(-8);
      this.add.image(x + 300, 455, 'hill_small').setScale(1.8).setAlpha(0.5).setTint(0x140a0c).setDepth(-8);
    }
    const cloudKeys = ['cloud1', 'cloud2', 'cloud3'];
    for (let i = 0; i < 26; i++) {
      const c = this.add.image(Phaser.Math.Between(0, LV.width), Phaser.Math.Between(40, 300),
        cloudKeys[i % 3]).setScale(Phaser.Math.FloatBetween(1, 2.1))
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.55)).setTint(0x3a3040).setDepth(-7);
      c._v = Phaser.Math.FloatBetween(6, 20);
      this.decorDrift.push(c);
    }

    /* ---- terrain: scorched hell-rock ---- */
    this.terrain = this.physics.add.staticGroup();
    const put = (x, y, key) => this.terrain.create(x, y, key);
    // main ground: molten-rim top row, dark rock below
    LV.grounds.forEach(g => {
      const n = Math.round((g.x2 - g.x1) / 70);
      for (let i = 0; i < n; i++) {
        const cx = g.x1 + i * 70 + 35;
        put(cx, LV.groundTop + 35, 'hellTop');
        put(cx, LV.groundTop + 105, 'hellMid');
      }
    });
    // floating stair platforms
    LV.platforms.forEach(p => {
      const n = Math.round((p.x2 - p.x1) / 70);
      for (let i = 0; i < n; i++) {
        put(p.x1 + i * 70 + 35, p.top + 17.5, 'hellHalf');
      }
    });
    // bridge (narrow)
    {
      const b = LV.bridge, n = Math.round((b.x2 - b.x1) / 70);
      for (let i = 0; i < n; i++) {
        put(b.x1 + i * 70 + 35, b.top + 17.5, 'hellHalf');
      }
    }

    /* ---- moving platforms ---- */
    // pre-compose a 140x35 hell platform texture (two half-tiles side by side)
    if (!this.textures.exists('moverPlat')) {
      const rt = this.add.renderTexture(0, 0, 140, 35);
      rt.draw('hellHalf', 35, 17.5).draw('hellHalf', 105, 17.5);
      rt.saveTexture('moverPlat');
      rt.destroy();
    }
    this.movers = [];
    LV.movers.forEach(m => {
      const startX = m.axis === 'y' ? m.x + m.w / 2 : m.x1 + m.w / 2;
      const startY = m.axis === 'y' ? (m.yTop + m.yBot) / 2 + 17.5 : m.top + 17.5;
      const img = this.physics.add.image(startX, startY, 'moverPlat');
      img.body.setSize(140, 35);
      img.setImmovable(true); img.body.allowGravity = false;
      this.movers.push({ def: m, obj: img, phase: Math.random() * Math.PI * 2 });
    });

    /* ---- spikes: white-hot metal (generous hitboxes: smaller than the art) ---- */
    this.spikes = this.physics.add.staticGroup();
    LV.spikes.forEach(([x1, x2]) => {
      const n = Math.round((x2 - x1) / 70);
      for (let i = 0; i < n; i++) {
        const s = this.spikes.create(x1 + i * 70 + 35, LV.groundTop - 30, 'spikes');
        s.setTint(0xff7a2a);
        s.body.setSize(46, 36); s.body.setOffset(12, 26); s.refreshBody();
      }
    });

    /* ---- enemies: hellspawn ---- */
    this.enemies = this.physics.add.group();
    this.slimeList = [];
    this.enemyEyes = [];
    const addEyes = (e, spread, lift) => {
      const e1 = this.add.circle(0, 0, 3.4, 0xff2a00).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
      const e2 = this.add.circle(0, 0, 3.4, 0xff2a00).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
      this.enemyEyes.push({ e, e1, e2, spread, lift });
    };
    LV.slimes.forEach(s => {
      const e = this.enemies.create((s.x1 + s.x2) / 2, LV.groundTop - 16, 'slime1');
      e.setData({ type: 'slime', x1: s.x1, x2: s.x2, speed: s.speed, alive: true });
      e.setTint(0xb32312); // demonic red
      e.body.setSize(40, 24); e.body.setOffset(5, 4);
      e.setVelocityX(s.speed); e.setCollideWorldBounds(false);
      this.slimeList.push(e);
      addEyes(e, 8, 7);
    });
    this.flyers = [];
    LV.flyers.forEach(f => {
      const e = this.enemies.create(f.x, f.y, 'fly1');
      e.setData({ type: 'fly', ax: f.x, ay: f.y, amp: f.amp, period: f.period, alive: true, t: Math.random() * 10 });
      e.setTint(0x6a1230); // shadow-bat purple
      e.body.setSize(56, 28); e.body.setOffset(8, 4);
      e.body.allowGravity = false; e.body.setImmovable(true);
      this.flyers.push(e);
      addEyes(e, 10, 8);
    });
    this.time.addEvent({ delay: 350, loop: true, callback: () => {
      this.enemies.getChildren().forEach(e => {
        if (!e.getData('alive')) return;
        e.setTexture(e.getData('type') === 'slime'
          ? (e.texture.key === 'slime1' ? 'slime2' : 'slime1')
          : (e.texture.key === 'fly1' ? 'fly2' : 'fly1'));
      });
    }});

    /* ---- coins ---- */
    this.coinGroup = this.physics.add.staticGroup();
    LV.coins.forEach(([x, y]) => {
      const c = this.coinGroup.create(x, y, 'coin'); c.setScale(0.55);
      c.body.setSize(60, 60); c.body.setOffset(5, 5); c.refreshBody();
      this.tweens.add({ targets: c, scaleX: 0.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: (x % 500) });
    });

    /* ---- checkpoints: blood banners ---- */
    this.checkGroup = this.physics.add.staticGroup();
    this.checkFlags = [];
    LV.checkpoints.forEach((cx, i) => {
      const f = this.checkGroup.create(cx, LV.groundTop - 35, i === 0 ? 'flag' : 'flagOff');
      f.setTint(i === 0 ? 0xff4444 : 0x661111);
      f.setData('idx', i); f.setData('x', cx);
      this.checkFlags.push(f);
    });

    /* ---- goal: the escape portal banner ---- */
    this.goalFlag = this.add.image(LV.goal.flagX, LV.groundTop - 35, 'flag').setScale(1.2).setTint(0xff2222);
    this.tweens.add({ targets: this.goalFlag, y: LV.groundTop - 45, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.goalZone = this.add.zone((LV.goal.x1 + LV.goal.x2) / 2, LV.groundTop - 60, LV.goal.x2 - LV.goal.x1, 160);
    this.physics.add.existing(this.goalZone, true);

    /* ---- player: invisible physics body; the 3D imp (char3d.js) is the visual.
       If the 3D overlay fails, the 2D sprite is shown as fallback (see update). ---- */
    this.player = this.physics.add.sprite(LV.spawn.x, LV.spawn.y, 'p1_stand');
    this.player.setBodySize(46, 80, false);
    this.player.body.setOffset(10, 12);
    this.player.setCollideWorldBounds(false);
    this.player.setVisible(false);
    this.physics.world.setBounds(0, 0, LV.width, 540);
    if (!this.anims.exists('walk')) {
      this.anims.create({
        key: 'walk', frames: this.anims.generateFrameNames('p1walk', { prefix: 'walk', start: 1, end: 11 }),
        frameRate: 13, repeat: -1,
      });
    }

    /* ---- colliders / overlaps ---- */
    this.physics.add.collider(this.player, this.terrain);
    this.physics.add.collider(this.slimeList, this.terrain);
    this.moverBodies = this.movers.map(m => m.obj);
    this.physics.add.collider(this.player, this.moverBodies);
    this.physics.add.overlap(this.player, this.spikes, () => this.die());
    this.physics.add.overlap(this.player, this.coinGroup, (p, c) => this.collectCoin(c));
    this.physics.add.overlap(this.player, this.checkGroup, (p, f) => this.hitCheckpoint(f));
    this.physics.add.overlap(this.player, this.enemies, (p, e) => this.hitEnemy(e));
    this.physics.add.overlap(this.player, this.goalZone, () => this.winGame());

    /* ---- particles: hellfire and cinders ---- */
    this.dust = this.add.particles(0, 0, 'emberDot', {
      speed: { min: 40, max: 140 }, lifespan: 450, scale: { start: 0.5, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: [0x8a6a5a, 0xff5a1a, 0x5a3a3a], emitting: false,
    }).setDepth(5);
    this.boom = this.add.particles(0, 0, 'emberDot', {
      speed: { min: 120, max: 420 }, lifespan: 900, scale: { start: 1.0, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xff2a00, 0xff5a1a, 0xff8c2a, 0xffd23a],
      blendMode: 'ADD', emitting: false,
    }).setDepth(5);
    this.sparkle = this.add.particles(0, 0, 'coin', {
      speed: { min: 60, max: 200 }, lifespan: 500, scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(5);
    this.confetti = this.add.particles(0, 0, 'emberDot', {
      speed: { min: 150, max: 420 }, lifespan: 1200, scale: { start: 0.7, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xff2a00, 0xff5a1a, 0xffd23a],
      blendMode: 'ADD', emitting: false, gravityY: 500,
    }).setDepth(50);

    /* ---- camera ---- */
    const cam = this.cameras.main;
    cam.setBounds(0, 0, LV.width, 540);
    cam.startFollow(this.player, false, 0.12, 0.12);
    cam.setDeadzone(140, 90);
    cam.setBackgroundColor('#030204');

    /* ---- HUD ---- */
    const hudStyle = { fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#ffd9b0', stroke: '#000000', strokeThickness: 5 };
    this.hudCoinIcon = this.add.image(34, 30, 'coin').setScale(0.42).setScrollFactor(0).setDepth(100);
    this.hudCoins = this.add.text(58, 16, '0', hudStyle).setScrollFactor(0).setDepth(100);
    this.hudTime = this.add.text(480, 16, '0:00', hudStyle).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    this.hudDeaths = this.add.text(926, 16, 'DEATHS 0', { ...hudStyle, color: '#ff8a7a' }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.toast = this.add.text(480, 120, '', {
      fontFamily: 'Bungee, sans-serif', fontSize: '30px', color: '#ffb13a',
      stroke: '#000000', strokeThickness: 7,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);

    /* ---- input: keyboard (touch buttons are DOM elements wired via window.WIUCInput) ---- */
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A, d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE, up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    });
    this.input.keyboard.on('keydown-SPACE', () => this.requestJump());
    this.input.keyboard.on('keydown-UP', () => this.requestJump());
    this.input.keyboard.on('keydown-W', () => this.requestJump());

    if (!this.sys.game.device.input.touch) {
      const hint = this.add.text(480, 500, 'ARROWS / A D to move · SPACE to jump', {
        fontFamily: 'Verdana, sans-serif', fontSize: '15px', color: '#e8a37a',
        backgroundColor: '#00000088', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
      this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 1200 });
    }

    this.playing = true;
    this.cameras.main.fadeIn(400, 40, 5, 5);
  }

  /* ============ gameplay ============ */
  requestJump() {
    if (!this.playing || this.won || this.dead) return;
    this.bufferUntil = this.time.now + PHYS.bufferMs;
  }

  doJump() {
    const p = this.player;
    p.setVelocityY(PHYS.jumpV);
    this.coyoteUntil = 0; this.bufferUntil = 0;
    SFX.jump(); vibrate(6);
    this.dust.explode(8, p.x, p.body.bottom);
  }

  collectCoin(c) {
    if (!c.active) return;
    c.disableBody(true, true);
    this.coins++;
    this.hudCoins.setText(String(this.coins));
    SFX.coin();
    this.sparkle.explode(10, c.x, c.y);
    this.tweens.add({ targets: this.hudCoinIcon, scale: 0.55, duration: 90, yoyo: true });
  }

  hitCheckpoint(f) {
    const idx = f.getData('idx');
    if (f.texture.key === 'flag') return; // already active
    f.setTexture('flag');
    this.respawnX = f.getData('x');
    SFX.check();
    this.confetti.explode(22, f.x, f.y - 60);
    this.showToast(idx === 0 ? 'START' : 'CHECKPOINT!');
  }

  showToast(msg) {
    this.toast.setText(msg).setAlpha(1).setScale(0.6);
    this.tweens.killTweensOf(this.toast);
    this.tweens.add({ targets: this.toast, alpha: 1, scale: 1.1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toast, alpha: 0, delay: 1100, duration: 400 });
  }

  hitEnemy(e) {
    if (!e.getData('alive') || this.dead || this.won) return;
    const p = this.player;
    const stomping = p.body.velocity.y > 60 && (p.body.bottom - e.body.top) < 28;
    if (stomping) {
      e.setData('alive', false);
      SFX.stomp(); vibrate(12);
      this.boom.explode(14, e.x, e.y);
      this.tweens.add({ targets: e, scaleY: 0.12, scaleX: 1.4, duration: 160, onComplete: () => e.disableBody(true, true) });
      p.setVelocityY(-520); // stomp bounce
    } else {
      this.die();
    }
  }

  die() {
    if (this.dead || this.won || !this.playing) return;
    this.dead = true;
    this.deaths++;
    this.hudDeaths.setText('DEATHS ' + this.deaths);
    SFX.death(); vibrate(70);
    this.cameras.main.shake(260, 0.022);
    const p = this.player;
    p.setTexture('p1_hurt');
    p.body.setVelocity(0, -520);
    p.body.checkCollision.none = true;
    this.boom.explode(26, p.x, p.y);
    this.tweens.add({ targets: p, angle: 360, duration: 650, ease: 'Cubic.easeIn' });
    this.time.delayedCall(750, () => this.respawn());
  }

  respawn() {
    const p = this.player;
    p.body.checkCollision.none = false;
    p.setAngle(0).setTexture('p1_stand');
    p.setPosition(this.respawnX, 300).setVelocity(0, 0);
    this.dead = false;
    this.cameras.main.fadeIn(250, 40, 5, 5);
  }

  winGame() {
    if (this.won || this.dead) return;
    this.won = true;
    this.playing = false;
    SFX.win(); vibrate([30, 50, 30, 50, 80]);
    const p = this.player;
    p.setVelocity(0, 0); p.body.setImmovable(true); p.body.allowGravity = false;
    p.setTexture('p1_front');
    this.tweens.add({ targets: p, y: p.y - 60, duration: 350, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    this.confetti.explode(80, p.x, p.y - 80);
    const t = this.time_s, d = this.deaths;
    let rank = 'C';
    if (d === 0 && t < 90) rank = 'S';
    else if (d <= 2 && t < 150) rank = 'A';
    else if (d <= 6) rank = 'B';
    const prevBest = parseFloat(localStorage.getItem('wiuc_best') || '1e9');
    const isBest = t < prevBest;
    if (isBest) localStorage.setItem('wiuc_best', String(t));

    this.time.delayedCall(1400, () => {
      const W = 960, H = 540;
      const dim = this.add.rectangle(0, 0, W, H).setOrigin(0).setFillStyle(0x0a0506, 0.82).setScrollFactor(0).setDepth(950);
      const panel = this.add.rectangle(W / 2, H / 2, 560, 400, 0x2a0d0d, 1).setStrokeStyle(6, 0xff5a1a).setScrollFactor(0).setDepth(951);
      const base = [
        this.add.text(W / 2, H / 2 - 150, 'ESCAPED HELL?!', { fontFamily: 'Bungee, sans-serif', fontSize: '52px', color: '#ff5a1a', stroke: '#000000', strokeThickness: 10 }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 - 84, isBest ? 'NEW BEST ESCAPE!' : 'LEVEL 1 CLEARED', { fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#ffb13a' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 - 30, 'TIME   ' + fmtTime(t), { fontFamily: 'Bungee, sans-serif', fontSize: '26px', color: '#ffffff' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 + 8, 'DEATHS   ' + d + '      COINS   ' + this.coins, { fontFamily: 'Bungee, sans-serif', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 + 58, 'RANK', { fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#caf0f8' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 + 112, rank, { fontFamily: 'Bungee, sans-serif', fontSize: '72px', color: rank === 'S' ? '#ffd60a' : '#ffffff', stroke: '#7b2d00', strokeThickness: 8 }).setOrigin(0.5),
      ];
      base.forEach(o => { o.setScrollFactor(0).setDepth(952); });
      const again = this.add.text(W / 2, H / 2 + 178, 'DESCEND AGAIN', {
        fontFamily: 'Bungee, sans-serif', fontSize: '26px', color: '#ffffff',
        backgroundColor: '#8a1e08', padding: { x: 26, y: 12 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(952).setInteractive({ useHandCursor: true });
      again.on('pointerdown', () => { SFX.click(); this.scene.restart(); });
      this.tweens.add({ targets: base[5], scale: 1.12, duration: 500, yoyo: true, repeat: -1 });
      this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
    });
  }

  update(time, delta) {
    const p = this.player;
    if (!p || !p.body) return;

    // drifting decor clouds
    const d = delta / 1000;
    this.decorDrift.forEach(c => {
      c.x += c._v * d;
      if (c.x > LEVEL.width + 140) c.x = -140;
    });

    // movers: kinematic sine motion (position set here, body synced immediately)
    this.movers.forEach(m => {
      const def = m.def, o = m.obj;
      const oldX = o.x, oldY = o.y;
      const ph = (time / def.period) * Math.PI * 2 + m.phase;
      if (def.axis === 'y') {
        o.y = (def.yTop + def.yBot) / 2 + 17.5 - ((def.yBot - def.yTop) / 2) * Math.cos(ph);
      } else {
        o.x = (def.x1 + def.x2) / 2 + def.w / 2 + ((def.x2 - def.x1) / 2) * Math.sin(ph);
      }
      m.dx = o.x - oldX; m.dy = o.y - oldY;
      o.body.updateFromGameObject();
    });
    // carry the player along on movers (arcade has no platform friction)
    if (p.body.touching.down && !this.dead && !this.won) {
      for (const m of this.movers) {
        const o = m.obj;
        if (Math.abs(p.body.bottom - o.body.top) < 12 &&
            p.body.right > o.body.left + 4 && p.body.left < o.body.right - 4) {
          p.x += (m.dx || 0); p.y += (m.dy || 0);
          p.body.updateFromGameObject();
          break;
        }
      }
    }

    // slime patrol
    this.enemies.getChildren().forEach(e => {
      if (!e.getData('alive')) return;
      if (e.getData('type') === 'slime') {
        const x1 = e.getData('x1'), x2 = e.getData('x2');
        if (e.x <= x1 + 20) { e.setVelocityX(Math.abs(e.getData('speed'))); e.setFlipX(false); }
        else if (e.x >= x2 - 20) { e.setVelocityX(-Math.abs(e.getData('speed'))); e.setFlipX(true); }
      } else {
        // flyer: sine around anchor
        const t = (time / 1000) + e.getData('t');
        e.x = e.getData('ax') + Math.sin(t * 1.7) * 60;
        e.y = e.getData('ay') + Math.sin(t * (Math.PI * 2 / (e.getData('period') / 1000))) * e.getData('amp');
        e.body.updateFromGameObject();
      }
    });

    // hellspawn glowing eyes track their bodies (hidden when dead)
    this.enemyEyes.forEach(({ e, e1, e2, spread, lift }) => {
      const vis = e.getData('alive') && e.active;
      e1.setVisible(vis); e2.setVisible(vis);
      if (vis) {
        e1.setPosition(e.x - spread, e.y - lift);
        e2.setPosition(e.x + spread, e.y - lift);
      }
    });

    // ---- 3D imp overlay sync (CSS px, feet position). Runs even when dead/won
    // so the imp plays its death/victory animation. Falls back to the 2D sprite
    // if the Three.js overlay never renders (charRendered) or reports failure. ----
    {
      const use3d = !!(window.WIUC && window.WIUC.charRendered && !window.WIUC.charFailed);
      if (p.visible === use3d) p.setVisible(!use3d);
      if (window.WIUC && !window.WIUC.charFailed) {
        const rect = this.game.canvas.getBoundingClientRect();
        const cam = this.cameras.main;
        const kx = rect.width / this.scale.width;
        const ky = rect.height / this.scale.height;
        let state = 'idle';
        if (this.dead) state = 'dead';
        else if (this.won) state = 'win';
        else if (this.playing) {
          const grounded = p.body.blocked.down || p.body.touching.down;
          const moving = Math.abs(p.body.velocity.x) > 20;
          state = !grounded ? (p.body.velocity.y < 0 ? 'jump' : 'fall') : (moving ? 'run' : 'idle');
        }
        window.WIUC.char = {
          x: rect.left + (p.x - cam.scrollX) * kx,
          y: rect.top + (p.body.bottom - cam.scrollY) * ky,
          state: state,
          face: p.flipX ? -1 : 1,
          visible: true,
        };
      }
    }

    if (!this.playing || this.won || this.dead) return;

    // timer
    this.time_s += d;
    this.hudTime.setText(fmtTime(this.time_s));

    // fell in a pit
    if (p.y > 660) { this.die(); return; }

    // horizontal input: keyboard or touch
    const k = this.keys;
    const left = k.left.isDown || k.a.isDown || this.touch.left;
    const right = k.right.isDown || k.d.isDown || this.touch.right;
    if (left && !right) { p.setVelocityX(-PHYS.speed); p.setFlipX(true); }
    else if (right && !left) { p.setVelocityX(PHYS.speed); p.setFlipX(false); }
    else p.setVelocityX(0);

    // grounded / coyote / buffer
    const onGround = p.body.blocked.down || p.body.touching.down;
    if (onGround) {
      if (!this.wasGrounded) {
        // landing dust
        if (this.fallSpeed > 700) this.dust.explode(10, p.x, p.body.bottom);
        this.wasGrounded = true;
      }
      this.coyoteUntil = time + PHYS.coyoteMs;
    } else {
      this.wasGrounded = false;
    }
    this.fallSpeed = p.body.velocity.y;
    if (time < this.bufferUntil && time < this.coyoteUntil) this.doJump();

    // animation state
    if (!onGround) {
      if (p.texture.key !== 'p1_jump') p.setTexture('p1_jump');
      p.anims.stop();
    } else if (left || right) {
      p.anims.play('walk', true);
    } else {
      p.anims.stop();
      if (p.texture.key !== 'p1_stand') p.setTexture('p1_stand');
    }
  }
}

/* ================= boot ================= */
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960, height: 540,
  backgroundColor: '#0a0506',
  // crisp rendering on high-DPI phones: render buffer scaled by devicePixelRatio
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  roundPixels: true,
  physics: { default: 'arcade', arcade: { gravity: { y: PHYS.gravity }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, GameScene],
  disableContextMenu: true,
};
window.addEventListener('load', () => { new Phaser.Game(config); });
