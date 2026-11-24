// render.js — everything the camera sees: the sun-bleached streets of Palmera, its roofs
// and palms, traffic and crowds, the law, the player, and the light itself as the day
// turns. All of it is drawn from code on the canvas; the game ships no image files.

import {
  BLOCK, ROAD, BLOCKS_X, BLOCKS_Y, LAND_W, LAND_H, WORLD_W, WORLD_H, SHORE_Y, SAND_H,
} from './config.js';
import { avenueCenterX, streetCenterY, blockOriginX, blockOriginY } from './city.js';
import { clamp } from './random.js';

// How dark the world is right now: 0 at noon, up to 0.62 in the small hours.
export function darknessAt(dayTime) {
  const sun = Math.sin((dayTime - 0.25) * Math.PI * 2);
  return clamp(0.28 - sun * 0.55, 0, 0.62);
}

function drawGround(ctx, g, cam) {
  const { x: cx, y: cy, w, h } = cam;
  // Land base: warm urban ground.
  ctx.fillStyle = '#8f9a7d';
  ctx.fillRect(cx, cy, w, h);
  // The beach.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(cx, LAND_H, w, SAND_H + 4);
  // The sea, with slow light on it.
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(cx, SHORE_Y, w, WORLD_H - SHORE_Y);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const y = SHORE_Y + 22 + r * 58;
    for (let x = Math.floor(cx / 90) * 90; x < cx + w; x += 90) {
      const off = Math.sin(g.time * 0.7 + x * 0.01 + r * 1.7) * 14;
      ctx.moveTo(x + off, y);
      ctx.lineTo(x + off + 38, y);
    }
  }
  ctx.stroke();
  // Foam at the waterline.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(cx, SHORE_Y - 3, w, 4);
}

function drawBlocks(ctx, g, cam) {
  const { x: cx, y: cy, w, h } = cam;
  ctx.fillStyle = '#c9c2b2';
  for (let by = 0; by < BLOCKS_Y; by++) {
    for (let bx = 0; bx < BLOCKS_X; bx++) {
      const ox = blockOriginX(bx);
      const oy = blockOriginY(by);
      if (ox + BLOCK < cx || oy + BLOCK < cy || ox > cx + w || oy > cy + h) continue;
      ctx.fillRect(ox, oy, BLOCK, BLOCK);
      // The airfield lot is concrete and runway, not sidewalk.
      if (g.city.lots.get(bx + ',' + by) === 'airfield') {
        ctx.fillStyle = '#9aa0a4';
        ctx.fillRect(ox + 14, oy + 14, BLOCK - 28, BLOCK - 28);
        ctx.fillStyle = '#7e858a';
        ctx.fillRect(ox + 30, oy + BLOCK / 2 - 26, BLOCK - 60, 52);
        ctx.fillStyle = '#e8e8e8';
        for (let x = ox + 44; x < ox + BLOCK - 50; x += 34) ctx.fillRect(x, oy + BLOCK / 2 - 3, 18, 6);
        ctx.fillStyle = '#c9c2b2';
      }
    }
  }
}

function drawRoads(ctx, g, cam) {
  const { x: cx, y: cy, w, h } = cam;
  ctx.fillStyle = '#3d4149';
  const y0 = Math.max(0, cy);
  const y1 = Math.min(LAND_H, cy + h);
  for (let i = 0; i <= BLOCKS_X; i++) {
    const x = avenueCenterX(i) - ROAD / 2;
    if (x + ROAD < cx || x > cx + w) continue;
    ctx.fillRect(x, y0, ROAD, y1 - y0);
  }
  const x0 = Math.max(0, cx);
  const x1 = Math.min(LAND_W, cx + w);
  for (let j = 0; j <= BLOCKS_Y; j++) {
    const y = streetCenterY(j) - ROAD / 2;
    if (y + ROAD < cy || y > cy + h) continue;
    ctx.fillRect(x0, y, x1 - x0, ROAD);
  }
  // Centre dashes.
  ctx.fillStyle = '#d8b93d';
  for (let i = 0; i <= BLOCKS_X; i++) {
    const x = avenueCenterX(i);
    if (x < cx - 4 || x > cx + w + 4) continue;
    for (let y = Math.floor(cy / 46) * 46; y < Math.min(LAND_H, cy + h); y += 46) {
      if (streetAtCrossing(y)) continue;
      ctx.fillRect(x - 2, y, 4, 24);
    }
  }
  for (let j = 0; j <= BLOCKS_Y; j++) {
    const y = streetCenterY(j);
    if (y < cy - 4 || y > cy + h + 4) continue;
    for (let x = Math.floor(cx / 46) * 46; x < Math.min(LAND_W, cx + w); x += 46) {
      if (avenueAtCrossing(x)) continue;
      ctx.fillRect(x, y - 2, 24, 4);
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(240,240,240,0.55)';
  for (let i = 0; i <= BLOCKS_X; i++) {
    for (let j = 0; j <= BLOCKS_Y; j++) {
      const x = avenueCenterX(i);
      const y = streetCenterY(j);
      if (x + ROAD < cx || y + ROAD < cy || x - ROAD > cx + w || y - ROAD > cy + h) continue;
      for (let s = -3; s <= 3; s++) {
        ctx.fillRect(x + s * 12 - 3, y - ROAD / 2 + 3, 6, 14);
        ctx.fillRect(x + s * 12 - 3, y + ROAD / 2 - 17, 6, 14);
        ctx.fillRect(x - ROAD / 2 + 3, y + s * 12 - 3, 14, 6);
        ctx.fillRect(x + ROAD / 2 - 17, y + s * 12 - 3, 14, 6);
      }
    }
  }
}

function streetAtCrossing(y) {
  const rel = ((y % (BLOCK + ROAD)) + BLOCK + ROAD) % (BLOCK + ROAD);
  return rel < ROAD;
}

function avenueAtCrossing(x) {
  return streetAtCrossing(x);
}

function drawBuildings(ctx, g, cam, darkness) {
  const { x: cx, y: cy, w, h } = cam;
  for (const b of g.city.buildings) {
    if (b.x + b.w < cx || b.y + b.h < cy || b.x > cx + w || b.y > cy + h) continue;
    // Shadow first, thrown south-east.
    ctx.fillStyle = 'rgba(30,30,40,0.28)';
    ctx.fillRect(b.x + 9, b.y + 12, b.w, b.h);
    // Footprint walls, then the roof pulled in from the edge.
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    const inset = 8;
    ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
    // Roof clutter, placed by the building's own numbers so it never flickers.
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    const seed = Math.floor(b.x * 7 + b.y * 13);
    if (b.w > 90) ctx.fillRect(b.x + 18 + (seed % 30), b.y + 16, 22, 14);
    if (b.h > 90) ctx.fillRect(b.x + b.w - 40 - (seed % 22), b.y + b.h - 34, 18, 12);
    if (b.name) {
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const labelY = b.y - 8;
      ctx.fillStyle = 'rgba(20,20,30,0.65)';
      const tw = ctx.measureText(b.name).width;
      ctx.fillRect(b.x + b.w / 2 - tw / 2 - 6, labelY - 12, tw + 12, 17);
      ctx.fillStyle = darkness > 0.3 ? '#ffd98a' : '#ffffff';
      ctx.fillText(b.name, b.x + b.w / 2, labelY + 1);
    }
  }
}

function drawProps(ctx, g, cam) {
  const { x: cx, y: cy, w, h } = cam;
  for (const prop of g.city.props) {
    if (prop.x < cx - 40 || prop.y < cy - 40 || prop.x > cx + w + 40 || prop.y > cy + h + 40) continue;
    if (prop.kind === 'palm') {
      ctx.fillStyle = 'rgba(30,30,40,0.25)';
      ctx.beginPath();
      ctx.ellipse(prop.x + 5, prop.y + 7, 13, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(prop.x, prop.y + 6);
      ctx.lineTo(prop.x, prop.y - 6);
      ctx.stroke();
      ctx.strokeStyle = '#3f8a52';
      ctx.lineWidth = 3;
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + prop.x * 0.01;
        ctx.beginPath();
        ctx.moveTo(prop.x, prop.y - 6);
        ctx.quadraticCurveTo(
          prop.x + Math.cos(a) * 11,
          prop.y - 10 + Math.sin(a) * 5,
          prop.x + Math.cos(a) * 17,
          prop.y - 4 + Math.sin(a) * 9,
        );
        ctx.stroke();
      }
    } else if (prop.kind === 'crate') {
      ctx.fillStyle = prop.tone;
      ctx.fillRect(prop.x - 12, prop.y - 12, 24, 24);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(prop.x - 12, prop.y - 12, 24, 24);
      ctx.beginPath();
      ctx.moveTo(prop.x - 12, prop.y - 12);
      ctx.lineTo(prop.x + 12, prop.y + 12);
      ctx.moveTo(prop.x + 12, prop.y - 12);
      ctx.lineTo(prop.x - 12, prop.y + 12);
      ctx.stroke();
    } else if (prop.kind === 'lighthouse') {
      ctx.fillStyle = prop.tone;
      ctx.beginPath();
      ctx.moveTo(prop.x - 11, prop.y + 16);
      ctx.lineTo(prop.x - 7, prop.y - 18);
      ctx.lineTo(prop.x + 7, prop.y - 18);
      ctx.lineTo(prop.x + 11, prop.y + 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(prop.x - 9, prop.y - 2, 18, 7);
      ctx.fillStyle = '#ffd23d';
      ctx.fillRect(prop.x - 5, prop.y - 25, 10, 7);
    }
    // Lamps are drawn in the night pass, when they are lit.
  }
}

export function drawCar(ctx, car, time, darkness) {
  const t = car.type;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(20,20,30,0.3)';
  ctx.fillRect(-t.length / 2 + 3, -t.width / 2 + 5, t.length, t.width);
  // Body.
  ctx.fillStyle = car.wrecked ? '#2c2c30' : car.color;
  roundRect(ctx, -t.length / 2, -t.width / 2, t.length, t.width, 6);
  ctx.fill();
  if (car.driver === 'police') {
    ctx.fillStyle = '#e8ecf0';
    ctx.fillRect(-t.length * 0.18, -t.width / 2 + 2, t.length * 0.36, t.width - 4);
    // Light bar: red and blue take turns.
    const phase = Math.floor(time * 5) % 2 === 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#5a3b3b';
    ctx.fillRect(-7, -t.width / 2 + 3, 6, 7);
    ctx.fillStyle = phase ? '#3b4a6b' : '#2e7de2';
    ctx.fillRect(1, -t.width / 2 + 3, 6, 7);
  }
  // Cabin and glass.
  ctx.fillStyle = 'rgba(18,24,34,0.85)';
  roundRect(ctx, -t.length * 0.16, -t.width / 2 + 4, t.length * 0.34, t.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(18,24,34,0.6)';
  ctx.fillRect(t.length * 0.24, -t.width / 2 + 5, t.length * 0.1, t.width - 10);
  // Wheels.
  ctx.fillStyle = '#14161a';
  const wy = t.width / 2 - 2;
  ctx.fillRect(-t.length / 2 + 5, -wy - 2, 10, 5);
  ctx.fillRect(-t.length / 2 + 5, wy - 3, 10, 5);
  ctx.fillRect(t.length / 2 - 15, -wy - 2, 10, 5);
  ctx.fillRect(t.length / 2 - 15, wy - 3, 10, 5);
  // Headlights at night.
  if (darkness > 0.22 && !car.wrecked) {
    ctx.fillStyle = 'rgba(255,240,180,0.9)';
    ctx.fillRect(t.length / 2 - 2, -t.width / 2 + 3, 3, 5);
    ctx.fillRect(t.length / 2 - 2, t.width / 2 - 8, 3, 5);
  }
  ctx.restore();
  // Headlight cones live outside the rotation restore so they can glow softly.
  if (darkness > 0.22 && !car.wrecked && (car.driver === 'player' || car.driver === 'police' || Math.abs(car.speed) > 5)) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const grad = ctx.createLinearGradient(t.length / 2, 0, t.length / 2 + 120, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(t.length / 2, -8);
    ctx.lineTo(t.length / 2 + 120, -30);
    ctx.lineTo(t.length / 2 + 120, 30);
    ctx.lineTo(t.length / 2, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // A sick engine smokes.
  if (!car.wrecked && car.hp < car.type.hp * 0.35 && car.driver) {
    const puff = 5 + Math.sin(time * 9 + car.id) * 2;
    ctx.fillStyle = 'rgba(60,60,60,0.35)';
    ctx.beginPath();
    ctx.arc(car.x + Math.cos(car.angle) * car.type.length * 0.4, car.y + Math.sin(car.angle) * car.type.length * 0.4 - 4, puff, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPerson(ctx, ped, isPlayer, time) {
  const bob = ped.state === 'dead' ? 0 : Math.sin(ped.walkPhase ?? 0) * 1.4;
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'dead') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // Shadow and legs.
  ctx.fillStyle = 'rgba(20,20,30,0.28)';
  ctx.beginPath();
  ctx.ellipse(1, 4, 8, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ped.pants;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle + 0.6) * (5 + bob), Math.sin(ped.angle + 0.6) * (5 + bob));
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(ped.angle - 0.6) * (5 - bob), Math.sin(ped.angle - 0.6) * (5 - bob));
  ctx.stroke();
  // Body and head.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7.4, 0, Math.PI * 2);
  ctx.fill();
  if (ped.isCop) {
    ctx.fillStyle = '#16233d';
    ctx.beginPath();
    ctx.arc(0, 0, 5.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 1.6, Math.sin(ped.angle) * 1.6, 4.4, 0, Math.PI * 2);
  ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 10.6, 0, Math.PI * 2);
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(Math.cos(ped.angle) * 8, Math.sin(ped.angle) * 8);
    ctx.lineTo(Math.cos(ped.angle) * 13, Math.sin(ped.angle) * 13);
    ctx.stroke();
  }
  // A swung fist or a raised gun shows as a short arm line.
  if (ped.swingT > 0 || ped.muzzleT > 0) {
    ctx.strokeStyle = ped.skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(ped.angle) * 15, Math.sin(ped.angle) * 15);
    ctx.stroke();
  }
  if (ped.muzzleT > 0) {
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 19, Math.sin(ped.angle) * 19, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Mission debtors wear a red marker so the player can find the argument — until
  // the argument is settled and they are down for good.
  if (ped.isTarget && ped.state !== 'dead' && ped.state !== 'roughed') {
    const bounce = Math.sin(time * 5) * 3;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.moveTo(ped.x, ped.y - 16 + bounce);
    ctx.lineTo(ped.x - 6, ped.y - 26 + bounce);
    ctx.lineTo(ped.x + 6, ped.y - 26 + bounce);
    ctx.closePath();
    ctx.fill();
  }
}

function drawObjectiveMarker(ctx, g, objective) {
  const pulse = 1 + Math.sin(g.time * 4) * 0.12;
  ctx.save();
  // A column of light the whole district can see.
  const grad = ctx.createLinearGradient(0, objective.y - 190, 0, objective.y);
  grad.addColorStop(0, 'rgba(255,210,61,0)');
  grad.addColorStop(1, hexToRgba(objective.color, 0.35));
  ctx.fillStyle = objective.color === '#ffd23d' ? grad : grad;
  ctx.fillRect(objective.x - 7, objective.y - 190, 14, 190);
  ctx.strokeStyle = objective.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, 30 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hexToRgba(objective.color, 0.16);
  ctx.beginPath();
  ctx.arc(objective.x, objective.y, 30 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const gg = (n >> 8) & 255;
  const b = n & 255;
  return 'rgba(' + r + ',' + gg + ',' + b + ',' + alpha + ')';
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The full frame: world first, then the things in it, then the light of the hour.
export function drawWorld(ctx, g, cam, objective) {
  const darkness = darknessAt(g.dayTime);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  drawGround(ctx, g, cam);
  drawBlocks(ctx, g, cam);
  drawRoads(ctx, g, cam);
  drawBuildings(ctx, g, cam, darkness);
  drawProps(ctx, g, cam);
  // The dockside crate holding the SMG, while it still holds it: a dark case with a
  // teal glint that breathes so a passer-by notices it.
  if (g.weaponPickup && !g.weaponPickup.taken) {
    const wp = g.weaponPickup;
    if (wp.x > cam.x - 40 && wp.y > cam.y - 40 && wp.x < cam.x + cam.w + 40 && wp.y < cam.y + cam.h + 40) {
      const pulse = 0.55 + Math.sin(g.time * 4) * 0.25;
      ctx.fillStyle = 'rgba(20,20,30,0.3)';
      ctx.fillRect(wp.x - 13, wp.y - 7, 28, 20);
      ctx.fillStyle = '#3a3f46';
      ctx.fillRect(wp.x - 15, wp.y - 11, 28, 20);
      ctx.strokeStyle = 'rgba(61,226,208,' + pulse.toFixed(3) + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(wp.x - 15, wp.y - 11, 28, 20);
      ctx.fillStyle = '#3de2d0';
      ctx.fillRect(wp.x - 9, wp.y - 3, 16, 4);
      ctx.fillRect(wp.x + 5, wp.y - 6, 4, 7);
    }
  }
  if (objective) drawObjectiveMarker(ctx, g, objective);

  for (const car of g.cars) {
    if (car.x < cam.x - 90 || car.y < cam.y - 90 || car.x > cam.x + cam.w + 90 || car.y > cam.y + cam.h + 90) continue;
    drawCar(ctx, car, g.time, darkness);
  }
  for (const ped of g.peds) drawPerson(ctx, ped, false, g.time);
  for (const cop of g.cops) drawPerson(ctx, cop, false, g.time);
  if (!g.player.car) drawPerson(ctx, g.player, true, g.time);

  // Bullets as short bright streaks.
  ctx.strokeStyle = '#ffe98a';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const b of g.bullets) {
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
  }
  ctx.stroke();

  // Particles: sparks, smoke, dust.
  for (const pt of g.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1) * 0.8;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // One-shot effects.
  for (const fx of g.effects) {
    if (fx.kind === 'spark') {
      ctx.strokeStyle = '#ffd23d';
      ctx.lineWidth = 2;
      for (let s = 0; s < 5; s++) {
        const a = (s / 5) * Math.PI * 2 + fx.t * 7;
        ctx.beginPath();
        ctx.moveTo(fx.x, fx.y);
        ctx.lineTo(fx.x + Math.cos(a) * (6 + fx.t * 30), fx.y + Math.sin(a) * (6 + fx.t * 30));
        ctx.stroke();
      }
    } else if (fx.kind === 'boom') {
      ctx.fillStyle = 'rgba(255,120,40,' + (0.5 * (1 - fx.t)) + ')';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 12 + fx.t * 55, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // The hour's light lies over everything.
  if (darkness > 0.01) {
    ctx.fillStyle = 'rgba(14,16,52,' + darkness.toFixed(3) + ')';
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  const sun = Math.sin((g.dayTime - 0.25) * Math.PI * 2);
  if (sun > -0.05 && sun < 0.42 && g.dayTime > 0.5) {
    ctx.fillStyle = 'rgba(255,120,40,' + ((0.42 - sun) * 0.16).toFixed(3) + ')';
    ctx.fillRect(0, 0, cam.w, cam.h);
  }
  // Lamp light pools, drawn after the dark so they read as light.
  if (darkness > 0.2) {
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    for (const prop of g.city.props) {
      if (prop.kind !== 'lamp') continue;
      if (prop.x < cam.x - 70 || prop.y < cam.y - 70 || prop.x > cam.x + cam.w + 70 || prop.y > cam.y + cam.h + 70) continue;
      const grad = ctx.createRadialGradient(prop.x, prop.y, 2, prop.x, prop.y, 46);
      grad.addColorStop(0, 'rgba(255,217,138,0.5)');
      grad.addColorStop(1, 'rgba(255,217,138,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd98a';
      ctx.fillRect(prop.x - 2, prop.y - 2, 4, 4);
    }
    ctx.restore();
  }
}
