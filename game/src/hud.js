// hud.js — everything nailed to the screen rather than the world: cash and health, the
// wanted stars, the minimap, the current objective, prompts and banners, and the menu
// screens (title, pause, help, busted, wasted) that pause the streets.

import { WORLD_W, WORLD_H, LAND_H, SHORE_Y, WEAPONS } from './config.js';
import { avenueCenterX, streetCenterY } from './city.js';
import { clamp } from './random.js';

const MAP_W = 208;
const MAP_H = 187;

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = 'rgba(12,14,22,' + alpha + ')';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

export function drawMinimap(ctx, g, objective) {
  const x0 = ctx.canvas.width - MAP_W - 14;
  const y0 = 14;
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.save();
  panel(ctx, x0 - 4, y0 - 4, MAP_W + 8, MAP_H + 8, 0.6);
  ctx.beginPath();
  ctx.rect(x0, y0, MAP_W, MAP_H);
  ctx.clip();
  ctx.fillStyle = '#77815f';
  ctx.fillRect(x0, y0, MAP_W, MAP_H);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(x0, y0 + SHORE_Y * sy, MAP_W, MAP_H - SHORE_Y * sy);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(x0, y0 + LAND_H * sy, MAP_W, (SHORE_Y - LAND_H) * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(40,44,52,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 8; i++) {
    ctx.moveTo(x0 + avenueCenterX(i) * sx, y0);
    ctx.lineTo(x0 + avenueCenterX(i) * sx, y0 + LAND_H * sy);
  }
  for (let j = 0; j <= 6; j++) {
    ctx.moveTo(x0, y0 + streetCenterY(j) * sy);
    ctx.lineTo(x0 + MAP_W, y0 + streetCenterY(j) * sy);
  }
  ctx.stroke();
  // Landmarks as pale dots.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const l of g.city.landmarks) {
    ctx.fillRect(x0 + l.center.x * sx - 1.5, y0 + l.center.y * sy - 1.5, 3, 3);
  }
  // Police, flashing blue and red.
  const flash = Math.floor(g.time * 3) % 2 === 0;
  for (const car of g.cars) {
    if (car.driver !== 'police') continue;
    ctx.fillStyle = flash ? '#ff3b30' : '#2e7de2';
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of g.cops) {
    if (cop.state === 'dead') continue;
    ctx.fillStyle = '#2e7de2';
    ctx.beginPath();
    ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // The objective breathes.
  if (objective) {
    const r = 4 + Math.sin(g.time * 5) * 1.4;
    ctx.fillStyle = objective.color;
    ctx.beginPath();
    ctx.arc(x0 + objective.x * sx, y0 + objective.y * sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = objective.color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x0 + objective.x * sx, y0 + objective.y * sy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The player is a white arrow that turns with them.
  const p = g.player;
  const px = x0 + p.x * sx;
  const py = y0 + p.y * sy;
  ctx.translate(px, py);
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.4, 5);
  ctx.lineTo(0, 2.4);
  ctx.lineTo(-4.4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHud(ctx, g, objective) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const p = g.player;

  // Cash and health, top-left.
  panel(ctx, 14, 14, 196, 62);
  ctx.fillStyle = '#7de08a';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('$' + g.money.toLocaleString('en-US'), 26, 44);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(26, 54, 172, 9);
  ctx.fillStyle = p.hp > 30 ? '#e2483d' : (Math.floor(g.time * 6) % 2 ? '#e2483d' : '#ff8a7a');
  ctx.fillRect(26, 54, 172 * clamp(p.hp / 100, 0, 1), 9);

  // What is in the player's hand, when they are on foot to use it.
  if (!p.car && p.weapon) {
    const w = WEAPONS.find((x) => x.id === p.weapon);
    if (w) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(w.name + (p.weapons && p.weapons.length > 1 ? '  ·  Q to switch' : ''), 26, 94);
    }
  }

  drawMinimap(ctx, g, objective);

  // Wanted stars under the minimap.
  if (g.stars > 0 || g.heat > 1) {
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    for (let s = 0; s < 5; s++) {
      const active = s < g.stars;
      ctx.fillStyle = active ? '#ffd23d' : 'rgba(255,255,255,0.28)';
      if (active && g.watched && Math.floor(g.time * 4) % 2 === 0) ctx.fillStyle = '#ff9d3d';
      ctx.fillText('★', W - 18 - (4 - s) * 24, MAP_H + 52);
    }
  }

  // Objective, bottom-left.
  if (objective) {
    panel(ctx, 14, H - 84, 430, 70, 0.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = objective.color;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(objective.title.toUpperCase(), 26, H - 58);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, objective.label, 26, H - 36, 406, 18, 2);
  }

  // Context prompt, bottom-centre.
  if (g.promptText) {
    ctx.font = '600 16px system-ui, sans-serif';
    const tw = ctx.measureText(g.promptText).width;
    panel(ctx, W / 2 - tw / 2 - 14, H - 52, tw + 28, 34, 0.65);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(g.promptText, W / 2, H - 30);
  }

  // The bust ring closes around the player on screen.
  if (g.bustProgress > 0.02) {
    const sx = p.x - g.camera.x;
    const sy = p.y - g.camera.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(sx, sy - 6, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(sx, sy - 6, 26, -Math.PI / 2, -Math.PI / 2 + g.bustProgress * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ff3b30';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', sx, sy - 44);
  }

  // A banner for jobs and payouts.
  if (g.banner && g.time < g.banner.until) {
    const remain = g.banner.until - g.time;
    const alpha = clamp(remain / 0.6, 0, 1) * clamp((g.banner.until - g.banner.since) / 0.3 + 0.2, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const bw = Math.max(360, ctx.measureText(g.banner.title).width + 90);
    panel(ctx, W / 2 - bw / 2, 96, bw, g.banner.sub ? 74 : 52, 0.68);
    ctx.fillStyle = '#ffd23d';
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(g.banner.title, W / 2, 126);
    if (g.banner.sub) {
      ctx.fillStyle = '#e8e8e8';
      ctx.font = '14px system-ui, sans-serif';
      wrapText(ctx, g.banner.sub, W / 2 - bw / 2 + 20, 148, bw - 40, 17, 2, 'center');
    }
    ctx.restore();
  }

  // Fresh damage stings the edges of the screen.
  if (g.time - p.lastHurtAt < 0.3) {
    const a = (0.3 - (g.time - p.lastHurtAt)) * 0.9;
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.36, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(200,30,30,0)');
    grad.addColorStop(1, 'rgba(200,30,30,' + a.toFixed(3) + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines, align = 'left') {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  ctx.textAlign = align;
  const drawX = align === 'center' ? x + maxWidth / 2 : x;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, drawX, y + lines * lineHeight);
      lines++;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, drawX, y + lines * lineHeight);
}

// --- full-screen states -------------------------------------------------------------------

export function drawTitleScreen(ctx, g, hasSave) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(10,10,26,0.45)';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, H * 0.16, 0, H * 0.62);
  grad.addColorStop(0, 'rgba(242,92,214,0.0)');
  grad.addColorStop(0.5, 'rgba(242,92,214,0.20)');
  grad.addColorStop(1, 'rgba(61,226,208,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, H * 0.16, W, H * 0.46);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText('P A L M E R A', W / 2, H * 0.30);
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillText('HEAT', W / 2, H * 0.30 + 82);
  ctx.fillStyle = '#3de2d0';
  ctx.font = '700 25px system-ui, sans-serif';
  ctx.fillText('— FULL SERVICE —', W / 2, H * 0.30 + 122);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in a sun-soaked coastal city.', W / 2, H * 0.30 + 158);
  ctx.fillText('Steal cars. Run jobs. Outrun the Palmera PD.', W / 2, H * 0.30 + 180);
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23d';
  if (hasSave) {
    ctx.fillText('Press ENTER to continue   ·   N for a new game', W / 2, H * 0.78);
  } else {
    ctx.fillText('Press ENTER to start', W / 2, H * 0.78);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move · E enter car · Mouse aim · Click shoot · F melee · Shift sprint · P pause · H help', W / 2, H * 0.78 + 30);
}

export function drawPauseScreen(ctx, g) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,8,18,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H * 0.4);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#d8d8d8';
  ctx.fillText('Cash $' + g.money.toLocaleString('en-US') + '   ·   Jobs done: ' + g.storyIndex + '/' + g.storyDefs.length + '   ·   Errands: ' + g.errandsDone, W / 2, H * 0.4 + 40);
  ctx.fillText('P or Esc to keep playing · M to ' + (g.sound.muted ? 'unmute' : 'mute'), W / 2, H * 0.4 + 68);
}

export function drawHelpScreen(ctx, g) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = 'rgba(8,8,18,0.78)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23d';
  ctx.font = '800 34px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY PALMERA', W / 2, H * 0.2);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#f0f0f0';
  ctx.font = '17px system-ui, sans-serif';
  const lines = [
    'WASD / arrows — walk, or drive when you are in a car',
    'E — get into the nearest car (parked, or pull a driver out)',
    'Mouse — aim · Left click — shoot · F — melee · Q — switch weapon',
    'Shift — sprint on foot · Space — handbrake in a car',
    'Follow the gold marker: story jobs pay the rent, teal errands pay the rest',
    'Crimes raise your wanted stars. More stars, more police, and they shoot at 3+',
    'Break their sight line and let the heat cool — or get caught slow and pay the fine',
    "Hot and flush? G at Rico's Garage: $150 and the heat forgets your face",
    'A second gun sleeps in a crate by the docks, for anyone who goes looking',
    'P — pause · H — this help · M — mute · Your money and progress save themselves',
  ];
  lines.forEach((line, i) => ctx.fillText(line, W / 2 - 330, H * 0.2 + 52 + i * 30));
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3de2d0';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillText('Press H or Esc to go back', W / 2, H * 0.2 + 52 + lines.length * 30 + 16);
}

export function drawSplash(ctx, kind, sub) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,30,80,0.55)' : 'rgba(80,10,10,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 72px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H * 0.46);
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(sub, W / 2, H * 0.46 + 40);
}
