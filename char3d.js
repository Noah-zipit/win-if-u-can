/* WIN IF U CAN — real-time 3D player character overlay.
 * Three.js transparent canvas layered over the Phaser canvas. A CC0 Quaternius
 * goblin (FBX, hell-tinted into a little imp with glowing eyes) is synced to the
 * Phaser player's screen position every frame; animation state (idle/run/jump/
 * fall/dead/win) is driven by the Phaser player state.
 *
 * The Phaser side writes window.WIUC.char = {x, y, state, face, visible} in CSS
 * pixels each frame (see game.js). If anything here fails, window.WIUC.charFailed
 * is set and the game falls back to its 2D sprite.
 */
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const WIUC = (window.WIUC = window.WIUC || { char: null, charRendered: false, charFailed: false });

let renderer = null;
let scene = null;
let camera = null;
let model = null;
let mixer = null;
let clips = {};
let curAction = null;
let curState = '';
let failed = false;

function fail() {
  if (failed) return;
  failed = true;
  WIUC.charFailed = true;
  if (model) model.visible = false;
}

function setupModel(obj) {
  // ---- hell-imp material remap (by Quaternius material name) ----
  obj.traverse((o) => {
    if (o.isMesh) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        if (!m) return;
        const n = (m.name || '').toLowerCase();
        if (n.indexOf('skin') !== -1) {
          m.color.set(0xb32312); // demonic red skin
        } else if (n.indexOf('eye') !== -1 && n.indexOf('brow') === -1) {
          m.color.set(0xff2a00);
          m.emissive = new THREE.Color(0xff1800);
          m.emissiveIntensity = 1.6; // glowing eyes
        } else if (n.indexOf('shirt') !== -1) {
          m.color.set(0x4d0f04); // charred cloth
        }
      });
    }
  });

  // ---- normalize: feet at y=0, target height ~112 CSS px ----
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  if (!size.y || size.y <= 0) { fail(); return; }
  const s = 112 / size.y;
  const holder = new THREE.Group();
  obj.scale.setScalar(s);
  obj.position.y = -box.min.y * s;
  holder.add(obj);

  // ---- animations ----
  mixer = new THREE.AnimationMixer(obj);
  clips = {};
  obj.animations.forEach((a) => {
    const n = a.name.toLowerCase();
    if (n.indexOf('idle') !== -1) clips.idle = a;
    else if (n.indexOf('run') !== -1) clips.run = a;
    else if (n.indexOf('walk') !== -1) clips.walk = a;
    else if (n.indexOf('jump') !== -1) clips.jump = a;
    else if (n.indexOf('death') !== -1 || n.indexOf('die') !== -1) clips.death = a;
    else if (n.indexOf('attack') !== -1) clips.attack = a;
  });
  if (!clips.idle && obj.animations.length) clips.idle = obj.animations[0];

  model = holder;
  model.visible = false;
  scene.add(model);
  playState('idle');
}

function playState(st) {
  if (st === curState || !mixer) { curState = st; return; }
  curState = st;
  let clip = clips[st] || clips.idle;
  if (st === 'dead') clip = clips.death || clips.idle;
  if (st === 'win') clip = clips.jump || clips.idle;
  if (st === 'fall') clip = clips.jump || clips.idle;
  if (!clip) return;
  const next = mixer.clipAction(clip);
  next.reset();
  if (st === 'dead') {
    next.setLoop(THREE.LoopOnce);
    next.clampWhenFinished = true;
  } else {
    next.setLoop(THREE.LoopRepeat);
  }
  next.play();
  if (curAction && curAction !== next) {
    try { next.crossFadeFrom(curAction, 0.16, true); } catch (e) { /* keep playing */ }
  }
  curAction = next;
}

function init() {
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { fail(); return; }
  if (!renderer) { fail(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  const cv = renderer.domElement;
  cv.id = 'char3d-canvas';
  cv.style.cssText = 'position:fixed;inset:0;z-index:10;pointer-events:none;';
  document.body.appendChild(cv);

  scene = new THREE.Scene();
  // orthographic camera mapped 1:1 to CSS pixels, y-down (matches screen coords)
  camera = new THREE.OrthographicCamera(0, window.innerWidth, 0, window.innerHeight, -100, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  // hellish lighting: warm key + red rim
  scene.add(new THREE.HemisphereLight(0xff8a5a, 0x140808, 1.05));
  const key = new THREE.DirectionalLight(0xffd9a8, 1.5);
  key.position.set(3, 5, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff2200, 1.0);
  rim.position.set(-4, 2, -6);
  scene.add(rim);

  window.addEventListener('resize', () => {
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.right = window.innerWidth;
    camera.bottom = window.innerHeight;
    camera.updateProjectionMatrix();
  });

  try {
    new FBXLoader().load(
      'assets/goblin.fbx',
      (obj) => { try { setupModel(obj); } catch (e) { fail(); } },
      undefined,
      () => fail()
    );
  } catch (e) { fail(); return; }

  // give up gracefully if the model never arrives
  setTimeout(() => { if (!model) fail(); }, 15000);

  requestAnimationFrame(tick);
}

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  if (!renderer || !scene || !camera) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const ch = WIUC.char;

  if (failed || !model || !ch || !ch.visible) {
    if (model) model.visible = false;
    renderer.render(scene, camera);
    return;
  }

  model.visible = true;
  WIUC.charRendered = true;
  // ch.x/ch.y are CSS px of the player's feet; ortho cam maps 1:1 (y-down)
  model.position.set(ch.x, ch.y, 0);

  // facing: run -> face travel direction; otherwise face the camera
  const wantRot = (ch.state === 'run') ? (ch.face === 1 ? Math.PI / 2 : -Math.PI / 2) : 0;
  let d = wantRot - model.rotation.y;
  // shortest-path turn
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  model.rotation.y += d * Math.min(1, dt * 10);

  playState(ch.state === 'fall' ? 'jump' : ch.state);
  if (mixer) mixer.update(dt);
  renderer.render(scene, camera);
}

try {
  init();
} catch (e) {
  fail();
}
