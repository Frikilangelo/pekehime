const canvas = document.getElementById("arena");
const ctx = canvas.getContext("2d");

const p1LifeEl = document.getElementById("p1-life");
const p2LifeEl = document.getElementById("p2-life");
const timerEl = document.getElementById("timer");
const messageEl = document.getElementById("message");
const p1RoundsEl = document.getElementById("p1-rounds");
const p2RoundsEl = document.getElementById("p2-rounds");
const audioStatusEl = document.getElementById("audio-status");
const optionsOverlayEl = document.getElementById("options-overlay");
const openOptionsBtnEl = document.getElementById("open-options-btn");
const closeOptionsBtnEl = document.getElementById("close-options-btn");
const toggleMuteBtnEl = document.getElementById("toggle-mute-btn");
const masterVolumeEl = document.getElementById("master-volume");
const musicVolumeEl = document.getElementById("music-volume");
const sfxVolumeEl = document.getElementById("sfx-volume");
const masterValueEl = document.getElementById("master-value");
const musicValueEl = document.getElementById("music-value");
const sfxValueEl = document.getElementById("sfx-value");

const GRAVITY = 1.05;
const FLOOR_Y = canvas.height - 85;
const MAX_ROUNDS_TO_WIN = 2;
const ROUND_TIME = 60;
const SPECIAL_COOLDOWN_MS = 5000;
const SPRITE_SCALE = 6;
/** World-space padding removed from each side of the fighter hurtbox (smaller = tighter hits). */
const HURTBOX_EDGE_INSET = 10 * SPRITE_SCALE;
const SPRITE_STATES = [
  "idle",
  "walk",
  "jump",
  "block",
  "punch",
  "kick",
  "special",
  "hurt",
];
const MAX_FRAMES_PER_STATE = 60;
const MUSIC_TRACK_PATH = "assets/music/combat_theme.mp3";
const STAGE_LAYER_PATHS = {
  mid: "assets/background/stage_layer_02_mid.png",
  near: "assets/background/stage_layer_03_near.png",
  extra: "assets/background/stage_layer_04_extra.png",
  ground: "assets/background/stage_layer_05_ground.png",
};
const FAR_ANIMATION_FRAME_COUNT = 30;
const FAR_ANIMATION_FPS = 12;
const REQUIRED_STAGE_LAYER_KEYS = ["far", "mid", "near"];
const STAGE_PARALLAX_MAX_SHIFT = 160;
const OPAQUE_ALPHA_THRESHOLD = 8;
const ANIMATION_FPS = {
  idle: 8,
  walk: 10,
  jump: 12,
  block: 20,
  punch: 14,
  kick: 12,
  special: 12,
  hurt: 10,
};
const SFX_FILES = {
  punch: "assets/sounds/attacks/punch.wav",
  punchHit: "assets/sounds/attacks/punch.mp3",
  kickHit: "assets/sounds/attacks/kick.mp3",
  kick: "assets/sounds/attacks/kick.wav",
  special: "assets/sounds/attacks/special.wav",
  specialHit: "assets/sounds/attacks/special.mp3",
  hit: "assets/sounds/attacks/hit.wav",
  block: "assets/sounds/attacks/block.wav",
  jump: "assets/sounds/attacks/jump.mp3",
};

const keys = new Set();

const GAMEPAD_DEADZONE = 0.35;
const GAMEPAD_BUTTON = {
  jump: 0,
  kick: 1,
  punch: 2,
  special: 3,
  blockLeft: 4,
  blockRight: 5,
  dpadLeft: 14,
  dpadRight: 15,
};

// Nombres visibles de cada indice, para la pantalla de controles previa a la pelea.
// Si cambias un indice en GAMEPAD_BUTTON, la pantalla se actualiza sola.
const GAMEPAD_BUTTON_NAMES = {
  0: "B / Cruz",
  1: "A / Círculo",
  2: "Y / Cuadrado",
  3: "X / Triángulo",
  4: "LB / L1",
  5: "RB / R1",
  6: "LT / L2",
  7: "RT / R2",
  8: "View / Share",
  9: "Menu / Options",
  10: "L3",
  11: "R3",
  12: "Cruceta arriba",
  13: "Cruceta abajo",
  14: "Cruceta izquierda",
  15: "Cruceta derecha",
};

const GAMEPAD_MOVE_LABEL = "Stick izq. / cruceta";

const GAMEPAD_CONTROL_ROWS = [
  { label: "Mover", value: GAMEPAD_MOVE_LABEL },
  { label: "Saltar", buttons: ["jump"] },
  { label: "Puñetazo", buttons: ["punch"] },
  { label: "Patada", buttons: ["kick"] },
  { label: "Especial", buttons: ["special"] },
  { label: "Bloquear", buttons: ["blockLeft", "blockRight"] },
];

const gamepadState = {
  previous: {},
};

const controls = {
  p1: {
    left: "a",
    right: "d",
    jump: "w",
    block: "g",
    punch: "f",
    kick: "r",
    special: "t",
  },
  p2: {
    left: "h",
    right: "k",
    jump: "u",
    block: "l",
    punch: "i",
    kick: "o",
    special: "p",
  },
};

const state = {
  timer: ROUND_TIME,
  timerTickMs: 1000,
  timerAccum: 0,
  roundNumber: 1,
  roundActive: false,
  gameOver: false,
  optionsOpen: false,
  introActive: false,
  controlsActive: false,
  outroActive: false,
  messageUntil: 0,
  audio: {
    unlocked: false,
    muted: false,
    masterVolume: 0.8,
    musicMix: 0.225,
    sfxMix: 1,
  },
};

const audioBus = {
  music: null,
  sounds: {},
};

const stageLayers = {
  far: { frames: [], ready: false, frameIndex: 0, elapsedMs: 0 },
  mid: { image: new Image(), ready: false },
  near: { image: new Image(), ready: false },
  extra: { image: new Image(), ready: false },
  ground: { image: new Image(), ready: false },
};
const opaqueBoundsCanvas = document.createElement("canvas");
const opaqueBoundsCtx = opaqueBoundsCanvas.getContext("2d", {
  willReadFrequently: true,
});

function stageLayersAllReady() {
  return REQUIRED_STAGE_LAYER_KEYS.every((key) => stageLayers[key]?.ready);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getOpaqueBoundsForImage(image) {
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  if (!opaqueBoundsCtx || !w || !h) {
    return { x: 0, y: 0, w: w || 1, h: h || 1 };
  }

  try {
    opaqueBoundsCanvas.width = w;
    opaqueBoundsCanvas.height = h;
    opaqueBoundsCtx.clearRect(0, 0, w, h);
    opaqueBoundsCtx.drawImage(image, 0, 0);

    const pixels = opaqueBoundsCtx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const alpha = pixels[(y * w + x) * 4 + 3];
        if (alpha > OPAQUE_ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0 || maxY < 0) {
      return { x: 0, y: 0, w, h };
    }

    return {
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
  } catch (_) {
    return { x: 0, y: 0, w, h };
  }
}

function getMusicVolume() {
  if (state.audio.muted) {
    return 0;
  }
  return state.audio.masterVolume * state.audio.musicMix;
}

function getSfxVolume() {
  if (state.audio.muted) {
    return 0;
  }
  return state.audio.masterVolume * state.audio.sfxMix;
}

function updateAudioStatus() {
  if (!audioStatusEl) {
    return;
  }
  const volumeText = `${Math.round(state.audio.masterVolume * 100)}%`;
  const muteText = state.audio.muted ? "MUTED" : "ON";
  audioStatusEl.textContent = `Audio: ${muteText} (${volumeText})`;
}

function syncOptionsUi() {
  if (masterVolumeEl) {
    masterVolumeEl.value = String(Math.round(state.audio.masterVolume * 100));
  }
  if (musicVolumeEl) {
    musicVolumeEl.value = String(Math.round(state.audio.musicMix * 100));
  }
  if (sfxVolumeEl) {
    sfxVolumeEl.value = String(Math.round(state.audio.sfxMix * 100));
  }
  if (masterValueEl) {
    masterValueEl.textContent = `${Math.round(state.audio.masterVolume * 100)}%`;
  }
  if (musicValueEl) {
    musicValueEl.textContent = `${Math.round(state.audio.musicMix * 100)}%`;
  }
  if (sfxValueEl) {
    sfxValueEl.textContent = `${Math.round(state.audio.sfxMix * 100)}%`;
  }
  if (toggleMuteBtnEl) {
    toggleMuteBtnEl.textContent = state.audio.muted ? "Unmute" : "Mute";
  }
}

function applyMusicVolume() {
  if (!audioBus.music) {
    return;
  }
  audioBus.music.volume = getMusicVolume();
}

function updateMusicPlayback() {
  if (!audioBus.music || !state.audio.unlocked) {
    return;
  }

  if (!state.optionsOpen && !state.audio.muted) {
    audioBus.music.play().catch(() => {});
  } else {
    audioBus.music.pause();
  }
}

function playSfx(name) {
  const baseSound = audioBus.sounds[name];
  if (!baseSound || !state.audio.unlocked || state.audio.muted) {
    return;
  }
  const clip = baseSound.cloneNode();
  clip.volume = getSfxVolume();
  clip.play().catch(() => {});
}

function setMasterVolume(nextVolume) {
  state.audio.masterVolume = clamp(nextVolume, 0, 1);
  applyMusicVolume();
  updateAudioStatus();
  syncOptionsUi();
}

function setMusicMix(nextVolume) {
  state.audio.musicMix = clamp(nextVolume, 0, 1);
  applyMusicVolume();
  syncOptionsUi();
}

function setSfxMix(nextVolume) {
  state.audio.sfxMix = clamp(nextVolume, 0, 1);
  syncOptionsUi();
}

function toggleMute() {
  state.audio.muted = !state.audio.muted;
  applyMusicVolume();
  updateMusicPlayback();
  updateAudioStatus();
  syncOptionsUi();
  setMessage(state.audio.muted ? "AUDIO MUTED" : "AUDIO ON", 800);
}

function unlockAudioFromGesture() {
  if (state.audio.unlocked) {
    return;
  }
  state.audio.unlocked = true;
  applyMusicVolume();
  updateMusicPlayback();
}

function initAudio() {
  const music = new Audio(MUSIC_TRACK_PATH);
  music.loop = true;
  music.preload = "auto";
  audioBus.music = music;
  applyMusicVolume();

  for (const [name, path] of Object.entries(SFX_FILES)) {
    const sound = new Audio(path);
    sound.preload = "auto";
    audioBus.sounds[name] = sound;
  }
  updateAudioStatus();
  syncOptionsUi();
}

function makeFarAnimationFramePath(frameIndex) {
  const frameNumber = String(frameIndex).padStart(3, "0");
  return `assets/background/ezgif-frame-${frameNumber}.png`;
}

function initFarAnimationLayer() {
  const entry = stageLayers.far;
  entry.ready = false;
  entry.frames = [];
  entry.frameIndex = 0;
  entry.elapsedMs = 0;

  let pending = FAR_ANIMATION_FRAME_COUNT;
  let successCount = 0;

  const checkComplete = () => {
    pending -= 1;
    if (pending <= 0) {
      entry.ready = successCount > 0;
    }
  };

  for (let frameIndex = 1; frameIndex <= FAR_ANIMATION_FRAME_COUNT; frameIndex += 1) {
    const image = new Image();
    image.onload = () => {
      successCount += 1;
      checkComplete();
    };
    image.onerror = checkComplete;
    image.src = makeFarAnimationFramePath(frameIndex);
    entry.frames.push(image);
    if (image.complete && image.naturalWidth > 0) {
      successCount += 1;
      pending -= 1;
    }
  }

  if (pending <= 0) {
    entry.ready = successCount > 0;
  }
}

function updateFarAnimation(dt) {
  const entry = stageLayers.far;
  if (!entry.ready || entry.frames.length === 0) {
    return;
  }

  entry.elapsedMs += dt;
  const frameDurationMs = 1000 / FAR_ANIMATION_FPS;
  while (entry.elapsedMs >= frameDurationMs) {
    entry.elapsedMs -= frameDurationMs;
    entry.frameIndex = (entry.frameIndex + 1) % entry.frames.length;
  }
}

function getCurrentFarAnimationFrame() {
  const entry = stageLayers.far;
  return entry.frames[entry.frameIndex] || entry.frames[0];
}

function initBackground() {
  initFarAnimationLayer();
  for (const key of Object.keys(STAGE_LAYER_PATHS)) {
    const entry = stageLayers[key];
    entry.ready = false;
    entry.image.onload = () => {
      entry.ready = true;
    };
    entry.image.onerror = () => {
      entry.ready = false;
    };
    entry.image.src = STAGE_LAYER_PATHS[key];
    if (entry.image.complete && entry.image.naturalWidth > 0) {
      entry.ready = true;
    }
  }
}

function openOptions() {
  state.optionsOpen = true;
  keys.clear();
  if (optionsOverlayEl) {
    optionsOverlayEl.classList.remove("hidden");
    optionsOverlayEl.setAttribute("aria-hidden", "false");
  }
  updateMusicPlayback();
  syncOptionsUi();
}

function closeOptions() {
  state.optionsOpen = false;
  keys.clear();
  if (optionsOverlayEl) {
    optionsOverlayEl.classList.add("hidden");
    optionsOverlayEl.setAttribute("aria-hidden", "true");
  }
  updateMusicPlayback();
}

function toggleOptions() {
  if (state.optionsOpen) {
    closeOptions();
    return;
  }
  openOptions();
}

function createFighter(opts) {
  return {
    name: opts.name,
    x: opts.x,
    y: FLOOR_Y - 120 * SPRITE_SCALE,
    vx: 0,
    vy: 0,
    width: 58 * SPRITE_SCALE,
    height: 120 * SPRITE_SCALE,
    color: opts.color,
    facing: opts.facing,
    speed: 6.8,
    jumpStrength: -28,
    health: 100,
    roundsWon: 0,
    isBlocking: false,
    hitStunMs: 0,
    attackCooldownMs: 0,
    activeAttack: null,
    attackedThisSwing: false,
    controls: opts.controls,
    projectiles: [],
    specialCooldownMs: 0,
    hurtFlashMs: 0,
    spriteFolder: opts.spriteFolder,
    sprites: {},
    currentAnimState: "idle",
    currentAnimFrame: 0,
    animElapsedMs: 0,
    isCpu: opts.isCpu || false,
    cpuState: opts.isCpu ? createCpuState() : null,
  };
}

function makeFramePath(folder, state, frameIndex) {
  const frameNumber = String(frameIndex).padStart(2, "0");
  return `assets/sprites/${folder}/${state}_${frameNumber}.png`;
}

function loadStateFrames(fighter, spriteState) {
  const sprite = {
    frames: [],
    ready: false,
    missing: false,
  };

  const loadNextFrame = (frameIndex) => {
    if (frameIndex > MAX_FRAMES_PER_STATE) {
      sprite.ready = sprite.frames.length > 0;
      return;
    }
    const image = new Image();
    image.onload = () => {
      try {
        image.opaqueBounds = getOpaqueBoundsForImage(image);
      } catch (_) {
        image.opaqueBounds = {
          x: 0,
          y: 0,
          w: image.naturalWidth || image.width || 1,
          h: image.naturalHeight || image.height || 1,
        };
      }
      sprite.frames.push(image);
      loadNextFrame(frameIndex + 1);
    };
    image.onerror = () => {
      if (frameIndex === 1) {
        sprite.missing = true;
      }
      sprite.ready = sprite.frames.length > 0;
    };
    image.src = makeFramePath(fighter.spriteFolder, spriteState, frameIndex);
  };

  loadNextFrame(1);
  return sprite;
}

function loadFighterSprites(fighter) {
  for (const spriteState of SPRITE_STATES) {
    fighter.sprites[spriteState] = loadStateFrames(fighter, spriteState);
  }
}

let fighter1 = createFighter({
  name: "P1",
  x: 180,
  color: "#26c6da",
  facing: 1,
  controls: controls.p1,
  spriteFolder: "player1",
});

const P2_START_RIGHT_MARGIN = 150;

let fighter2 = createFighter({
  name: "CPU",
  x: canvas.width - 58 * SPRITE_SCALE - P2_START_RIGHT_MARGIN,
  color: "#ec407a",
  facing: -1,
  controls: controls.p2,
  spriteFolder: "player2",
  isCpu: true,
});

loadFighterSprites(fighter1);
loadFighterSprites(fighter2);

const ATTACKS = {
  punch: {
    startup: 80,
    active: 100,
    recovery: 180,
    damage: 8,
    knockback: 12 * SPRITE_SCALE,
    range: 38 * SPRITE_SCALE,
    yOffset: 36 * SPRITE_SCALE,
    h: 22 * SPRITE_SCALE,
  },
  kick: {
    startup: 130,
    active: 120,
    recovery: 230,
    damage: 12,
    knockback: 15 * SPRITE_SCALE,
    range: 50 * SPRITE_SCALE,
    yOffset: 50 * SPRITE_SCALE,
    h: 24 * SPRITE_SCALE,
  },
};

function createCpuState() {
  return {
    thinkTimerMs: 0,
    nextThinkMs: 180,
    moveLeft: false,
    moveRight: false,
  };
}

function resetCpuState(fighter) {
  if (fighter.cpuState) {
    Object.assign(fighter.cpuState, createCpuState());
  }
}

function getDistanceBetweenFighters(a, b) {
  const aBox = getHurtbox(a);
  const bBox = getHurtbox(b);
  if (aBox.x + aBox.w <= bBox.x) {
    return bBox.x - (aBox.x + aBox.w);
  }
  if (bBox.x + bBox.w <= aBox.x) {
    return aBox.x - (bBox.x + bBox.w);
  }
  return 0;
}

function isOpponentAttacking(opponent) {
  if (!opponent.activeAttack) {
    return false;
  }
  const phase = opponent.activeAttack.phase;
  return phase === "startup" || phase === "active";
}

function hasIncomingProjectile(fighter, opponent) {
  return opponent.projectiles.some((projectile) => {
    if (!projectile.alive) {
      return false;
    }
    const projectileCenter = projectile.x + projectile.w / 2;
    const fighterCenter = fighter.x + fighter.width / 2;
    const headingToward =
      (projectile.vx > 0 && projectileCenter < fighterCenter) ||
      (projectile.vx < 0 && projectileCenter > fighterCenter);
    const verticalOverlap =
      projectile.y + projectile.h > fighter.y &&
      projectile.y < fighter.y + fighter.height;
    return headingToward && verticalOverlap;
  });
}

function updateCpuInput(fighter, opponent, dt) {
  const input = {
    left: false,
    right: false,
    jump: false,
    block: false,
    punch: false,
    kick: false,
    special: false,
  };

  if (fighter.hitStunMs > 0 || fighter.activeAttack) {
    return input;
  }

  const cpu = fighter.cpuState;
  const dist = getDistanceBetweenFighters(fighter, opponent);
  const punchRange = ATTACKS.punch.range * 0.92;
  const kickRange = ATTACKS.kick.range * 0.88;
  const towardLeft = opponent.x + opponent.width / 2 < fighter.x + fighter.width / 2;
  const opponentAttacking = isOpponentAttacking(opponent);
  const incomingProjectile = hasIncomingProjectile(fighter, opponent);
  const lowHealth = fighter.health < 35;

  if (incomingProjectile && isOnGround(fighter)) {
    input.block = Math.random() < 0.55;
    input.jump = !input.block && Math.random() < 0.45;
    return input;
  }

  if (opponentAttacking && dist < kickRange * 1.6) {
    if (Math.random() < (lowHealth ? 0.75 : 0.58)) {
      input.block = true;
      return input;
    }
    if (towardLeft) {
      input.right = true;
    } else {
      input.left = true;
    }
    return input;
  }

  cpu.thinkTimerMs += dt;
  if (cpu.thinkTimerMs < cpu.nextThinkMs) {
    input.left = cpu.moveLeft;
    input.right = cpu.moveRight;
    return input;
  }

  cpu.thinkTimerMs = 0;
  cpu.nextThinkMs = 120 + Math.random() * 260;
  cpu.moveLeft = false;
  cpu.moveRight = false;

  if (
    dist > punchRange * 2.2 &&
    fighter.specialCooldownMs <= 0 &&
    fighter.attackCooldownMs <= 0 &&
    Math.random() < 0.32
  ) {
    input.special = true;
    return input;
  }

  if (dist <= kickRange && fighter.attackCooldownMs <= 0) {
    if (dist <= punchRange) {
      input.punch = Math.random() < 0.58;
      input.kick = !input.punch;
    } else {
      input.kick = true;
    }
    return input;
  }

  if (dist > punchRange * 0.75) {
    if (towardLeft) {
      input.left = true;
      cpu.moveLeft = true;
    } else {
      input.right = true;
      cpu.moveRight = true;
    }
    if (Math.random() < 0.06 && isOnGround(fighter)) {
      input.jump = true;
    }
    return input;
  }

  if (lowHealth && Math.random() < 0.35) {
    if (towardLeft) {
      input.right = true;
    } else {
      input.left = true;
    }
  }

  return input;
}

function isP2ControlKey(key) {
  const c = controls.p2;
  return (
    key === c.left ||
    key === c.right ||
    key === c.jump ||
    key === c.block ||
    key === c.punch ||
    key === c.kick ||
    key === c.special
  );
}

function resetRoundPositions() {
  fighter1.x = 180;
  fighter2.x = canvas.width - fighter2.width - P2_START_RIGHT_MARGIN;
  fighter1.y = FLOOR_Y - fighter1.height;
  fighter2.y = FLOOR_Y - fighter2.height;
  fighter1.vx = 0;
  fighter2.vx = 0;
  fighter1.vy = 0;
  fighter2.vy = 0;
  fighter1.activeAttack = null;
  fighter2.activeAttack = null;
  fighter1.hitStunMs = 0;
  fighter2.hitStunMs = 0;
  fighter1.projectiles = [];
  fighter2.projectiles = [];
  resetCpuState(fighter2);
}

function startRound() {
  state.roundActive = false;
  updateMusicPlayback();
  state.timer = ROUND_TIME;
  state.timerAccum = 0;
  fighter1.health = 100;
  fighter2.health = 100;
  fighter1.specialCooldownMs = 0;
  fighter2.specialCooldownMs = 0;
  resetRoundPositions();
  setMessage(`ROUND ${state.roundNumber}`, 1100);
  window.setTimeout(() => {
    state.roundActive = true;
    updateMusicPlayback();
    setMessage("FIGHT!", 700);
  }, 1100);
  syncHud();
}

function setMessage(msg, durationMs = 1200) {
  messageEl.textContent = msg;
  state.messageUntil = performance.now() + durationMs;
}

function hasActiveSpecialOnScreen(fighter) {
  return fighter.projectiles.some((projectile) => projectile.alive);
}

function getAnimationDurationMs(fighter, spriteKey, fallbackMs = 240) {
  const sprite = fighter.sprites[spriteKey];
  const fps = ANIMATION_FPS[spriteKey] || 8;
  const frameCount = sprite?.ready ? sprite.frames.length : 0;
  if (!sprite?.ready || frameCount <= 0 || fps <= 0) {
    return fallbackMs;
  }
  return Math.ceil((frameCount * 1000) / fps);
}

function startAttack(fighter, kind) {
  const specialActive = hasActiveSpecialOnScreen(fighter);
  if (specialActive && (kind === "punch" || kind === "kick")) {
    return;
  }
  if (!state.roundActive || fighter.attackCooldownMs > 0 || fighter.hitStunMs > 0) {
    return;
  }
  const data = ATTACKS[kind];
  fighter.activeAttack = {
    ...data,
    kind,
    phase: "startup",
    elapsed: 0,
  };
  fighter.attackedThisSwing = false;
  fighter.attackCooldownMs = data.startup + data.active + data.recovery;
  playSfx("jump");
}

function launchProjectile(fighter) {
  if (
    !state.roundActive ||
    fighter.hitStunMs > 0 ||
    fighter.attackCooldownMs > 0 ||
    fighter.specialCooldownMs > 0
  ) {
    return;
  }

  fighter.specialCooldownMs = SPECIAL_COOLDOWN_MS;
  fighter.attackCooldownMs = 360;
  playSfx("jump");
  const specialSprite = fighter.sprites.special;
  const projectileImg =
    specialSprite?.ready && specialSprite.frames.length > 0 ? specialSprite.frames[0] : null;
  fighter.projectiles.push({
    x:
      fighter.facing > 0
        ? fighter.x + fighter.width - 8 * SPRITE_SCALE
        : fighter.x - 10 * SPRITE_SCALE,
    y: fighter.y + 42 * SPRITE_SCALE,
    w: 18 * SPRITE_SCALE,
    h: 18 * SPRITE_SCALE,
    vx: fighter.facing * 11.2,
    damage: 10,
    alive: true,
    image: projectileImg,
  });
}

function isOnGround(fighter) {
  return fighter.y + fighter.height >= FLOOR_Y - 0.01;
}

function getActiveGamepad() {
  if (typeof navigator.getGamepads !== "function") {
    return null;
  }
  const pads = navigator.getGamepads();
  for (let i = 0; i < pads.length; i += 1) {
    const pad = pads[i];
    if (pad && pad.connected) {
      return pad;
    }
  }
  return null;
}

function isGamepadButtonPressed(pad, index) {
  const button = pad.buttons[index];
  if (!button) {
    return false;
  }
  return button.pressed || button.value > 0.5;
}

function readGamepadInput() {
  const pad = getActiveGamepad();
  if (!pad) {
    gamepadState.previous = {};
    return null;
  }

  const axisX = pad.axes[0] || 0;
  const pressed = {
    left: axisX < -GAMEPAD_DEADZONE || isGamepadButtonPressed(pad, GAMEPAD_BUTTON.dpadLeft),
    right: axisX > GAMEPAD_DEADZONE || isGamepadButtonPressed(pad, GAMEPAD_BUTTON.dpadRight),
    jump: isGamepadButtonPressed(pad, GAMEPAD_BUTTON.jump),
    block:
      isGamepadButtonPressed(pad, GAMEPAD_BUTTON.blockLeft) ||
      isGamepadButtonPressed(pad, GAMEPAD_BUTTON.blockRight),
    punch: isGamepadButtonPressed(pad, GAMEPAD_BUTTON.punch),
    kick: isGamepadButtonPressed(pad, GAMEPAD_BUTTON.kick),
    special: isGamepadButtonPressed(pad, GAMEPAD_BUTTON.special),
  };

  const justPressed = (name) => {
    const wasPressed = !!gamepadState.previous[name];
    gamepadState.previous[name] = pressed[name];
    return pressed[name] && !wasPressed;
  };

  const input = {
    left: pressed.left,
    right: pressed.right,
    jump: pressed.jump,
    block: pressed.block,
    punchPressed: justPressed("punch"),
    kickPressed: justPressed("kick"),
    specialPressed: justPressed("special"),
  };
  input.anyPressed =
    pressed.left ||
    pressed.right ||
    pressed.jump ||
    pressed.block ||
    pressed.punch ||
    pressed.kick ||
    pressed.special;

  return input;
}

function processInput(fighter, dt, inputOverride = null) {
  const c = fighter.controls;
  const pad = inputOverride || {};
  const left = keys.has(c.left) || !!pad.left;
  const right = keys.has(c.right) || !!pad.right;
  const jump = keys.has(c.jump) || !!pad.jump;
  const block = keys.has(c.block) || !!pad.block;
  fighter.isBlocking = block && !hasActiveSpecialOnScreen(fighter);

  const airborne = !isOnGround(fighter);
  const airPunchOrKick =
    airborne &&
    fighter.activeAttack &&
    (fighter.activeAttack.kind === "punch" || fighter.activeAttack.kind === "kick");
  const canMoveHorizontal =
    fighter.hitStunMs <= 0 && !fighter.isBlocking && (!fighter.activeAttack || airPunchOrKick);
  const canMove = fighter.hitStunMs <= 0 && !fighter.activeAttack && !fighter.isBlocking;
  fighter.vx = 0;

  if (canMoveHorizontal) {
    if (left) {
      fighter.vx = -fighter.speed;
    } else if (right) {
      fighter.vx = fighter.speed;
    }
  }

  if (canMove && jump && isOnGround(fighter)) {
    fighter.vy = fighter.jumpStrength;
    playSfx("jump");
  }

  fighter.x += fighter.vx * (dt / 16.666);
  fighter.vy += GRAVITY * (dt / 16.666);
  fighter.y += fighter.vy * (dt / 16.666);

  if (fighter.y + fighter.height >= FLOOR_Y) {
    fighter.y = FLOOR_Y - fighter.height;
    fighter.vy = 0;
  }

  fighter.x = Math.max(20, Math.min(canvas.width - fighter.width - 20, fighter.x));
}

function getAttackHitbox(fighter) {
  if (!fighter.activeAttack) {
    return null;
  }
  const attackKind = fighter.activeAttack.kind;
  const isBasicAttack = attackKind === "punch" || attackKind === "kick";

  if (!isBasicAttack && fighter.activeAttack.phase !== "active") {
    return null;
  }
  if (isBasicAttack && !isAttackDamageFrame(fighter)) {
    return null;
  }
  const atk = fighter.activeAttack;
  const hurt = getHurtbox(fighter);
  const minAttackWidth = Math.max(1, Math.round(atk.range * 0.35));
  const reachFromBody = attackKind === "kick" ? 0.52 : 0.34;
  const attackWidth = Math.max(minAttackWidth, Math.round(hurt.w * reachFromBody));
  const attackHeight = Math.max(
    1,
    Math.round(atk.h * 0.55),
    Math.round(hurt.h * 0.72),
  );
  const attackY = hurt.y + (hurt.h - attackHeight) * 0.5;
  const x = fighter.facing > 0 ? hurt.x + hurt.w - attackWidth : hurt.x;
  return {
    x,
    y: attackY,
    w: attackWidth,
    h: attackHeight,
    damage: atk.damage,
    knockback: atk.knockback,
    kind: attackKind,
  };
}

function isAttackDamageFrame(fighter) {
  const attackKind = fighter.activeAttack?.kind;
  if (attackKind !== "punch" && attackKind !== "kick") {
    return true;
  }

  const sprite = fighter.sprites[attackKind];
  const frameCount = sprite?.ready ? sprite.frames.length : 0;
  if (frameCount <= 0) {
    return true;
  }

  const damageStartFrameIndex = Math.max(0, frameCount - 2);
  const currentFrameIndex = Math.min(fighter.currentAnimFrame, frameCount - 1);
  return currentFrameIndex >= damageStartFrameIndex;
}

function insetHurtbox(box) {
  const inset = HURTBOX_EDGE_INSET;
  const ix = Math.min(inset, Math.max(0, (box.w - 2) / 2));
  const iy = Math.min(inset, Math.max(0, (box.h - 2) / 2));
  return {
    x: box.x + ix,
    y: box.y + iy,
    w: Math.max(1, box.w - 2 * ix),
    h: Math.max(1, box.h - 2 * iy),
  };
}

function getHurtbox(fighter) {
  const frame = getCurrentFighterFrame(fighter);
  const frameBounds = frame?.opaqueBounds;

  if (frame && frameBounds) {
    const srcW = frame.naturalWidth || frame.width || fighter.width;
    const srcH = frame.naturalHeight || frame.height || fighter.height;
    const scaleX = fighter.width / srcW;
    const scaleY = fighter.height / srcH;
    const drawW = frameBounds.w * scaleX;
    const drawH = frameBounds.h * scaleY;
    const drawY = fighter.y + frameBounds.y * scaleY;

    if (fighter.facing < 0) {
      const rightOffset = (frameBounds.x + frameBounds.w) * scaleX;
      return insetHurtbox({
        x: fighter.x + fighter.width - rightOffset,
        y: drawY,
        w: Math.max(1, drawW),
        h: Math.max(1, drawH),
      });
    }

    return insetHurtbox({
      x: fighter.x + frameBounds.x * scaleX,
      y: drawY,
      w: Math.max(1, drawW),
      h: Math.max(1, drawH),
    });
  }

  return insetHurtbox({
    x: fighter.x + 10 * SPRITE_SCALE,
    y: fighter.y + 10 * SPRITE_SCALE,
    w: fighter.width - 20 * SPRITE_SCALE,
    h: fighter.height - 18 * SPRITE_SCALE,
  });
}

function getCurrentFighterFrame(fighter) {
  const spriteKey = getSpriteState(fighter);
  const sprite = fighter.sprites[spriteKey];
  const fallbackSprite = fighter.sprites.idle;
  const drawSprite = sprite?.ready ? sprite : fallbackSprite;
  const frames = drawSprite?.frames || [];
  if (frames.length <= 0) {
    return null;
  }

  const frameCount = frames.length;
  const baseFrameIndex = Math.min(fighter.currentAnimFrame, frameCount - 1);
  const isBackstepping = spriteKey === "walk" && fighter.vx * fighter.facing < -0.2;
  const frameIndex = isBackstepping ? frameCount - 1 - baseFrameIndex : baseFrameIndex;
  return frames[frameIndex] || frames[0] || null;
}

function getProjectileHitbox(projectile) {
  const imageBounds = projectile.image?.opaqueBounds;
  if (!imageBounds || !projectile.image) {
    return projectile;
  }
  const srcW = projectile.image.naturalWidth || projectile.image.width || projectile.w;
  const srcH = projectile.image.naturalHeight || projectile.image.height || projectile.h;
  const scaleX = projectile.w / srcW;
  const scaleY = projectile.h / srcH;
  return {
    x: projectile.x + imageBounds.x * scaleX,
    y: projectile.y + imageBounds.y * scaleY,
    w: Math.max(1, imageBounds.w * scaleX),
    h: Math.max(1, imageBounds.h * scaleY),
  };
}

function intersects(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function applyHit(attacker, defender, hit) {
  const isBlocked = defender.isBlocking;

  let dmg = hit.damage;
  if (isBlocked) {
    dmg = Math.floor(dmg * 0.35);
    playSfx("block");
  } else if (hit.kind === "punch") {
    playSfx("punchHit");
  } else if (hit.kind === "kick") {
    playSfx("kickHit");
  } else if (hit.kind === "special") {
    playSfx("specialHit");
  } else {
    playSfx("hit");
  }

  defender.health = Math.max(0, defender.health - dmg);
  defender.hurtFlashMs = getAnimationDurationMs(defender, "hurt");

  if (!isBlocked) {
    defender.hitStunMs = 220;
    defender.x += attacker.facing * hit.knockback;
    defender.vy = -2.5;
  } else {
    defender.x += attacker.facing * 2;
  }

  if (defender.health <= 0) {
    endRound(attacker, "K.O.!");
  }
}

function updateAttackState(fighter, dt) {
  if (!fighter.activeAttack) {
    return;
  }
  const atk = fighter.activeAttack;
  atk.elapsed += dt;

  if (atk.phase === "startup" && atk.elapsed >= atk.startup) {
    atk.phase = "active";
    atk.elapsed = 0;
  } else if (atk.phase === "active" && atk.elapsed >= atk.active) {
    atk.phase = "recovery";
    atk.elapsed = 0;
  } else if (atk.phase === "recovery" && atk.elapsed >= atk.recovery) {
    fighter.activeAttack = null;
    fighter.attackedThisSwing = false;
  }
}

function updateProjectiles(owner, target, dt) {
  for (const projectile of owner.projectiles) {
    if (!projectile.alive) {
      continue;
    }
    projectile.x += projectile.vx * (dt / 16.666);

    if (projectile.x < -50 || projectile.x > canvas.width + 50) {
      projectile.alive = false;
      continue;
    }

    const hurt = getHurtbox(target);
    const projectileHitbox = getProjectileHitbox(projectile);
    if (intersects(projectileHitbox, hurt)) {
      applyHit(owner, target, {
        damage: projectile.damage,
        knockback: 13,
        kind: "special",
      });
      projectile.alive = false;
    }
  }
  owner.projectiles = owner.projectiles.filter((p) => p.alive);
}

function handleCombat(a, b) {
  const hitbox = getAttackHitbox(a);
  if (hitbox && !a.attackedThisSwing && intersects(hitbox, getHurtbox(b))) {
    a.attackedThisSwing = true;
    applyHit(a, b, hitbox);
  }
}

function endRound(winner, reason) {
  if (!state.roundActive) {
    return;
  }
  state.roundActive = false;
  updateMusicPlayback();
  winner.roundsWon += 1;
  syncHud();

  if (winner.roundsWon >= MAX_ROUNDS_TO_WIN) {
    state.gameOver = true;
    updateMusicPlayback();
    setMessage(`${reason} ${winner.name} WINS THE MATCH!`, 3000);
    if (winner === fighter1) {
      startOutro();
    }
    return;
  }

  setMessage(`${reason} ${winner.name} WINS ROUND ${state.roundNumber}`, 5000);
  state.roundNumber += 1;
  window.setTimeout(() => {
    startRound();
  }, 5000);
}

function checkTimerWin() {
  if (fighter1.health === fighter2.health) {
    setMessage("TIME OVER - DRAW ROUND", 5000);
    state.roundNumber += 1;
    window.setTimeout(startRound, 5000);
    return;
  }
  const winner = fighter1.health > fighter2.health ? fighter1 : fighter2;
  endRound(winner, "TIME OVER");
}

function updateHudMessage(now) {
  if (state.messageUntil > 0 && now > state.messageUntil && !state.gameOver) {
    messageEl.textContent = state.roundActive ? "FIGHT!" : "READY";
    state.messageUntil = 0;
  }
}

function syncHud() {
  p1LifeEl.style.width = `${fighter1.health}%`;
  p2LifeEl.style.width = `${fighter2.health}%`;
  timerEl.textContent = `${Math.max(0, Math.ceil(state.timer))}`;

  p1RoundsEl.innerHTML = "";
  p2RoundsEl.innerHTML = "";
  for (let i = 0; i < MAX_ROUNDS_TO_WIN; i += 1) {
    const dot1 = document.createElement("span");
    dot1.className = `round-dot ${i < fighter1.roundsWon ? "won" : ""}`;
    p1RoundsEl.appendChild(dot1);

    const dot2 = document.createElement("span");
    dot2.className = `round-dot ${i < fighter2.roundsWon ? "won" : ""}`;
    p2RoundsEl.appendChild(dot2);
  }
}

function getStageParallaxShift() {
  const c1 = fighter1.x + fighter1.width * 0.5;
  const c2 = fighter2.x + fighter2.width * 0.5;
  const focus = (c1 + c2) * 0.5;
  return clamp(
    (focus - canvas.width * 0.5) * 0.26,
    -STAGE_PARALLAX_MAX_SHIFT,
    STAGE_PARALLAX_MAX_SHIFT
  );
}

function drawParallaxImage(image, shiftX, y, h) {
  const safePaddingX = STAGE_PARALLAX_MAX_SHIFT + 8;
  const drawWidth = canvas.width + safePaddingX * 2;
  ctx.save();
  ctx.translate(-safePaddingX + shiftX, y);
  ctx.drawImage(image, 0, 0, drawWidth, h);
  ctx.restore();
}

function drawParallaxImageBottomAligned(image, shiftX, bottomY) {
  const safePaddingX = STAGE_PARALLAX_MAX_SHIFT + 8;
  const drawWidth = canvas.width + safePaddingX * 2;
  const aspectRatio = image.naturalWidth > 0 ? image.naturalHeight / image.naturalWidth : 1;
  const drawHeight = drawWidth * aspectRatio;
  ctx.save();
  ctx.translate(-safePaddingX + shiftX, bottomY - drawHeight);
  ctx.drawImage(image, 0, 0, drawWidth, drawHeight);
  ctx.restore();
}

function drawStageLayerFar(horizonY, parallax) {
  const g = ctx.createLinearGradient(0, 0, 0, horizonY);
  g.addColorStop(0, "#241a4a");
  g.addColorStop(0.42, "#3a2a72");
  g.addColorStop(1, "#151028");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, horizonY);

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  for (let i = 0; i < 70; i += 1) {
    const sx = ((i * 131 + parallax * 0.12) % canvas.width + canvas.width) % canvas.width;
    const sy = ((i * 53) % Math.max(1, Math.floor(horizonY * 0.5))) + 10;
    if (i % 4 === 0) {
      ctx.fillRect(sx, sy, 2, 2);
    }
  }

  ctx.fillStyle = "rgba(200, 188, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.82 + parallax * 0.04, horizonY * 0.22, 44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1a1436";
  ctx.beginPath();
  ctx.moveTo(-80, horizonY);
  for (let x = -80; x <= canvas.width + 80; x += 48) {
    const h = 18 + Math.sin((x + parallax * 0.18) * 0.012) * 32;
    ctx.lineTo(x, horizonY - h);
  }
  ctx.lineTo(canvas.width + 80, horizonY);
  ctx.closePath();
  ctx.fill();
}

function drawStageLayerMid(horizonY, parallax) {
  const base = -parallax * 0.42;
  ctx.fillStyle = "#2d2458";
  for (let i = -2; i < 22; i += 1) {
    const w = 62 + ((i * 17) % 48);
    const h = 85 + ((i * 29) % 95);
    const x = base + i * 88 + (i % 3) * 14;
    ctx.fillRect(x, horizonY - h, w - 6, h);
  }

  ctx.fillStyle = "rgba(255, 214, 150, 0.22)";
  for (let i = 0; i < 36; i += 1) {
    const x = ((base * 1.4 + i * 43 + parallax * 0.2) % (canvas.width + 30)) - 15;
    const y = horizonY - 35 - ((i * 23) % 130);
    ctx.fillRect(x, y, 4, 6);
  }
}

function drawStageLayerNear(horizonY, parallax) {
  const base = -parallax * 0.62;
  ctx.fillStyle = "#120c22";
  for (let i = -1; i < 16; i += 1) {
    const w = 78 + ((i * 19) % 72);
    const h = 48 + ((i * 11) % 62);
    const x = base + i * 108;
    ctx.fillRect(x, horizonY - h, w - 10, h);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  for (let x = -40; x < canvas.width + 40; x += 20) {
    const rx = x - parallax * 0.72;
    ctx.beginPath();
    ctx.moveTo(rx, horizonY - 6);
    ctx.lineTo(rx + 12, horizonY - 22);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(0, horizonY - 28, canvas.width, 28);
}

function drawBackground() {
  const horizonY = FLOOR_Y;
  const parallax = getStageParallaxShift();
  const jumpPhase = Math.abs(Math.sin(performance.now() * 0.006));
  const midJumpOffsetY = -Math.pow(jumpPhase, 1.8) * 12;
  if (stageLayersAllReady()) {
    drawParallaxImage(getCurrentFarAnimationFrame(), -parallax * 0.08, 0, horizonY);
    drawParallaxImage(stageLayers.mid.image, -parallax * 0.42, midJumpOffsetY + 10, horizonY);
    drawParallaxImage(stageLayers.near.image, -parallax * 0.62, 0, horizonY);
  } else {
    drawStageLayerFar(horizonY, parallax);
    drawStageLayerMid(horizonY, parallax);
    drawStageLayerNear(horizonY, parallax);
  }

  if (!stageLayers.ground.ready) {
    ctx.fillStyle = "#1b5e20";
    ctx.fillRect(0, FLOOR_Y, canvas.width, canvas.height - FLOOR_Y);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    for (let x = 0; x < canvas.width; x += 36) {
      ctx.fillRect(x, FLOOR_Y + 14, 20, 4);
    }
  }
}

function drawGroundLayer() {
  if (!stageLayers.ground.ready) {
    return;
  }
  const parallax = getStageParallaxShift();
  const groundHeight = canvas.height - FLOOR_Y;
  drawParallaxImage(stageLayers.ground.image, -parallax * 0.9, FLOOR_Y, groundHeight);
}

function drawForegroundStageExtra() {
  if (!stageLayers.extra.ready) {
    return;
  }
  const parallax = getStageParallaxShift();
  drawParallaxImageBottomAligned(stageLayers.extra.image, -parallax * 0.78, canvas.height);
}

function drawFighter(fighter) {
  const drawImg = getCurrentFighterFrame(fighter);
  if (!drawImg) {
    return;
  }

  ctx.save();
  if (fighter.facing < 0) {
    ctx.translate(fighter.x + fighter.width, fighter.y);
    ctx.scale(-1, 1);
    ctx.drawImage(drawImg, 0, 0, fighter.width, fighter.height);
  } else {
    ctx.drawImage(drawImg, fighter.x, fighter.y, fighter.width, fighter.height);
  }
  ctx.restore();

}

function getSpriteState(fighter) {
  let spriteKey = "idle";
  if (fighter.hurtFlashMs > 0) {
    spriteKey = "hurt";
  } else if (fighter.activeAttack?.kind === "punch") {
    spriteKey = "punch";
  } else if (fighter.activeAttack?.kind === "kick") {
    spriteKey = "kick";
  } else if (!isOnGround(fighter)) {
    spriteKey = "jump";
  } else if (fighter.isBlocking) {
    spriteKey = "block";
  } else if (Math.abs(fighter.vx) > 0.2) {
    spriteKey = "walk";
  }
  return spriteKey;
}

function updateFighterAnimation(fighter, dt) {
  const spriteKey = getSpriteState(fighter);
  const sprite = fighter.sprites[spriteKey];
  const fps = ANIMATION_FPS[spriteKey] || 8;
  const frameDurationMs = 1000 / fps;

  if (fighter.currentAnimState !== spriteKey) {
    fighter.currentAnimState = spriteKey;
    fighter.currentAnimFrame = 0;
    fighter.animElapsedMs = 0;
    return;
  }

  const frameCount = sprite?.ready ? sprite.frames.length : 0;
  if (!sprite?.ready || frameCount <= 1 || fps <= 0) {
    fighter.currentAnimFrame = 0;
    return;
  }

  fighter.animElapsedMs += dt;
  const lastFrame = frameCount - 1;
  while (fighter.animElapsedMs >= frameDurationMs) {
    fighter.animElapsedMs -= frameDurationMs;
    if (spriteKey === "block" || spriteKey === "hurt") {
      fighter.currentAnimFrame = Math.min(fighter.currentAnimFrame + 1, lastFrame);
    } else {
      fighter.currentAnimFrame = (fighter.currentAnimFrame + 1) % frameCount;
    }
  }
}

function drawProjectiles(fighter) {
  const specialSprite = fighter.sprites.special;
  const canDrawSpecial = specialSprite?.ready && specialSprite.frames.length > 0;
  const projectileImg = canDrawSpecial ? specialSprite.frames[0] : null;

  for (const p of fighter.projectiles) {
    const drawImage = p.image || projectileImg;
    if (drawImage) {
      ctx.drawImage(drawImage, p.x, p.y, p.w, p.h);
    } else {
      ctx.fillStyle = "#fff176";
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h / 2, p.w / 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffb300";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function resolveFacing() {
  fighter1.facing = fighter1.x < fighter2.x ? 1 : -1;
  fighter2.facing = fighter2.x < fighter1.x ? 1 : -1;
}

function keepDistance() {
  const overlap = fighter1.x + fighter1.width - fighter2.x;
  const allowedOverlap = Math.min(fighter1.width, fighter2.width) * 0.5;
  if (overlap > allowedOverlap) {
    const pushAmount = (overlap - allowedOverlap) / 2;
    fighter1.x -= pushAmount;
    fighter2.x += pushAmount;
  }
}

function resetMatch() {
  state.roundNumber = 1;
  state.gameOver = false;
  fighter1.roundsWon = 0;
  fighter2.roundsWon = 0;
  startRound();
}

window.addEventListener("keydown", (e) => {
  if (state.introActive || state.controlsActive || state.outroActive) {
    return;
  }

  const key = e.key.toLowerCase();
  unlockAudioFromGesture();

  if (key === "escape") {
    toggleOptions();
    return;
  }

  if (!state.optionsOpen && !(fighter2.isCpu && isP2ControlKey(key))) {
    keys.add(key);
  }

  if (key === "m") {
    toggleMute();
    return;
  }
  if (key === "u" || key === "=") {
    setMasterVolume(state.audio.masterVolume + 0.05);
    setMessage(`VOLUME ${Math.round(state.audio.masterVolume * 100)}%`, 700);
    return;
  }
  if (key === "y" || key === "-") {
    setMasterVolume(state.audio.masterVolume - 0.05);
    setMessage(`VOLUME ${Math.round(state.audio.masterVolume * 100)}%`, 700);
    return;
  }

  if (state.optionsOpen) {
    return;
  }

  if (key === " ") {
    resetMatch();
    return;
  }

  if (key === fighter1.controls.punch) {
    startAttack(fighter1, "punch");
  } else if (key === fighter1.controls.kick) {
    startAttack(fighter1, "kick");
  } else if (key === fighter1.controls.special) {
    launchProjectile(fighter1);
  } else if (!fighter2.isCpu && key === fighter2.controls.punch) {
    startAttack(fighter2, "punch");
  } else if (!fighter2.isCpu && key === fighter2.controls.kick) {
    startAttack(fighter2, "kick");
  } else if (!fighter2.isCpu && key === fighter2.controls.special) {
    launchProjectile(fighter2);
  }
});

window.addEventListener("keyup", (e) => {
  keys.delete(e.key.toLowerCase());
});

window.addEventListener("gamepadconnected", () => {
  gamepadState.previous = {};
  setMessage("MANDO CONECTADO", 1800);
});

window.addEventListener("gamepaddisconnected", () => {
  gamepadState.previous = {};
  setMessage("MANDO DESCONECTADO", 1800);
});

if (openOptionsBtnEl) {
  openOptionsBtnEl.addEventListener("click", () => {
    unlockAudioFromGesture();
    openOptions();
  });
}

if (closeOptionsBtnEl) {
  closeOptionsBtnEl.addEventListener("click", closeOptions);
}

if (toggleMuteBtnEl) {
  toggleMuteBtnEl.addEventListener("click", () => {
    unlockAudioFromGesture();
    toggleMute();
  });
}

if (masterVolumeEl) {
  masterVolumeEl.addEventListener("input", (e) => {
    const target = e.target;
    setMasterVolume(Number(target.value) / 100);
  });
}

if (musicVolumeEl) {
  musicVolumeEl.addEventListener("input", (e) => {
    const target = e.target;
    setMusicMix(Number(target.value) / 100);
  });
}

if (sfxVolumeEl) {
  sfxVolumeEl.addEventListener("input", (e) => {
    const target = e.target;
    setSfxMix(Number(target.value) / 100);
  });
}

const introOverlayEl = document.getElementById("intro-overlay");
const introVideoEl = document.getElementById("intro-video");
const introLoadingEl = document.getElementById("intro-loading");
const introSkipBtnEl = document.getElementById("intro-skip-btn");
const introSoundBtnEl = document.getElementById("intro-sound-btn");

const controlsOverlayEl = document.getElementById("controls-overlay");
const controlsMapEl = document.getElementById("controls-map");
const controlsFightBtnEl = document.getElementById("controls-fight-btn");

function beginFight() {
  startRound();
  last = performance.now();
  requestAnimationFrame(gameLoop);
}

function renderGamepadControls() {
  if (!controlsMapEl) {
    return;
  }

  controlsMapEl.innerHTML = "";
  GAMEPAD_CONTROL_ROWS.forEach((row) => {
    const names = (row.buttons || [])
      .map((action) => GAMEPAD_BUTTON_NAMES[GAMEPAD_BUTTON[action]])
      .filter((name, index, all) => name && all.indexOf(name) === index);

    const item = document.createElement("li");
    const actionEl = document.createElement("span");
    actionEl.className = "controls-action";
    actionEl.textContent = row.label;

    const keyEl = document.createElement("span");
    keyEl.className = "controls-key";
    keyEl.textContent = names.length ? names.join(" / ") : row.value || "-";

    item.append(actionEl, keyEl);
    controlsMapEl.appendChild(item);
  });
}

// La pantalla de controles acepta la A del mando, pero solo en un flanco nuevo.
let controlsPadPrevPressed = true;

function watchControlsGamepad() {
  if (!state.controlsActive) {
    return;
  }

  const pad = getActiveGamepad();
  const pressed = pad ? isGamepadButtonPressed(pad, GAMEPAD_BUTTON.jump) : false;
  if (pressed && !controlsPadPrevPressed) {
    startFightFromControls();
    return;
  }

  controlsPadPrevPressed = pressed;
  requestAnimationFrame(watchControlsGamepad);
}

function showControlsScreen() {
  renderGamepadControls();

  if (!controlsOverlayEl) {
    beginFight();
    return;
  }

  state.controlsActive = true;
  controlsOverlayEl.classList.remove("hidden");
  controlsOverlayEl.setAttribute("aria-hidden", "false");
  // Si la A ya estaba pulsada al llegar aqui, hay que soltarla antes de usarla.
  controlsPadPrevPressed = true;

  if (controlsFightBtnEl) {
    controlsFightBtnEl.focus({ preventScroll: true });
  }

  requestAnimationFrame(watchControlsGamepad);
}

function startFightFromControls() {
  if (!state.controlsActive) {
    return;
  }

  state.controlsActive = false;
  keys.clear();

  if (controlsOverlayEl) {
    controlsOverlayEl.classList.add("hidden");
    controlsOverlayEl.setAttribute("aria-hidden", "true");
  }

  unlockAudioFromGesture();
  beginFight();
}

if (controlsFightBtnEl) {
  controlsFightBtnEl.addEventListener("click", startFightFromControls);
}

function enableIntroSound() {
  if (!introVideoEl) {
    return;
  }
  introVideoEl.muted = false;
  introVideoEl.play().catch(() => {});
  if (introSoundBtnEl) {
    introSoundBtnEl.classList.add("hidden");
  }
}

function finishIntro() {
  if (!state.introActive) {
    return;
  }
  state.introActive = false;

  if (introVideoEl) {
    introVideoEl.pause();
  }

  if (introOverlayEl) {
    introOverlayEl.classList.add("hidden");
    introOverlayEl.setAttribute("aria-hidden", "true");
  }

  showControlsScreen();
}

function startIntro() {
  if (!introOverlayEl || !introVideoEl) {
    showControlsScreen();
    return;
  }

  state.introActive = true;
  introOverlayEl.setAttribute("aria-hidden", "false");

  introVideoEl.addEventListener("ended", finishIntro);
  introVideoEl.addEventListener("error", finishIntro);
  introVideoEl.addEventListener(
    "playing",
    () => {
      if (introLoadingEl) {
        introLoadingEl.classList.add("hidden");
      }
    },
    { once: true }
  );
  introVideoEl.addEventListener("click", () => {
    if (introVideoEl.muted) {
      enableIntroSound();
    }
  });

  if (introSkipBtnEl) {
    introSkipBtnEl.addEventListener("click", finishIntro);
  }
  if (introSoundBtnEl) {
    introSoundBtnEl.addEventListener("click", enableIntroSound);
  }

  const playback = introVideoEl.play();
  if (!playback || typeof playback.catch !== "function") {
    return;
  }

  playback.catch(() => {
    // Autoplay con sonido bloqueado: seguimos en silencio y ofrecemos activarlo.
    introVideoEl.muted = true;
    if (introSoundBtnEl) {
      introSoundBtnEl.classList.remove("hidden");
    }

    const mutedPlayback = introVideoEl.play();
    if (!mutedPlayback || typeof mutedPlayback.catch !== "function") {
      return;
    }

    mutedPlayback.catch(() => {
      // Sin autoplay ni siquiera en silencio: hace falta un clic para arrancar.
      if (introLoadingEl) {
        introLoadingEl.textContent = "Pulsa para comenzar la pelea";
      }
      if (introSkipBtnEl) {
        introSkipBtnEl.textContent = "Continuar";
      }
    });
  });
}

const QUIZ_START_URL = "../quiz-preguntas/index.html";

let outroReturning = false;

const outroOverlayEl = document.getElementById("outro-overlay");
const outroVideoEl = document.getElementById("outro-video");
const outroLoadingEl = document.getElementById("outro-loading");
const outroBackBtnEl = document.getElementById("outro-back-btn");

function returnToQuizStart() {
  if (outroReturning) {
    return;
  }
  outroReturning = true;

  if (outroVideoEl) {
    outroVideoEl.pause();
  }

  window.location.href = QUIZ_START_URL;
}

function startOutro() {
  if (state.outroActive) {
    return;
  }

  state.outroActive = true;
  state.roundActive = false;
  keys.clear();

  if (audioBus.music) {
    audioBus.music.pause();
  }

  if (!outroOverlayEl || !outroVideoEl) {
    returnToQuizStart();
    return;
  }

  outroOverlayEl.classList.remove("hidden");
  outroOverlayEl.setAttribute("aria-hidden", "false");

  outroVideoEl.addEventListener("ended", returnToQuizStart, { once: true });
  outroVideoEl.addEventListener("error", returnToQuizStart, { once: true });
  outroVideoEl.addEventListener(
    "playing",
    () => {
      if (outroLoadingEl) {
        outroLoadingEl.classList.add("hidden");
      }
    },
    { once: true }
  );
  if (outroBackBtnEl) {
    outroBackBtnEl.addEventListener("click", returnToQuizStart);
  }

  const playback = outroVideoEl.play();
  if (!playback || typeof playback.catch !== "function") {
    return;
  }

  playback.catch(() => {
    // Autoplay bloqueado: el outro se reproduce en silencio igualmente.
    outroVideoEl.muted = true;
    const mutedPlayback = outroVideoEl.play();
    if (!mutedPlayback || typeof mutedPlayback.catch !== "function") {
      return;
    }
    mutedPlayback.catch(() => {
      if (outroLoadingEl) {
        outroLoadingEl.textContent = "Pulsa \"Volver al inicio\" para salir";
      }
    });
  });
}

let last = performance.now();
function gameLoop(now) {
  const dt = Math.min(34, now - last);
  last = now;

  const gamepadInput = readGamepadInput();
  if (gamepadInput && gamepadInput.anyPressed && !state.outroActive) {
    unlockAudioFromGesture();
  }

  if (!state.gameOver) {
    resolveFacing();
  }

  if (state.roundActive && !state.gameOver && !state.optionsOpen) {
    if (gamepadInput) {
      if (gamepadInput.punchPressed) {
        startAttack(fighter1, "punch");
      }
      if (gamepadInput.kickPressed) {
        startAttack(fighter1, "kick");
      }
      if (gamepadInput.specialPressed) {
        launchProjectile(fighter1);
      }
    }

    processInput(fighter1, dt, gamepadInput);

    if (fighter2.isCpu) {
      const cpuInput = updateCpuInput(fighter2, fighter1, dt);
      processInput(fighter2, dt, cpuInput);
      if (cpuInput.punch) {
        startAttack(fighter2, "punch");
      }
      if (cpuInput.kick) {
        startAttack(fighter2, "kick");
      }
      if (cpuInput.special) {
        launchProjectile(fighter2);
      }
    } else {
      processInput(fighter2, dt);
    }

    keepDistance();

    updateAttackState(fighter1, dt);
    updateAttackState(fighter2, dt);

    handleCombat(fighter1, fighter2);
    handleCombat(fighter2, fighter1);

    updateProjectiles(fighter1, fighter2, dt);
    updateProjectiles(fighter2, fighter1, dt);

    fighter1.hitStunMs = Math.max(0, fighter1.hitStunMs - dt);
    fighter2.hitStunMs = Math.max(0, fighter2.hitStunMs - dt);
    fighter1.attackCooldownMs = Math.max(0, fighter1.attackCooldownMs - dt);
    fighter2.attackCooldownMs = Math.max(0, fighter2.attackCooldownMs - dt);
    fighter1.specialCooldownMs = Math.max(0, fighter1.specialCooldownMs - dt);
    fighter2.specialCooldownMs = Math.max(0, fighter2.specialCooldownMs - dt);
    fighter1.hurtFlashMs = Math.max(0, fighter1.hurtFlashMs - dt);
    fighter2.hurtFlashMs = Math.max(0, fighter2.hurtFlashMs - dt);

    state.timerAccum += dt;
    if (state.timerAccum >= state.timerTickMs) {
      state.timerAccum -= state.timerTickMs;
      state.timer -= 1;
      if (state.timer <= 0) {
        state.timer = 0;
        checkTimerWin();
      }
    }
  }

  updateFighterAnimation(fighter1, dt);
  updateFighterAnimation(fighter2, dt);

  updateFarAnimation(dt);
  updateHudMessage(now);
  syncHud();

  drawBackground();
  drawGroundLayer();
  drawProjectiles(fighter1);
  drawProjectiles(fighter2);
  drawFighter(fighter1);
  drawFighter(fighter2);
  drawForegroundStageExtra();

  requestAnimationFrame(gameLoop);
}

initBackground();
initAudio();
startIntro();
