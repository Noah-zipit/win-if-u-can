/* WIN IF U CAN — a brutally hard but beatable 2D platformer.
 * Phaser 3 + Kenney Platformer Art Deluxe (CC0, kenney.nl).
 * Mobile-first: big thumb buttons, multi-touch, landscape.
 */
'use strict';

/* ================= WebAudio synth SFX (no audio files needed) ================= */
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
  jump()   { this.tone(280, 0.18, 'square', 0.10, 640); },
  coin()   { this.tone(950, 0.07, 'sine', 0.12); this.tone(1420, 0.12, 'sine', 0.12, null, 0.07); },
  death()  { this.tone(420, 0.5, 'sawtooth', 0.14, 70); },
  stomp()  { this.tone(220, 0.12, 'square', 0.14, 60); },
  check()  { this.tone(660, 0.09, 'sine', 0.12); this.tone(990, 0.16, 'sine', 0.12, null, 0.09); },
  win()    { [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.14, null, i * 0.11)); },
  click()  { this.tone(700, 0.06, 'square', 0.08, 900); },
};

function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* noop */ }
}

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

/* ================= Shared: gradient sky texture ================= */
function makeSky(scene, key) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, 4, 540);
  const ctx = tex.getContext();
  const g = ctx.createLinearGradient(0, 0, 0, 540);
  g.addColorStop(0.0, '#120e4d');
  g.addColorStop(0.35, '#27348f');
  g.addColorStop(0.62, '#3f8fd2');
  g.addColorStop(0.82, '#7fd4e8');
  g.addColorStop(1.0, '#ffe9a8');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 540);
  tex.refresh();
}

/* ================= Title screen ================= */
class TitleScene extends Phaser.Scene {
  constructor() { super('title'); }
  create() {
    SFX.init();
    makeSky(this, 'skyGrad');
    const W = 960, H = 540;
    this.add.image(W / 2, H / 2, 'skyGrad').setDisplaySize(W, H).setScrollFactor(0);

    // sun with glow
    const sun = this.add.circle(800, 110, 46, 0xffe066).setScrollFactor(0);
    this.add.circle(800, 110, 62, 0xffe066, 0.25).setScrollFactor(0);
    this.tweens.add({ targets: sun, scale: 1.08, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // drifting clouds at 3 depths
    this.clouds = [];
    const cloudDefs = [
      { key: 'cloud1', y: 90, s: 1.6, v: 14, a: 0.9 }, { key: 'cloud3', y: 150, s: 1.2, v: 22, a: 0.8 },
      { key: 'cloud2', y: 210, s: 1.9, v: 10, a: 0.7 }, { key: 'cloud1', y: 260, s: 1.0, v: 30, a: 0.6 },
      { key: 'cloud3', y: 60, s: 0.8, v: 38, a: 0.5 },
    ];
    cloudDefs.forEach(c => {
      const img = this.add.image(Phaser.Math.Between(0, W), c.y, c.key)
        .setScale(c.s).setAlpha(c.a).setScrollFactor(0);
      img._v = c.v; this.clouds.push(img);
    });

    // rolling hills silhouette
    for (let i = 0; i < 8; i++) {
      this.add.image(i * 140 + 40, 470, i % 2 ? 'hill_small' : 'hill_large')
        .setScale(2.2).setAlpha(0.55).setTint(0x2d6a4f).setScrollFactor(0);
    }
    // ground strip
    for (let x = 0; x < W; x += 70) {
      this.add.image(x + 35, 505, x === 0 ? 'grassLeft' : (x + 70 >= W ? 'grassRight' : 'grassMid'));
    }

    // hero alien bouncing on the strip
    const hero = this.add.sprite(150, 420, 'p1_stand').setScale(1.15);
    this.tweens.add({ targets: hero, y: 386, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // a slime wandering by
    const slime = this.add.image(820, 462, 'slime1');
    this.tweens.add({ targets: slime, x: 700, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      onYoyo: () => slime.setFlipX(true), onRepeat: () => slime.setFlipX(false) });
    this.time.addEvent({ delay: 400, loop: true, callback: () =>
      slime.setTexture(slime.texture.key === 'slime1' ? 'slime2' : 'slime1') });

    // big colorful title
    const title = this.add.text(W / 2, 170, 'WIN IF U CAN', {
      fontFamily: 'Bungee, sans-serif', fontSize: '88px', color: '#ffd60a',
      stroke: '#7b2d00', strokeThickness: 12,
      shadow: { offsetX: 0, offsetY: 8, color: '#000', blur: 0, fill: true },
    }).setOrigin(0.5).setScrollFactor(0);
    this.tweens.add({ targets: title, y: 158, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(W / 2, 246, 'THE HARDEST 2D PLATFORMER ON YOUR PHONE', {
      fontFamily: 'Bungee, sans-serif', fontSize: '22px', color: '#ffffff',
      stroke: '#1d3557', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0);

    // coins arc decoration
    for (let i = 0; i < 5; i++) {
      const c = this.add.image(330 + i * 75, 330 - Math.sin(i / 4 * Math.PI) * 46, 'coin').setScale(0.55);
      this.tweens.add({ targets: c, y: c.y - 10, duration: 700 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // best time
    const best = localStorage.getItem('wiuc_best');
    this.add.text(W / 2, 300, best ? 'BEST TIME  ' + fmtTime(parseFloat(best)) : 'BEST TIME  --:--', {
      fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#ffe66d',
      stroke: '#1d3557', strokeThickness: 5,
    }).setOrigin(0.5).setScrollFactor(0);

    // tap to start
    const tap = this.add.text(W / 2, 380, 'TAP TO START', {
      fontFamily: 'Bungee, sans-serif', fontSize: '34px', color: '#ffffff',
      stroke: '#c1121f', strokeThickness: 8,
    }).setOrigin(0.5).setScrollFactor(0);
    this.tweens.add({ targets: tap, alpha: 0.25, scale: 1.06, duration: 650, yoyo: true, repeat: -1 });

    this.add.text(W / 2, 440,
      'PHONE: use the on-screen buttons (landscape)   |   DESKTOP: arrows / A D + SPACE to jump', {
      fontFamily: 'Verdana, sans-serif', fontSize: '15px', color: '#eaf6ff',
    }).setOrigin(0.5).setScrollFactor(0);
    this.add.text(W / 2, 518, 'Art: Kenney  ·  kenney.nl  (CC0)', {
      fontFamily: 'Verdana, sans-serif', fontSize: '12px', color: '#bde0fe', fontStyle: 'italic',
    }).setOrigin(0.5).setScrollFactor(0);

    this.input.once('pointerdown', () => { SFX.init(); SFX.click(); this.scene.start('game'); });
  }
  update(time, delta) {
    const d = delta / 1000;
    this.clouds.forEach(c => {
      c.x += c._v * d;
      if (c.x > 960 + 130) c.x = -130;
    });
  }
}

/* ================= Game ================= */
class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create() {
    SFX.init();
    this.input.addPointer(2); // multi-touch: run + jump at once
    const LV = LEVEL, PH = PHYS;
    this.playing = false; this.won = false; this.dead = false;
    this.time_s = 0; this.deaths = 0; this.coins = 0;
    this.coyoteUntil = 0; this.bufferUntil = 0;
    this.respawnX = LV.spawn.x;
    this.touch = { left: false, right: false };
    this.isTouchDevice = this.sys.game.device.input.touch;

    makeSky(this, 'skyGrad');
    this.add.image(0, 0, 'skyGrad').setOrigin(0).setDisplaySize(LV.width, 540).setScrollFactor(1).setDepth(-10);
    // sun (world-locked, far)
    this.add.circle(500, 100, 40, 0xffe066, 0.9).setDepth(-9);
    this.add.circle(500, 100, 58, 0xffe066, 0.22).setDepth(-9);

    // world decor: hills, bushes, drifting clouds
    this.decorDrift = [];
    for (let x = 200; x < LV.width; x += 620) {
      this.add.image(x + Phaser.Math.Between(-80, 80), 440, 'hill_large').setScale(2).setAlpha(0.5).setTint(0x3a7d5c).setDepth(-8);
      this.add.image(x + 300, 455, 'hill_small').setScale(1.8).setAlpha(0.45).setTint(0x2d6a4f).setDepth(-8);
    }
    const cloudKeys = ['cloud1', 'cloud2', 'cloud3'];
    for (let i = 0; i < 26; i++) {
      const c = this.add.image(Phaser.Math.Between(0, LV.width), Phaser.Math.Between(40, 300),
        cloudKeys[i % 3]).setScale(Phaser.Math.FloatBetween(1, 2.1))
        .setAlpha(Phaser.Math.FloatBetween(0.5, 0.9)).setDepth(-7);
      c._v = Phaser.Math.FloatBetween(6, 20);
      this.decorDrift.push(c);
    }

    /* ---- terrain ---- */
    this.terrain = this.physics.add.staticGroup();
    const put = (x, y, key) => this.terrain.create(x, y, key);
    // main ground: top row grass tiles, one dirt row below for depth
    LV.grounds.forEach(g => {
      const n = Math.round((g.x2 - g.x1) / 70);
      for (let i = 0; i < n; i++) {
        const cx = g.x1 + i * 70 + 35;
        const key = i === 0 ? 'grassLeft' : (i === n - 1 ? 'grassRight' : 'grassMid');
        put(cx, LV.groundTop + 35, key);
        put(cx, LV.groundTop + 105, i % 2 ? 'dirtCenter' : 'dirtMid');
      }
    });
    // floating stair platforms (half tiles)
    LV.platforms.forEach(p => {
      const n = Math.round((p.x2 - p.x1) / 70);
      for (let i = 0; i < n; i++) {
        const key = i === 0 ? 'grassHalfLeft' : (i === n - 1 ? 'grassHalfRight' : 'grassHalfMid');
        put(p.x1 + i * 70 + 35, p.top + 35, key);
      }
    });
    // bridge (half tiles, narrow)
    {
      const b = LV.bridge, n = Math.round((b.x2 - b.x1) / 70);
      for (let i = 0; i < n; i++) {
        const key = i === 0 ? 'grassHalfLeft' : (i === n - 1 ? 'grassHalfRight' : 'grassHalfMid');
        put(b.x1 + i * 70 + 35, b.top + 35, key);
      }
    }

    /* ---- moving platforms ---- */
    // pre-compose a 140x70 platform texture (two half-tiles side by side)
    if (!this.textures.exists('moverPlat')) {
      const rt = this.add.renderTexture(0, 0, 140, 70);
      rt.draw('grassHalfLeft', 35, 35).draw('grassHalfRight', 105, 35);
      rt.saveTexture('moverPlat');
      rt.destroy();
    }
    this.movers = [];
    LV.movers.forEach(m => {
      const startX = m.axis === 'y' ? m.x + m.w / 2 : m.x1 + m.w / 2;
      const startY = m.axis === 'y' ? (m.yTop + m.yBot) / 2 + 35 : m.top + 35;
      const img = this.physics.add.image(startX, startY, 'moverPlat');
      img.body.setSize(140, 70);
      img.setImmovable(true); img.body.allowGravity = false;
      this.movers.push({ def: m, obj: img, phase: Math.random() * Math.PI * 2 });
    });

    /* ---- spikes (generous hitboxes: smaller than the art) ---- */
    this.spikes = this.physics.add.staticGroup();
    LV.spikes.forEach(([x1, x2]) => {
      const n = Math.round((x2 - x1) / 70);
      for (let i = 0; i < n; i++) {
        const s = this.spikes.create(x1 + i * 70 + 35, LV.groundTop - 30, 'spikes');
        s.body.setSize(46, 36); s.body.setOffset(12, 26); s.refreshBody();
      }
    });

    /* ---- enemies ---- */
    this.enemies = this.physics.add.group();
    this.slimeList = [];
    LV.slimes.forEach(s => {
      const e = this.enemies.create((s.x1 + s.x2) / 2, LV.groundTop - 16, 'slime1');
      e.setData({ type: 'slime', x1: s.x1, x2: s.x2, speed: s.speed, alive: true });
      e.body.setSize(40, 24); e.body.setOffset(5, 4);
      e.setVelocityX(s.speed); e.setCollideWorldBounds(false);
      this.slimeList.push(e);
    });
    this.flyers = [];
    LV.flyers.forEach(f => {
      const e = this.enemies.create(f.x, f.y, 'fly1');
      e.setData({ type: 'fly', ax: f.x, ay: f.y, amp: f.amp, period: f.period, alive: true, t: Math.random() * 10 });
      e.body.setSize(56, 28); e.body.setOffset(8, 4);
      e.body.allowGravity = false; e.body.setImmovable(true);
      this.flyers.push(e);
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

    /* ---- checkpoints ---- */
    this.checkGroup = this.physics.add.staticGroup();
    this.checkFlags = [];
    LV.checkpoints.forEach((cx, i) => {
      const f = this.checkGroup.create(cx, LV.groundTop - 35, i === 0 ? 'flag' : 'flagOff');
      f.setData('idx', i); f.setData('x', cx);
      this.checkFlags.push(f);
    });

    /* ---- goal ---- */
    this.goalFlag = this.add.image(LV.goal.flagX, LV.groundTop - 35, 'flag').setScale(1.2);
    this.tweens.add({ targets: this.goalFlag, y: LV.groundTop - 45, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.goalZone = this.add.zone((LV.goal.x1 + LV.goal.x2) / 2, LV.groundTop - 60, LV.goal.x2 - LV.goal.x1, 160);
    this.physics.add.existing(this.goalZone, true);

    /* ---- player ---- */
    this.player = this.physics.add.sprite(LV.spawn.x, LV.spawn.y, 'p1_stand');
    this.player.setBodySize(46, 80, false);
    this.player.body.setOffset(10, 12);
    this.player.setCollideWorldBounds(false);
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

    /* ---- particles ---- */
    this.dust = this.add.particles(0, 0, 'star', {
      speed: { min: 40, max: 140 }, lifespan: 450, scale: { start: 0.35, end: 0 },
      alpha: { start: 0.9, end: 0 }, tint: 0xfff3b0, emitting: false,
    }).setDepth(5);
    this.boom = this.add.particles(0, 0, 'star', {
      speed: { min: 120, max: 380 }, lifespan: 800, scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xff595e, 0xffca3a, 0xffffff], emitting: false,
    }).setDepth(5);
    this.sparkle = this.add.particles(0, 0, 'coin', {
      speed: { min: 60, max: 200 }, lifespan: 500, scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 }, emitting: false,
    }).setDepth(5);
    this.confetti = this.add.particles(0, 0, 'star', {
      speed: { min: 150, max: 420 }, lifespan: 1200, scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93],
      emitting: false, gravityY: 500,
    }).setDepth(50);

    /* ---- camera ---- */
    const cam = this.cameras.main;
    cam.setBounds(0, 0, LV.width, 540);
    cam.startFollow(this.player, false, 0.12, 0.12);
    cam.setDeadzone(140, 90);
    cam.setBackgroundColor('#120e4d');

    /* ---- HUD ---- */
    const hudStyle = { fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 5 };
    this.hudCoinIcon = this.add.image(34, 30, 'coin').setScale(0.42).setScrollFactor(0).setDepth(100);
    this.hudCoins = this.add.text(58, 16, '0', hudStyle).setScrollFactor(0).setDepth(100);
    this.hudTime = this.add.text(480, 16, '0:00', hudStyle).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);
    this.hudDeaths = this.add.text(926, 16, 'DEATHS 0', hudStyle).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
    this.toast = this.add.text(480, 120, '', {
      fontFamily: 'Bungee, sans-serif', fontSize: '30px', color: '#80ed99',
      stroke: '#1d3557', strokeThickness: 7,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100).setAlpha(0);

    /* ---- input: keyboard ---- */
    this.keys = this.input.keyboard.addKeys({
      left: Phaser.Input.Keyboard.KeyCodes.LEFT, right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      a: Phaser.Input.Keyboard.KeyCodes.A, d: Phaser.Input.Keyboard.KeyCodes.D,
      space: Phaser.Input.Keyboard.KeyCodes.SPACE, up: Phaser.Input.Keyboard.KeyCodes.UP,
      w: Phaser.Input.Keyboard.KeyCodes.W,
    });
    this.input.keyboard.on('keydown-SPACE', () => this.requestJump());
    this.input.keyboard.on('keydown-UP', () => this.requestJump());
    this.input.keyboard.on('keydown-W', () => this.requestJump());

    /* ---- input: touch buttons (mobile-first) ---- */
    this.buildTouchControls();

    if (!this.isTouchDevice) {
      const hint = this.add.text(480, 500, 'ARROWS / A D to move · SPACE to jump', {
        fontFamily: 'Verdana, sans-serif', fontSize: '15px', color: '#eaf6ff',
        backgroundColor: '#00000088', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
      this.tweens.add({ targets: hint, alpha: 0, delay: 5000, duration: 1200 });
    }

    this.playing = true;
    this.cameras.main.fadeIn(400, 10, 10, 40);
  }

  /* ============ touch controls: big, glowing, multi-touch ============ */
  makeButtonTextures() {
    if (this.textures.exists('btnIdle')) return;
    const g = this.add.graphics();
    // idle: soft white disc + colored ring
    g.fillStyle(0xffffff, 0.16); g.fillCircle(60, 60, 58);
    g.lineStyle(5, 0xffffff, 0.55); g.strokeCircle(60, 60, 54);
    g.lineStyle(2, 0xffffff, 0.25); g.strokeCircle(60, 60, 44);
    g.generateTexture('btnIdle', 120, 120);
    g.clear();
    // active: bright glow disc + hot ring
    g.fillStyle(0x90e0ef, 0.5); g.fillCircle(60, 60, 58);
    g.lineStyle(7, 0xffffff, 0.95); g.strokeCircle(60, 60, 54);
    g.lineStyle(3, 0xcaf0f8, 0.8); g.strokeCircle(60, 60, 64);
    g.generateTexture('btnActive', 120, 120);
    g.clear();
    // chevrons
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(78, 32, 78, 88, 40, 60); // left
    g.generateTexture('chevL', 120, 120);
    g.clear();
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(42, 32, 42, 88, 80, 60); // right
    g.generateTexture('chevR', 120, 120);
    g.clear();
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(32, 78, 88, 78, 60, 40); // up (jump)
    g.generateTexture('chevU', 120, 120);
    g.destroy();
  }

  buildTouchControls() {
    this.touchButtons = [];
    if (!this.isTouchDevice) return;
    this.makeButtonTextures();

    const mk = (x, y, chev, scale, onDown, onUp, label) => {
      const c = this.add.container(x, y).setScrollFactor(0).setDepth(900);
      const base = this.add.image(0, 0, 'btnIdle').setScale(scale);
      const icon = this.add.image(0, -2, chev).setScale(scale * 0.62).setAlpha(0.95);
      c.add([base, icon]);
      // rock-solid input: the image itself is the hit area (container input is fiddly)
      base.setInteractive({ useHandCursor: false });
      const st = { c, base, scale, onDown, onUp, pid: -1 };
      base.on('pointerdown', (pointer) => {
        if (st.pid !== -1) return; // already held by another finger
        st.pid = pointer.id;
        base.setTexture('btnActive');
        this.tweens.killTweensOf(c);
        c.setScale(1); // punch-in press feedback
        this.tweens.add({ targets: c, scale: 1.14, duration: 70, ease: 'Quad.easeOut' });
        vibrate(8);
        SFX.init();
        onDown();
      });
      this.touchButtons.push(st);
      if (label) {
        this.add.text(x, y + 62 * scale, label, {
          fontFamily: 'Bungee, sans-serif', fontSize: '13px', color: '#ffffff', stroke: '#1d3557', strokeThickness: 4,
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(900).setAlpha(0.9);
      }
      return st;
    };

    // global release: robust against finger sliding off the button
    this.input.on('pointerup', (p) => this.releaseButton(p.id));
    this.input.on('pointercancel', (p) => this.releaseButton(p.id));

    // thumb zone: left cluster bottom-left, jump bottom-right (landscape)
    mk(96, 438, 'chevL', 1.0, () => { this.touch.left = true; }, () => { this.touch.left = false; });
    mk(236, 438, 'chevR', 1.0, () => { this.touch.right = true; }, () => { this.touch.right = false; });
    mk(864, 428, 'chevU', 1.22, () => this.requestJump(), () => {}, 'JUMP');
  }

  releaseButton(pid) {
    (this.touchButtons || []).forEach(st => {
      if (st.pid === pid) {
        st.pid = -1;
        st.base.setTexture('btnIdle');
        this.tweens.killTweensOf(st.c);
        this.tweens.add({ targets: st.c, scale: 1, duration: 90, ease: 'Quad.easeOut' });
        st.onUp();
      }
    });
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
    this.cameras.main.fadeIn(250, 10, 10, 40);
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
      const dim = this.add.rectangle(0, 0, W, H).setOrigin(0).setFillStyle(0x0b0b2a, 0.78).setScrollFactor(0).setDepth(950);
      const panel = this.add.rectangle(W / 2, H / 2, 560, 400, 0x1d3557, 1).setStrokeStyle(6, 0xffd60a).setScrollFactor(0).setDepth(951);
      const base = [
        this.add.text(W / 2, H / 2 - 150, 'YOU WIN?!', { fontFamily: 'Bungee, sans-serif', fontSize: '56px', color: '#ffd60a', stroke: '#7b2d00', strokeThickness: 10 }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 - 84, isBest ? 'NEW BEST TIME!' : 'LEVEL 1 CLEARED', { fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#80ed99' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 - 30, 'TIME   ' + fmtTime(t), { fontFamily: 'Bungee, sans-serif', fontSize: '26px', color: '#ffffff' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 + 8, 'DEATHS   ' + d + '      COINS   ' + this.coins, { fontFamily: 'Bungee, sans-serif', fontSize: '22px', color: '#ffffff' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 + 58, 'RANK', { fontFamily: 'Bungee, sans-serif', fontSize: '20px', color: '#caf0f8' }).setOrigin(0.5),
        this.add.text(W / 2, H / 2 + 112, rank, { fontFamily: 'Bungee, sans-serif', fontSize: '72px', color: rank === 'S' ? '#ffd60a' : '#ffffff', stroke: '#7b2d00', strokeThickness: 8 }).setOrigin(0.5),
      ];
      base.forEach(o => { o.setScrollFactor(0).setDepth(952); });
      const again = this.add.text(W / 2, H / 2 + 178, 'PLAY AGAIN', {
        fontFamily: 'Bungee, sans-serif', fontSize: '26px', color: '#ffffff',
        backgroundColor: '#c1121f', padding: { x: 26, y: 12 },
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
        o.y = (def.yTop + def.yBot) / 2 + 35 - ((def.yBot - def.yTop) / 2) * Math.cos(ph);
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
  backgroundColor: '#0b0b2a',
  physics: { default: 'arcade', arcade: { gravity: { y: PHYS.gravity }, debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, TitleScene, GameScene],
  disableContextMenu: true,
};
window.addEventListener('load', () => { new Phaser.Game(config); });
