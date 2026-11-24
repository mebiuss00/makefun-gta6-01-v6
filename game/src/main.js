// main.js — Palmera Heat: Vice Run. Owns the game state and the frame: input becomes a
// player (on foot or behind a wheel), the wanted system and the missions advance, the
// camera follows, and render.js + hud.js draw the result. The title, pause, help, busted
// and wasted screens are modes of this one loop, not separate pages.

import {
  WALK_SPEED, SPRINT_SPEED, PLAYER_RADIUS, REGEN_DELAY, REGEN_RATE, DAY_LENGTH, DAY_START,
  WORLD_W, WORLD_H, BUST_FINE_BASE, BUST_FINE_PER_STAR, WASTED_FEE,
} from './config.js';
import { buildCity, landmarkById, collideWorld } from './city.js';
import { makeRng, clamp, dist } from './random.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import {
  stepCar, trafficControl, maintainTraffic, spawnParkedCars, maintainParkedCars, collideCars, releaseSpot,
} from './vehicles.js';
import { spawnPeds, maintainPeds, updatePed, makePed } from './people.js';
import { updateWanted, updatePolice } from './police.js';
import { playerMelee, playerShoot, updateBullets, reportCrime, hurtPed, hurtPlayer } from './combat.js';
import { storyMissions, startStoryMission, updateMissions, currentObjective } from './missions.js';
import { drawWorld } from './render.js';
import { drawHud, drawTitleScreen, drawPauseScreen, drawHelpScreen, drawSplash } from './hud.js';
import { loadSave, storeSave, wipeSave } from './save.js';
import { shotName, testMode, applyShot, runSelfTest } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const VIEW_W = canvas.width;
const VIEW_H = canvas.height;

const g = {
  city: null,
  rng: makeRng(20261120),
  time: 0,
  dayTime: DAY_START,
  mode: 'title', // title | play | pause | help | busted | wasted
  returnMode: 'play',
  splashT: 0,
  player: null,
  cars: [],
  peds: [],
  cops: [],
  bullets: [],
  particles: [],
  effects: [],
  heat: 0,
  stars: 0,
  watched: false,
  bustProgress: 0,
  lastCrimeAt: -99,
  lastCrimePos: { x: 0, y: 0 },
  money: 40,
  totalEarned: 0,
  errandsDone: 0,
  storyIndex: 0,
  storyDone: false,
  storyDefs: [],
  mission: null,
  errand: null,
  errandAt: 0,
  nextMissionAt: 0,
  banner: null,
  promptText: '',
  camera: { x: 0, y: 0, w: VIEW_W, h: VIEW_H },
  sound: new SoundBank(),
  input: new Input(canvas),
  dirtySave: false,
  saveTimer: 0,
  noiseAt: null,
};

g.showBanner = (title, sub, seconds) => {
  g.banner = { title, sub, since: g.time, until: g.time + seconds };
};

// --- life, death and the law's paperwork ---------------------------------------------------

g.onTargetDown = () => {
  // The mission engine counts the fallen itself each frame; nothing else to do.
};

g.onPlayerWasted = () => {
  if (g.mode !== 'play') return;
  g.mode = 'wasted';
  g.splashT = 2.8;
  g.sound.wasted();
  g.sound.setEngine(0, false);
  g.sound.setSiren(false);
};

g.onPlayerBusted = () => {
  if (g.mode !== 'play') return;
  g.mode = 'busted';
  g.splashT = 2.8;
  g.bustFine = BUST_FINE_BASE + g.stars * BUST_FINE_PER_STAR;
  g.sound.bust();
  g.sound.setEngine(0, false);
  g.sound.setSiren(false);
};

function respawnAfterSplash() {
  const p = g.player;
  if (p.car) {
    p.car.driver = null;
    p.car = null;
  }
  if (g.mode === 'wasted') {
    const hospital = landmarkById(g.city, 'hospital');
    p.x = hospital.point.x;
    p.y = hospital.point.y + 26;
    g.money = Math.max(0, g.money - WASTED_FEE);
    g.showBanner('Discharged', 'The hospital kept $' + WASTED_FEE + ' of your money.', 3.4);
  } else {
    const hq = landmarkById(g.city, 'police');
    p.x = hq.point.x;
    p.y = hq.point.y + 26;
    g.money = Math.max(0, g.money - (g.bustFine ?? 100));
    g.showBanner('Released', 'The fine was $' + (g.bustFine ?? 100) + '. The job, if there is one, still waits.', 3.4);
  }
  p.hp = 100;
  p.angle = -Math.PI / 2;
  g.heat = 0;
  g.stars = 0;
  g.bustProgress = 0;
  // The force stands down.
  for (const car of g.cars) if (car.driver === 'police') car.driver = null;
  g.cops.length = 0;
  g.mode = 'play';
  g.dirtySave = true;
}

// --- getting into and out of cars ------------------------------------------------------------

function enterNearestCar() {
  const p = g.player;
  if (p.car || g.mode !== 'play') return;
  let best = null;
  let bestD = 54;
  for (const car of g.cars) {
    if (car.wrecked) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    // A carjacking: the driver is thrown out and runs, and somebody phones it in.
    best.driver = null;
    const driver = makePed(g.rng, best.x + 20, best.y + 14);
    driver.state = 'flee';
    driver.stateT = 3;
    driver.fleeFrom = { x: p.x, y: p.y };
    g.peds.push(driver);
    reportCrime(g, 'carjack', best.x, best.y);
  } else if (best.driver === 'police') {
    reportCrime(g, 'carjack', best.x, best.y);
    g.heat += 8;
  }
  if (best.parked) releaseSpot(best, g.time);
  best.driver = 'player';
  p.car = best;
  p.x = best.x;
  p.y = best.y;
  g.sound.door();
}

function exitCar() {
  const p = g.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  p.car = null;
  const side = car.angle + Math.PI / 2;
  const fixed = collideWorld(g.city, car.x + Math.cos(side) * (car.type.width / 2 + 15), car.y + Math.sin(side) * (car.type.width / 2 + 15), PLAYER_RADIUS);
  p.x = fixed.x;
  p.y = fixed.y;
  g.sound.door();
}

// --- the player --------------------------------------------------------------------------------

function updatePlayer(dt) {
  const p = g.player;
  const input = g.input;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.meleeCd = Math.max(0, p.meleeCd - dt);
  p.swingT = Math.max(0, p.swingT - dt);
  p.muzzleT = Math.max(0, p.muzzleT - dt);

  if (input.wasPressed('KeyE')) {
    if (p.car) exitCar();
    else enterNearestCar();
  }

  if (p.car) {
    const car = p.car;
    const control = {
      throttle: (input.down('KeyW', 'ArrowUp') ? 1 : 0) + (input.down('KeyS', 'ArrowDown') ? -1 : 0),
      steer: (input.down('KeyA', 'ArrowLeft') ? -1 : 0) + (input.down('KeyD', 'ArrowRight') ? 1 : 0),
      brake: input.down('Space'),
    };
    const impact = stepCar(car, control, dt, g.city);
    if (impact > 130) {
      g.sound.crash(impact / 40);
      spawnSparks(car.x, car.y, 8);
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speedMag = Math.abs(car.speed);
    g.sound.setEngine(car.speed / car.type.maxSpeed, true);
    // Running somebody down is loud, ugly and very much a crime.
    if (Math.abs(car.speed) > 55) {
      for (const ped of [...g.peds, ...g.cops]) {
        if (ped.state === 'dead') continue;
        if (dist(car.x, car.y, ped.x, ped.y) < car.type.length * 0.46) {
          hurtPed(g, ped, 200, 'car');
          if (ped.state !== 'dead') {
            ped.state = 'flee';
            ped.stateT = 2.4;
            ped.fleeFrom = { x: car.x, y: car.y };
          } else {
            reportCrime(g, ped.isCop ? 'shootAtCop' : 'runOver', ped.x, ped.y);
          }
          g.sound.crash(2);
        }
      }
    }
  } else {
    g.sound.setEngine(0, false);
    const axis = input.moveAxis();
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    const speed = sprint ? SPRINT_SPEED : WALK_SPEED;
    const moving = axis.x !== 0 || axis.y !== 0;
    p.speedMag = moving ? speed : 0;
    // Aim with the mouse while it is held; otherwise face where you walk.
    const mouseWorld = { x: input.mouse.x + g.camera.x, y: input.mouse.y + g.camera.y };
    if (input.mouse.down) {
      p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
      playerShoot(g, p.angle);
    } else if (moving) {
      p.angle = Math.atan2(axis.y, axis.x);
    }
    if (input.wasPressed('KeyF')) playerMelee(g);
    const nx = p.x + axis.x * speed * dt * (moving ? 1 : 0);
    const ny = p.y + axis.y * speed * dt * (moving ? 1 : 0);
    const fixed = collideWorld(g.city, nx, ny, PLAYER_RADIUS);
    p.x = fixed.x;
    p.y = fixed.y;
    p.walkPhase += dt * (moving ? speed * 0.055 : 0);
    // Traffic that fails to stop in time can still hurt.
    for (const car of g.cars) {
      if (car.driver === 'player' || Math.abs(car.speed) < 95) continue;
      if (dist(p.x, p.y, car.x, car.y) < car.type.length * 0.44 && g.time - p.lastHurtAt > 0.8) {
        hurtPlayer(g, 14, car.x, car.y);
        const push = collideWorld(g.city, p.x + (p.x - car.x) * 0.4, p.y + (p.y - car.y) * 0.4, PLAYER_RADIUS);
        p.x = push.x;
        p.y = push.y;
      }
    }
  }

  // Health creeps back once the shooting stops.
  if (p.hp > 0 && g.time - p.lastHurtAt > REGEN_DELAY) {
    p.hp = Math.min(100, p.hp + REGEN_RATE * dt);
  }
}

// --- particles and effects -----------------------------------------------------------------------

function spawnSparks(x, y, count) {
  for (let i = 0; i < count; i++) {
    const a = g.rng() * Math.PI * 2;
    const sp = 40 + g.rng() * 130;
    g.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.4 + g.rng() * 0.3,
      maxLife: 0.7,
      size: 1.6 + g.rng() * 1.8,
      color: '#ffd23d',
    });
  }
}

function updateParticles(dt) {
  for (const pt of g.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - 2.4 * dt;
    pt.vy *= 1 - 2.4 * dt;
    pt.life -= dt;
  }
  g.particles = g.particles.filter((pt) => pt.life > 0);
  for (const fx of g.effects) fx.t += dt * 2.2;
  g.effects = g.effects.filter((fx) => fx.t < 1 && fx.kind !== 'hurtFlash');
}

// --- the frame update ------------------------------------------------------------------------------

function update(dt) {
  g.time += dt;
  g.dayTime = (g.dayTime + dt / DAY_LENGTH) % 1;
  g.promptText = '';

  if (g.mode === 'play') {
    updatePlayer(dt);
    // The enter-car prompt is the floor; missions may talk over it.
    if (!g.player.car) {
      for (const car of g.cars) {
        if (!car.wrecked && dist(g.player.x, g.player.y, car.x, car.y) < 54) {
          g.promptText = car.driver === 'traffic' ? 'E — Pull the driver out' : 'E — Take the ' + car.type.name;
          break;
        }
      }
    } else if (Math.abs(g.player.car.speed) < 40) {
      g.promptText = 'E — Get out';
    }
  }

  // Traffic and crowds live in every mode but the splashes.
  maintainTraffic(g, dt);
  for (const car of g.cars) {
    if (car.driver === 'traffic') {
      const control = trafficControl(g, car, dt);
      stepCar(car, control, dt, g.city);
    }
  }
  maintainParkedCars(g, g.time);
  for (let i = 0; i < g.cars.length; i++) {
    for (let j = i + 1; j < g.cars.length; j++) {
      const a = g.cars[i];
      const b = g.cars[j];
      if (Math.abs(a.x - b.x) > 70 || Math.abs(a.y - b.y) > 70) continue;
      const impact = collideCars(a, b);
      if (impact > 120 && (a.driver === 'player' || b.driver === 'player')) {
        g.sound.crash(impact / 45);
        spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 7);
        if (a.driver === 'police' || b.driver === 'police') reportCrime(g, 'hitCopCar', g.player.x, g.player.y);
      }
    }
  }
  maintainPeds(g);
  for (const ped of g.peds) updatePed(g, ped, dt);

  if (g.mode === 'play') {
    updateWanted(g, dt);
    updatePolice(g, dt);
    updateBullets(g, dt);
    updateMissions(g, dt);
  }
  updateParticles(dt);

  // The camera leans into motion a little.
  const focus = g.player.car ?? g.player;
  const look = g.player.car ? 0.34 : 0.12;
  const tx = focus.x + Math.cos(focus.angle) * (focus.speed ?? 0) * look - VIEW_W / 2;
  const ty = focus.y + Math.sin(focus.angle) * (focus.speed ?? 0) * look - VIEW_H / 2;
  const k = Math.min(1, dt * 5);
  g.camera.x += (clamp(tx, 0, WORLD_W - VIEW_W) - g.camera.x) * k;
  g.camera.y += (clamp(ty, 0, WORLD_H - VIEW_H) - g.camera.y) * k;

  // Autosave, throttled.
  g.saveTimer += dt;
  if (g.dirtySave && g.saveTimer > 3) {
    g.saveTimer = 0;
    g.dirtySave = false;
    storeSave(g);
  }
}

// Ambient-only update for the title screen: the city breathes behind the logo.
function updateAmbient(dt) {
  g.time += dt;
  g.dayTime = (g.dayTime + dt / DAY_LENGTH) % 1;
  maintainTraffic(g, dt);
  for (const car of g.cars) {
    if (car.driver === 'traffic') stepCar(car, trafficControl(g, car, dt), dt, g.city);
  }
  for (const ped of g.peds) updatePed(g, ped, dt);
  updateParticles(dt);
  // A slow drift over the south of the city.
  const cx = WORLD_W / 2 + Math.sin(g.time * 0.05) * 420 - VIEW_W / 2;
  const cy = WORLD_H * 0.52 + Math.cos(g.time * 0.037) * 160 - VIEW_H / 2;
  g.camera.x = clamp(cx, 0, WORLD_W - VIEW_W);
  g.camera.y = clamp(cy, 0, WORLD_H - VIEW_H);
}

// --- starting, restarting ---------------------------------------------------------------------------

function freshPlayer() {
  const diner = landmarkById(g.city, 'diner');
  return {
    x: diner.point.x - 60,
    y: diner.point.y + 44,
    angle: -Math.PI / 2,
    hp: 100,
    car: null,
    speedMag: 0,
    shootCd: 0,
    meleeCd: 0,
    swingT: 0,
    muzzleT: 0,
    lastHurtAt: -99,
    walkPhase: 0,
    shirt: '#14b8a6',
    pants: '#22242a',
    skin: '#d9a06b',
    isCop: false,
    isTarget: false,
    state: 'walk',
  };
}

function startPlay(useSave) {
  const save = useSave ? loadSave() : null;
  g.cars = [];
  g.peds = [];
  g.cops = [];
  g.bullets = [];
  g.particles = [];
  g.effects = [];
  g.heat = 0;
  g.stars = 0;
  g.bustProgress = 0;
  g.mission = null;
  g.errand = null;
  g.errandAt = g.time + 8;
  g.nextMissionAt = 0;
  g.banner = null;
  g.player = freshPlayer();
  g.money = save ? save.money : 40;
  g.storyIndex = save ? save.storyIndex : 0;
  g.storyDone = save ? save.storyDone : false;
  g.errandsDone = save ? save.errandsDone : 0;
  g.totalEarned = save ? save.totalEarned : 0;
  if (save && save.muted) g.sound.setMuted(true);
  spawnParkedCars(g);
  spawnPeds(g);
  // Snap the camera onto the player so play opens framed.
  g.camera.x = clamp(g.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  g.camera.y = clamp(g.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  g.mode = 'play';
  if (!g.storyDone && g.storyIndex < g.storyDefs.length) {
    startStoryMission(g, g.storyIndex);
  } else {
    g.showBanner('Palmera Heat', 'Free roam — the teal markers are paid errands.', 4);
  }
}

// --- boot and the loop ---------------------------------------------------------------------------------

function boot() {
  g.city = buildCity(20261120);
  g.storyDefs = storyMissions(g.city);
  g.player = freshPlayer();
  spawnParkedCars(g);
  spawnPeds(g);

  const shot = shotName();
  if (testMode()) {
    startPlay(false);
    const api = { step: (dt) => update(dt), enterCar: enterNearestCar, exitCar };
    runSelfTest(g, api);
  } else if (shot) {
    startPlay(false);
    applyShot(g, shot);
  }

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    const input = g.input;
    if (input.anyGesture) g.sound.wake();

    if (g.mode === 'title') {
      updateAmbient(dt);
      if (input.wasPressed('Enter')) startPlay(true);
      else if (input.wasPressed('KeyN')) {
        wipeSave();
        startPlay(false);
      }
    } else if (g.mode === 'busted' || g.mode === 'wasted') {
      g.splashT -= dt;
      if (g.splashT <= 0) respawnAfterSplash();
    } else if (g.mode === 'pause') {
      if (input.wasPressed('KeyP', 'Escape')) g.mode = 'play';
    } else if (g.mode === 'help') {
      if (input.wasPressed('KeyH', 'Escape')) g.mode = g.returnMode;
    } else {
      if (input.wasPressed('KeyP', 'Escape')) g.mode = 'pause';
      else if (input.wasPressed('KeyH')) {
        g.returnMode = 'play';
        g.mode = 'help';
      } else {
        update(dt);
      }
    }
    if (input.wasPressed('KeyM')) {
      g.sound.setMuted(!g.sound.muted);
      g.dirtySave = true;
    }

    // Draw.
    const objective = g.mode === 'play' || g.mode === 'pause' ? currentObjective(g) : null;
    drawWorld(ctx, g, g.camera, objective);
    if (g.mode === 'title') drawTitleScreen(ctx, g, Boolean(loadSave()));
    else if (g.mode === 'busted') drawSplash(ctx, 'busted', 'The PPD keeps the car. The fine comes out of your pocket.');
    else if (g.mode === 'wasted') drawSplash(ctx, 'wasted', 'Mercy General patches you up and bills you for it.');
    else {
      drawHud(ctx, g, objective);
      if (g.mode === 'pause') drawPauseScreen(ctx, g);
      if (g.mode === 'help') drawHelpScreen(ctx, g);
    }

    input.endFrame();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
