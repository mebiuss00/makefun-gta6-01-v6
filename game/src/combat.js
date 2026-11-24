// combat.js — fists, bullets and consequences. The player punches with F and shoots with
// the mouse; officers shoot back once the wanted level turns serious. Every violent act
// reports itself to the wanted system, because in Palmera somebody always sees.

import { CRIME_HEAT } from './config.js';
import { collideWorld, lineBlocked } from './city.js';
import { dist } from './random.js';
import { scarePeds } from './people.js';

export function makeBullet(x, y, angle, from) {
  const speed = 780;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 0.55,
    from, // 'player' | 'police'
    dead: false,
  };
}

// The wanted system's ear: heat rises, and the nearest officers learn where it happened.
export function reportCrime(g, kind, x, y) {
  g.heat += CRIME_HEAT[kind] ?? 5;
  g.lastCrimeAt = g.time;
  g.lastCrimePos = { x, y };
}

export function hurtPlayer(g, amount, fromX, fromY) {
  const p = g.player;
  if (g.mode !== 'play' || p.hp <= 0) return;
  p.hp -= amount;
  p.lastHurtAt = g.time;
  g.effects.push({ kind: 'hurtFlash', t: 0 });
  if (p.hp <= 0) {
    p.hp = 0;
    g.onPlayerWasted(fromX, fromY);
  }
}

export function hurtPed(g, ped, amount, cause) {
  if (ped.state === 'dead') return;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.state = 'dead';
    ped.deadT = 0;
    ped.speed = 0;
    if (cause === 'player') {
      reportCrime(g, ped.isCop ? 'shootAtCop' : 'killPed', ped.x, ped.y);
      if (ped.isTarget) g.onTargetDown(ped);
    }
    scarePeds(g, ped.x, ped.y, 240);
  } else if (cause === 'player') {
    ped.state = 'flee';
    ped.stateT = 2.2;
    ped.fleeFrom = { x: g.player.x, y: g.player.y };
    reportCrime(g, 'assault', ped.x, ped.y);
  }
}

export function hurtCar(g, car, amount, cause) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.wrecked = true;
    car.speed = 0;
    g.effects.push({ kind: 'boom', x: car.x, y: car.y, t: 0 });
    scarePeds(g, car.x, car.y, 300);
  }
  if (cause === 'player' && car.driver === 'police') {
    reportCrime(g, 'hitCopCar', car.x, car.y);
  }
}

// The player's swing: short range, wide arc, honest damage.
export function playerMelee(g) {
  const p = g.player;
  if (p.meleeCd > 0 || p.car) return;
  p.meleeCd = 0.38;
  p.swingT = 0.18;
  g.sound.punch();
  let hitSomething = false;
  for (const ped of [...g.peds, ...g.cops]) {
    if (ped.state === 'dead') continue;
    if (dist(p.x, p.y, ped.x, ped.y) > 40) continue;
    const to = Math.atan2(ped.y - p.y, ped.x - p.x);
    if (Math.abs(wrapAngle(to - p.angle)) > 1.15) continue;
    hurtPed(g, ped, 55, 'player');
    hitSomething = true;
  }
  for (const car of g.cars) {
    if (dist(p.x, p.y, car.x, car.y) < 40) {
      hurtCar(g, car, 9, 'player');
      hitSomething = true;
    }
  }
  if (hitSomething) scarePeds(g, p.x, p.y, 130);
}

// The player's shot: one bullet toward the mouse, a little spread, a lot of noise.
export function playerShoot(g, aimAngle) {
  const p = g.player;
  if (p.shootCd > 0 || p.car) return;
  p.shootCd = 0.16;
  p.muzzleT = 0.05;
  const spread = (g.rng() - 0.5) * 0.045;
  g.bullets.push(makeBullet(p.x + Math.cos(aimAngle) * 16, p.y + Math.sin(aimAngle) * 16, aimAngle + spread, 'player'));
  g.sound.shot();
  g.noiseAt = { x: p.x, y: p.y, t: g.time };
  scarePeds(g, p.x, p.y, 250);
  // Firing at all is a crime somebody reports; firing near officers is worse.
  g.heat += 3;
  g.lastCrimeAt = g.time;
  g.lastCrimePos = { x: p.x, y: p.y };
}

// An officer's shot: slower, less accurate, and only once the stars allow it.
export function copShoot(g, cop, target) {
  const base = Math.atan2(target.y - cop.y, target.x - cop.x);
  const spread = (g.rng() - 0.5) * 0.16;
  g.bullets.push(makeBullet(cop.x + Math.cos(base) * 15, cop.y + Math.sin(base) * 15, base + spread, 'police'));
  g.sound.shot();
  cop.muzzleT = 0.05;
}

export function updateBullets(g, dt) {
  for (const b of g.bullets) {
    if (b.dead) continue;
    b.life -= dt;
    if (b.life <= 0) {
      b.dead = true;
      continue;
    }
    const nx = b.x + b.vx * dt;
    const ny = b.y + b.vy * dt;
    // Buildings stop bullets.
    const probe = collideWorld(g.city, nx, ny, 1);
    if (Math.abs(probe.x - nx) > 0.6 || Math.abs(probe.y - ny) > 0.6) {
      b.dead = true;
      g.effects.push({ kind: 'spark', x: nx, y: ny, t: 0 });
      continue;
    }
    b.x = nx;
    b.y = ny;
    if (b.from === 'player') {
      let struck = false;
      for (const ped of [...g.peds, ...g.cops]) {
        if (ped.state === 'dead') continue;
        if (dist(b.x, b.y, ped.x, ped.y) < 11) {
          hurtPed(g, ped, 34, 'player');
          struck = true;
          break;
        }
      }
      if (!struck) {
        for (const car of g.cars) {
          if (car === g.player.car) continue;
          if (dist(b.x, b.y, car.x, car.y) < car.type.length * 0.42) {
            hurtCar(g, car, 16, 'player');
            struck = true;
            break;
          }
        }
      }
      if (struck) b.dead = true;
    } else {
      // Police bullets only hunt the player (and the car the player sits in).
      const p = g.player;
      const target = p.car ?? p;
      const radius = p.car ? p.car.type.length * 0.42 : 11;
      if (dist(b.x, b.y, target.x, target.y) < radius) {
        hurtPlayer(g, 7, b.x, b.y);
        b.dead = true;
      }
    }
  }
  g.bullets = g.bullets.filter((b) => !b.dead);
}

// Sight check used by officers and by the wanted system's cooling-off rule.
export function canSee(city, ax, ay, bx, by, range) {
  if (dist(ax, ay, bx, by) > range) return false;
  return !lineBlocked(city, ax, ay, bx, by);
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
