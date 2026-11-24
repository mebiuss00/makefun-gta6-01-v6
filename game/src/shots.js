// shots.js — the two back doors a living game needs and a player never sees.
//   ?shot=<scene>  stages a framed moment (cover, chase, mission, night) so the entry's
//                  screenshots are real renders of the real game, identically repeatable.
//   ?test=1        plays the game by itself — walks, drives, commits a crime, finishes a
//                  job — and writes PASS/FAIL lines into #test-results for a headless
//                  browser to read back.

import { CAR_TYPES, POLICE_CAR_TYPE } from './config.js';
import { avenueCenterX, streetCenterY } from './city.js';
import { makeCar } from './vehicles.js';
import { startStoryMission } from './missions.js';
import { loadSave, storeSave } from './save.js';
import { reportCrime } from './combat.js';

export function shotName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

export function testMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('test') === '1';
}

function putPlayerInCar(g, car) {
  car.driver = 'player';
  car.parked = false;
  g.player.car = car;
  g.player.x = car.x;
  g.player.y = car.y;
}

function addPoliceCar(g, x, y, angle) {
  const car = makeCar(POLICE_CAR_TYPE, x, y, angle, POLICE_CAR_TYPE.colors[0]);
  car.driver = 'police';
  car.copOut = false;
  g.cars.push(car);
  return car;
}

// Stage one named scene. The simulation keeps running afterwards, so a screenshot taken
// a moment later catches Palmera mid-breath, not posed and frozen.
export function applyShot(g, name) {
  const p = g.player;
  g.mode = 'play';
  const snapCamera = () => {
    const focus = p.car ?? p;
    g.camera.x = Math.max(0, Math.min(3228 - g.camera.w, focus.x - g.camera.w / 2));
    g.camera.y = Math.max(0, Math.min(2900 - g.camera.h, focus.y - g.camera.h / 2));
  };
  if (name === 'cover') {
    g.dayTime = 0.4;
    startStoryMission(g, 0);
    p.x = avenueCenterX(4) - 30;
    p.y = streetCenterY(5) - 60;
    p.angle = -0.6;
    snapCamera();
  } else if (name === 'chase') {
    g.dayTime = 0.52;
    startStoryMission(g, 0);
    const ride = makeCar(carTypeById('coupe'), avenueCenterX(5), streetCenterY(3) + 120, -Math.PI / 2, '#e2483d');
    ride.speed = 235;
    g.cars.push(ride);
    putPlayerInCar(g, ride);
    addPoliceCar(g, avenueCenterX(5) + 8, streetCenterY(3) + 310, -Math.PI / 2).speed = 218;
    addPoliceCar(g, avenueCenterX(5) - 26, streetCenterY(3) + 400, -Math.PI / 2).speed = 205;
    g.heat = 52;
    g.lastCrimeAt = g.time;
    snapCamera();
  } else if (name === 'mission') {
    g.dayTime = 0.44;
    g.storyIndex = 1;
    startStoryMission(g, 1);
    const hotel = g.city.landmarks.find((l) => l.id === 'hotel');
    const ride = makeCar(carTypeById('sedan'), hotel.point.x - 260, hotel.point.y + 130, 0.5, '#3d7de2');
    ride.speed = 120;
    g.cars.push(ride);
    putPlayerInCar(g, ride);
    snapCamera();
  } else if (name === 'night') {
    g.dayTime = 0.985;
    startStoryMission(g, 0);
    const club = g.city.landmarks.find((l) => l.id === 'club');
    const ride = makeCar(carTypeById('cabrio'), club.point.x - 90, club.point.y + 120, 0.9, '#f25cd6');
    ride.speed = 90;
    g.cars.push(ride);
    putPlayerInCar(g, ride);
    addPoliceCar(g, club.point.x - 320, club.point.y + 190, 0.7).speed = 80;
    g.heat = 26;
    g.lastCrimeAt = g.time;
    snapCamera();
  }
}

function carTypeById(id) {
  return CAR_TYPES.find((t) => t.id === id);
}

// --- the self-test -------------------------------------------------------------------------

export function runSelfTest(g, api) {
  const lines = [];
  let passed = 0;
  let total = 0;
  const check = (name, ok, detail = '') => {
    total++;
    if (ok) passed++;
    lines.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : ''));
  };
  const step = (seconds) => {
    const frames = Math.round(seconds * 60);
    for (let i = 0; i < frames; i++) api.step(1 / 60);
  };

  try {
    // 1. The world exists and is the size the brief demands.
    check('world: at least 60 buildings', g.city.buildings.length >= 60, g.city.buildings.length + ' buildings');
    check('world: at least 12 named landmarks', g.city.landmarks.length >= 12, g.city.landmarks.length + ' landmarks');
    check('world: parking spots laid out', g.city.parkedSpots.length >= 20, g.city.parkedSpots.length + ' spots');

    // 2. The player spawns on foot, alive, in the world.
    const p = g.player;
    check('player: spawned on foot', !p.car && p.hp > 0 && p.x > 0 && p.y > 0, 'at ' + Math.round(p.x) + ',' + Math.round(p.y));

    // 3. Walking moves the player.
    const startX = p.x;
    g.input.keys.add('KeyD');
    step(1);
    g.input.keys.delete('KeyD');
    check('player: walks with D held', p.x > startX + 40, 'moved ' + Math.round(p.x - startX) + 'px');

    // 4. Driving works: borrow the nearest parked car and accelerate.
    let parked = null;
    for (const car of g.cars) if (car.parked) { parked = car; break; }
    check('cars: a parked car exists to steal', Boolean(parked));
    if (parked) {
      // Give the drive a clear stretch of avenue: this test is about driving, not parking.
      parked.x = avenueCenterX(4) - 15;
      parked.y = streetCenterY(3);
      parked.angle = -Math.PI / 2;
      parked.speed = 0;
      p.x = parked.x + 26;
      p.y = parked.y;
      api.enterCar();
      check('cars: player got in', p.car === parked);
      const carStartX = parked.x;
      const carStartY = parked.y;
      g.input.keys.add('KeyW');
      step(2);
      g.input.keys.delete('KeyW');
      const moved = Math.hypot(parked.x - carStartX, parked.y - carStartY);
      check('cars: the car accelerates and travels', parked.speed > 40 && moved > 90, 'speed ' + Math.round(parked.speed) + ', moved ' + Math.round(moved) + 'px');
      api.exitCar();
      check('cars: player got back out', !p.car);
    }

    // 5. Crime raises the wanted level and the police answer.
    reportCrime(g, 'killPed', p.x, p.y);
    reportCrime(g, 'killPed', p.x, p.y);
    step(0.2);
    check('wanted: heat becomes 3+ stars', g.stars >= 3, 'heat ' + Math.round(g.heat) + ', stars ' + g.stars);
    step(6);
    let policeCars = 0;
    for (const car of g.cars) if (car.driver === 'police') policeCars++;
    check('police: cruisers respond', policeCars >= 1, policeCars + ' on scene');

    // 6. A whole story job can be finished, and it pays.
    for (let i = g.cars.length - 1; i >= 0; i--) if (g.cars[i].driver === 'police') g.cars.splice(i, 1);
    g.cops.length = 0;
    g.heat = 0;
    g.storyIndex = 0;
    g.mission = null;
    const moneyBefore = g.money;
    startStoryMission(g, 0);
    check('mission: job 1 starts', Boolean(g.mission) && g.mission.stepIndex === 0);
    // Step 1: meet Rico.
    let stepDef = g.mission.def.steps[0];
    p.x = stepDef.at.x;
    p.y = stepDef.at.y;
    step(0.3);
    check('mission: goto step completes', g.mission && g.mission.stepIndex === 1, 'step ' + (g.mission ? g.mission.stepIndex : '-'));
    // Step 2: steal the marked coupe.
    const missionCar = g.mission.car;
    check('mission: the marked car exists', Boolean(missionCar));
    if (missionCar) {
      p.x = missionCar.x + 26;
      p.y = missionCar.y;
      api.enterCar();
      step(0.3);
      check('mission: stealing it advances the job', g.mission && g.mission.stepIndex === 2, 'step ' + (g.mission ? g.mission.stepIndex : '-'));
      // Step 3: deliver it to the diner.
      stepDef = g.mission.def.steps[2];
      missionCar.x = stepDef.at.x;
      missionCar.y = stepDef.at.y;
      missionCar.speed = 0;
      p.x = missionCar.x;
      p.y = missionCar.y;
      step(0.4);
      check('mission: delivery finishes the job', g.mission === null && g.storyIndex === 1);
      check('mission: the payout landed', g.money === moneyBefore + 300, 'money ' + moneyBefore + ' -> ' + g.money);
      api.exitCar();
    }

    // 7. The save round-trips.
    storeSave(g);
    const loaded = loadSave();
    check('save: localStorage round-trip', Boolean(loaded) && loaded.money === g.money && loaded.storyIndex === g.storyIndex);

    // 8. Heat cools while nobody watches. (Sub-star heat, so no new units are sent:
    // at 2 stars the PPD would quite correctly come and watch, and the heat would stay.)
    if (p.car) api.exitCar();
    g.heat = 7.9;
    p.x = 120;
    p.y = 120;
    const heatBefore = g.heat;
    step(3);
    check('wanted: heat decays unseen', g.heat < heatBefore - 3, 'heat ' + heatBefore.toFixed(1) + ' -> ' + g.heat.toFixed(1));
  } catch (err) {
    lines.push('FAIL test crashed — ' + (err && err.message ? err.message : String(err)));
    total++;
  }

  lines.push('RESULT: ' + passed + '/' + total + ' passed');
  const el = document.getElementById('test-results');
  if (el) el.textContent = lines.join('\n');
  document.title = 'TESTS ' + passed + '/' + total;
  window.__TEST_RESULTS__ = lines;
  return lines;
}
