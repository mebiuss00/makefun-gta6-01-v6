// people.js — the pedestrians of Palmera. They stroll the sidewalk loop around their block,
// and they react like people: a gunshot, a scream of tyres or a fist sends them running,
// some freeze and cower, and anyone the story marks as a debtor stands out with a marker
// until the player settles the account.

import { BLOCK, BLOCKS_X, BLOCKS_Y, PED_TARGET, PED_DESPAWN_DIST } from './config.js';
import { blockOriginX, blockOriginY, collideWorld } from './city.js';
import { clamp, dist, pick, randRange } from './random.js';

const SHIRTS = ['#e2483d', '#f2a03d', '#3d7de2', '#58b368', '#e27fb1', '#f0efe9', '#3dc9e2', '#ffd23d', '#8a5cf2', '#e8e4da'];
const PANTS = ['#30343c', '#4a3b2e', '#2e4a7d', '#5d6e46', '#74584a', '#22242a'];
const SKIN = ['#f2c79b', '#d9a06b', '#a9743f', '#7d4e26', '#ffe0bd'];

export function makePed(rng, x, y) {
  return {
    x,
    y,
    angle: rng() * Math.PI * 2,
    speed: 0,
    hp: 100,
    state: 'walk', // walk | flee | cower | dead
    stateT: 0,
    block: null, // {bx, by, corner} while strolling a block's sidewalk loop
    fleeFrom: null,
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, SKIN),
    walkPhase: rng() * Math.PI * 2,
    isTarget: false, // a mission mark: this person owes somebody money
    deadT: 0,
  };
}

// The four corners of a block's sidewalk loop, inset from the kerb.
function blockCorners(bx, by) {
  const ox = blockOriginX(bx);
  const oy = blockOriginY(by);
  const inset = 18;
  return [
    { x: ox + inset, y: oy + inset },
    { x: ox + BLOCK - inset, y: oy + inset },
    { x: ox + BLOCK - inset, y: oy + BLOCK - inset },
    { x: ox + inset, y: oy + BLOCK - inset },
  ];
}

function sendToSidewalk(g, ped) {
  const bx = Math.floor(g.rng() * BLOCKS_X);
  const by = Math.floor(g.rng() * BLOCKS_Y);
  const corner = Math.floor(g.rng() * 4);
  ped.block = { bx, by, corner };
  const c = blockCorners(bx, by)[corner];
  ped.x = c.x;
  ped.y = c.y;
}

export function spawnPeds(g) {
  for (let i = 0; i < PED_TARGET; i++) {
    const ped = makePed(g.rng, 0, 0);
    sendToSidewalk(g, ped);
    // Scatter the first crowd around the player's start so the city opens alive.
    if (dist(ped.x, ped.y, g.player.x, g.player.y) > 700 && i < PED_TARGET - 8) {
      ped.block = { bx: 3 + Math.floor(g.rng() * 2), by: 4 + Math.floor(g.rng() * 2), corner: Math.floor(g.rng() * 4) };
      const c = blockCorners(ped.block.bx, ped.block.by)[ped.block.corner];
      ped.x = c.x;
      ped.y = c.y;
    }
    g.peds.push(ped);
  }
}

export function maintainPeds(g) {
  const p = g.player;
  let alive = 0;
  for (const ped of g.peds) if (ped.state !== 'dead') alive++;
  for (let i = g.peds.length - 1; i >= 0; i--) {
    const ped = g.peds[i];
    if (ped.state === 'dead') continue;
    if (!ped.isTarget && dist(ped.x, ped.y, p.x, p.y) > PED_DESPAWN_DIST) {
      g.peds.splice(i, 1);
      alive--;
    }
  }
  while (alive < PED_TARGET) {
    const ped = makePed(g.rng, 0, 0);
    sendToSidewalk(g, ped);
    if (dist(ped.x, ped.y, p.x, p.y) < 480) {
      // Too close to appear from thin air; try the next block over.
      ped.block.bx = (ped.block.bx + 3) % BLOCKS_X;
      const c = blockCorners(ped.block.bx, ped.block.by)[ped.block.corner];
      ped.x = c.x;
      ped.y = c.y;
      if (dist(ped.x, ped.y, p.x, p.y) < 480) break;
    }
    g.peds.push(ped);
    alive++;
  }
}

// Something loud and frightening happened at (x, y): everyone in earshot reacts.
export function scarePeds(g, x, y, radius) {
  for (const ped of g.peds) {
    if (ped.state === 'dead') continue;
    if (dist(ped.x, ped.y, x, y) > radius) continue;
    if (g.rng() < 0.22) {
      ped.state = 'cower';
      ped.stateT = randRange(g.rng, 1.2, 2.6);
    } else {
      ped.state = 'flee';
      ped.stateT = randRange(g.rng, 1.6, 3.4);
      ped.fleeFrom = { x, y };
    }
  }
}

export function updatePed(g, ped, dt) {
  if (ped.state === 'dead') {
    ped.deadT += dt;
    return;
  }
  ped.stateT -= dt;
  let targetSpeed = 0;
  let wantAngle = ped.angle;

  if (ped.state === 'flee' && ped.fleeFrom) {
    wantAngle = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
    targetSpeed = 238;
    if (ped.stateT <= 0) ped.state = 'walk';
  } else if (ped.state === 'cower') {
    targetSpeed = 0;
    if (ped.stateT <= 0) ped.state = 'walk';
  } else {
    // Stroll the block loop: aim at the next corner, take it, walk on.
    if (!ped.block) sendToSidewalk(g, ped);
    const corners = blockCorners(ped.block.bx, ped.block.by);
    const goal = corners[ped.block.corner];
    if (dist(ped.x, ped.y, goal.x, goal.y) < 12) {
      ped.block.corner = (ped.block.corner + 1) % 4;
      // Now and then, cross to the neighbouring block and stroll that one instead.
      if (g.rng() < 0.1) {
        ped.block.bx = clamp(ped.block.bx + (g.rng() < 0.5 ? -1 : 1), 0, BLOCKS_X - 1);
        ped.block.by = clamp(ped.block.by + (g.rng() < 0.5 ? -1 : 1), 0, BLOCKS_Y - 1);
      }
    }
    wantAngle = Math.atan2(goal.y - ped.y, goal.x - ped.x);
    targetSpeed = 74;
  }

  // A fast car close by is its own scare, whatever the state.
  if (ped.state === 'walk') {
    for (const car of g.cars) {
      if (Math.abs(car.speed) < 130) continue;
      if (dist(ped.x, ped.y, car.x, car.y) < 52) {
        ped.state = 'flee';
        ped.stateT = 1.4;
        ped.fleeFrom = { x: car.x, y: car.y };
        break;
      }
    }
  }

  const turn = clamp(wrapAngle(wantAngle - ped.angle), -3.4 * dt, 3.4 * dt);
  ped.angle += turn;
  ped.speed += (targetSpeed - ped.speed) * Math.min(1, dt * 6);
  ped.walkPhase += dt * (ped.speed > 10 ? ped.speed * 0.055 : 0);
  const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
  const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
  const fixed = collideWorld(g.city, nx, ny, 10);
  ped.x = fixed.x;
  ped.y = fixed.y;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
