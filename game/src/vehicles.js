// vehicles.js — the cars of Palmera: how one is built, the arcade physics every driver
// shares, the traffic that follows the city's lanes from intersection to intersection, and
// the parked cars waiting at kerbs to be borrowed.

import {
  CAR_TYPES, TRAFFIC_TARGET, TRAFFIC_SPAWN_DIST, TRAFFIC_DESPAWN_DIST, BLOCKS_X, BLOCKS_Y,
} from './config.js';
import { avenueAt, streetAt, laneCoord, collideWorld, isRoad } from './city.js';
import { clamp, dist, pick, randRange, angleDelta } from './random.js';

let nextCarId = 1;

export function makeCar(type, x, y, angle, color) {
  return {
    id: nextCarId++,
    type,
    x,
    y,
    angle,
    speed: 0,
    color: color ?? type.colors[0],
    hp: type.hp,
    driver: null, // null = empty, otherwise 'player' | 'traffic' | 'police'
    parked: false,
    spot: null, // the parking spot this car belongs to, when parked
    ai: null, // traffic state, set by giveTrafficBrain
    wrecked: false,
    honkAt: 0,
  };
}

export function randomCarType(rng) {
  return pick(rng, CAR_TYPES);
}

// The driving model: throttle and steer in -1..1, a handbrake flag, and a step of time.
// Returns the impact speed when the car hits the solid world, so callers can make noise.
export function stepCar(car, control, dt, city) {
  const t = car.type;
  if (car.wrecked) {
    car.speed = 0;
    return 0;
  }
  const throttle = clamp(control.throttle, -1, 1);
  const steer = clamp(control.steer, -1, 1);

  if (throttle > 0) {
    car.speed += t.accel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 8) car.speed += t.accel * 2.1 * throttle * dt; // braking
    else car.speed += t.accel * 0.55 * throttle * dt; // reversing
  }
  if (control.brake) {
    car.speed -= Math.sign(car.speed) * 340 * dt;
    if (Math.abs(car.speed) < 12) car.speed = 0;
  }
  // Rolling drag and a soft top speed.
  const drag = throttle === 0 ? 55 : 12;
  if (car.speed > 0) car.speed = Math.max(0, car.speed - drag * dt * (throttle > 0 ? 0 : 1));
  if (car.speed < 0) car.speed = Math.min(0, car.speed + drag * dt * (throttle < 0 ? 0 : 1));
  car.speed = clamp(car.speed, -t.reverse, t.maxSpeed);

  const speedFactor = clamp(car.speed / 105, -1, 1);
  const turnBoost = control.brake && Math.abs(car.speed) > 60 ? 1.45 : 1;
  car.angle += steer * t.grip * 0.72 * speedFactor * turnBoost * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const fixed = collideWorld(city, nx, ny, 15);
  let impact = 0;
  if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
    const closing = Math.abs(car.speed);
    if (closing > 90) {
      impact = closing;
      car.hp -= (closing - 80) * 0.22;
    }
    car.speed *= closing > 140 ? 0.25 : 0.55;
    if (car.hp <= 0) {
      car.hp = 0;
      car.wrecked = true;
      car.speed = 0;
    }
  }
  car.x = fixed.x;
  car.y = fixed.y;
  return impact;
}

// Separate two overlapping cars and trade a little speed; returns impact strength or 0.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const minD = (a.type.length + b.type.length) * 0.36;
  if (d === 0 || d >= minD) return 0;
  const push = (minD - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const closing = Math.abs(a.speed - b.speed);
  const impact = closing > 70 && d < minD * 0.8 ? closing : 0;
  if (impact) {
    a.hp -= (closing - 60) * 0.12;
    b.hp -= (closing - 60) * 0.12;
    if (a.hp <= 0) { a.hp = 0; a.wrecked = true; }
    if (b.hp <= 0) { b.hp = 0; b.wrecked = true; }
  }
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg + (a.speed - avg) * 0.4;
  b.speed = avg + (b.speed - avg) * 0.4;
  return impact;
}

// --- traffic ---------------------------------------------------------------------------

export function giveTrafficBrain(car, rng) {
  // Start from wherever the car sits: snap to the nearest road's lane and direction.
  const av = avenueAt(car.x);
  const st = streetAt(car.y);
  if (av !== -1 && (st === -1 || rng() < 0.5)) {
    car.ai = { axis: 'v', idx: av, dir: rng() < 0.5 ? 1 : -1, lastCross: '' };
    car.angle = car.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else if (st !== -1) {
    car.ai = { axis: 'h', idx: st, dir: rng() < 0 ? 1 : -1, lastCross: '' };
    car.angle = car.ai.dir > 0 ? 0 : Math.PI;
  } else {
    car.ai = { axis: 'v', idx: 0, dir: 1, lastCross: '' };
  }
}

// One traffic car's control for this frame: follow the lane, mind what is ahead, and
// sometimes turn at an intersection.
export function trafficControl(g, car, dt) {
  const ai = car.ai;
  const control = { throttle: 0.8, steer: 0, brake: false };

  // Intersection decisions: inside a crossing, once per crossing, maybe turn.
  const av = avenueAt(car.x);
  const st = streetAt(car.y);
  if (av !== -1 && st !== -1) {
    const key = av + ',' + st;
    if (ai.lastCross !== key) {
      ai.lastCross = key;
      // At the edge of the grid there is no straight on: the road ends at the sea
      // or the city limit, so every driver turns.
      const atEdge =
        (ai.axis === 'v' && ((ai.dir > 0 && st === BLOCKS_Y) || (ai.dir < 0 && st === 0))) ||
        (ai.axis === 'h' && ((ai.dir > 0 && av === BLOCKS_X) || (ai.dir < 0 && av === 0)));
      const roll = g.rng();
      if (atEdge || ai.forceTurn || roll < 0.34) {
        ai.forceTurn = false;
        // Turn: swap axis, take the crossing road, direction by left or right.
        const left = atEdge ? g.rng() < 0.5 : roll < 0.17;
        if (ai.axis === 'v') {
          const newDir = ai.dir > 0 ? (left ? 1 : -1) : (left ? -1 : 1);
          ai.axis = 'h';
          ai.idx = st;
          ai.dir = newDir;
        } else {
          const newDir = ai.dir > 0 ? (left ? -1 : 1) : (left ? 1 : -1);
          ai.axis = 'v';
          ai.idx = av;
          ai.dir = newDir;
        }
      }
    }
  }

  // The point this car steers for: up its lane, a little ahead of where it is.
  let tx;
  let ty;
  if (ai.axis === 'v') {
    tx = laneCoord('v', ai.idx, ai.dir);
    ty = car.y + ai.dir * 95;
  } else {
    tx = car.x + ai.dir * 95;
    ty = laneCoord('h', ai.idx, ai.dir);
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  control.steer = clamp(angleDelta(car.angle, want) * 2.1, -1, 1);

  // Traffic manners: slow for anything solid ahead, stop when it is close.
  const aheadX = car.x + Math.cos(car.angle) * 54;
  const aheadY = car.y + Math.sin(car.angle) * 54;
  for (const other of g.cars) {
    if (other === car) continue;
    const lateral = Math.abs((other.x - car.x) * -Math.sin(car.angle) + (other.y - car.y) * Math.cos(car.angle));
    if (lateral < 19 && dist(aheadX, aheadY, other.x, other.y) < 40) {
      control.throttle = 0;
      if (Math.abs(car.speed) > 30) control.brake = true;
      break;
    }
  }
  if (control.throttle > 0) {
    for (const ped of g.peds) {
      if (ped.state === 'dead') continue;
      const lateral = Math.abs((ped.x - car.x) * -Math.sin(car.angle) + (ped.y - car.y) * Math.cos(car.angle));
      if (lateral < 16 && dist(aheadX, aheadY, ped.x, ped.y) < 36) {
        control.throttle = 0;
        if (Math.abs(car.speed) > 20) control.brake = true;
        break;
      }
    }
  }
  // Do not crawl forever behind a wreck or a parked car in the lane: patience wears
  // out, and a driver who has waited long enough reroutes at the next intersection.
  if (control.throttle === 0 && Math.abs(car.speed) < 4) {
    car.honkAt += dt;
    if (car.honkAt > 6) {
      ai.forceTurn = true;
      car.honkAt = 0;
    }
  } else {
    car.honkAt = 0;
  }
  return control;
}

export function maintainTraffic(g, dt) {
  const p = g.player;
  // Retire cars that fell far behind the action.
  for (let i = g.cars.length - 1; i >= 0; i--) {
    const car = g.cars[i];
    if (car.driver !== 'traffic') continue;
    if (dist(car.x, car.y, p.x, p.y) > TRAFFIC_DESPAWN_DIST) {
      g.cars.splice(i, 1);
    }
  }
  // Wrecks are towed away after 45 seconds; Palmera keeps its streets clean. The
  // marked mission car is exempt (missions.js answers for it) and so is the wreck
  // the player is still sitting in.
  for (let i = g.cars.length - 1; i >= 0; i--) {
    const car = g.cars[i];
    if (!car.wrecked || car.missionCar || car.driver === 'player') continue;
    car.wreckAge = (car.wreckAge ?? 0) + dt;
    if (car.wreckAge > 45) {
      if (car.spot) {
        car.spot.car = null;
        car.spot.respawnAt = g.time + 45;
        car.spot = null;
      }
      g.cars.splice(i, 1);
    }
  }
  let rolling = 0;
  for (const car of g.cars) if (car.driver === 'traffic') rolling++;
  if (rolling >= TRAFFIC_TARGET) return;
  // Spawn on a road ring around the player, out of sight.
  for (let tries = 0; tries < 6 && rolling < TRAFFIC_TARGET; tries++) {
    const ang = g.rng() * Math.PI * 2;
    const d = randRange(g.rng, TRAFFIC_SPAWN_DIST * 0.8, TRAFFIC_SPAWN_DIST);
    const x = clamp(p.x + Math.cos(ang) * d, 30, 3198);
    const y = clamp(p.y + Math.sin(ang) * d, 30, 2420);
    if (!isRoad(x, y)) continue;
    const type = randomCarType(g.rng);
    const car = makeCar(type, x, y, 0, pick(g.rng, type.colors));
    car.driver = 'traffic';
    giveTrafficBrain(car, g.rng);
    // Snap onto the lane so the first frames look settled.
    if (car.ai.axis === 'v') car.x = laneCoord('v', car.ai.idx, car.ai.dir);
    else car.y = laneCoord('h', car.ai.idx, car.ai.dir);
    car.speed = randRange(g.rng, 60, 120);
    g.cars.push(car);
    rolling++;
  }
}

// --- parked cars -------------------------------------------------------------------------

export function spawnParkedCars(g) {
  for (const spot of g.city.parkedSpots) {
    spot.car = null;
    spot.respawnAt = 0;
    if (g.rng() < 0.28) continue; // some kerbs stay empty
    const type = randomCarType(g.rng);
    const car = makeCar(type, spot.x, spot.y, spot.angle, pick(g.rng, type.colors));
    car.parked = true;
    car.spot = spot;
    spot.car = car;
    g.cars.push(car);
  }
}

export function maintainParkedCars(g, timeNow) {
  for (const spot of g.city.parkedSpots) {
    if (spot.car || spot.respawnAt === 0 || timeNow < spot.respawnAt) continue;
    if (dist(spot.x, spot.y, g.player.x, g.player.y) < 420) continue; // not under the player's nose
    const type = randomCarType(g.rng);
    const car = makeCar(type, spot.x, spot.y, spot.angle, pick(g.rng, type.colors));
    car.parked = true;
    car.spot = spot;
    spot.car = car;
    g.cars.push(car);
    spot.respawnAt = 0;
  }
}

// Called when a parked car is taken: the kerb will offer another one later.
export function releaseSpot(car, timeNow) {
  if (car.spot) {
    car.spot.car = null;
    car.spot.respawnAt = timeNow + 45;
    car.spot = null;
  }
  car.parked = false;
}
