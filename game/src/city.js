// city.js — builds Palmera: the avenue/street grid, the buildings that fill its blocks, the
// named landmarks the story travels between, the beach and the props scattered over it.
// It also answers the questions every other system asks: is this point on a road, which lane
// runs here, and where does a body stop when it walks into something solid.

import {
  BLOCK, ROAD, BLOCKS_X, BLOCKS_Y, PITCH, LAND_W, LAND_H, WORLD_W, SHORE_Y, LANE_OFF,
} from './config.js';
import { makeRng, pick, pushOutOfRect, randRange } from './random.js';

// The named places of Palmera, one per block, with the block they sit on. Their `point` is the
// kerbside entrance a mission marker can honestly ask the player to reach.
const LANDMARK_SPOTS = [
  { id: 'hotel', name: 'Palmera Grand Hotel', bx: 3, by: 0, color: '#f2e3c6', roof: '#c96f4a' },
  { id: 'garage', name: "Rico's Garage", bx: 1, by: 2, color: '#b8c4c9', roof: '#54626b' },
  { id: 'marina', name: 'Marina & Yacht Club', bx: 6, by: 5, color: '#dcebf2', roof: '#3d7ea6' },
  { id: 'airfield', name: 'Sunport Airfield', bx: 0, by: 0, color: '#9aa3a8', roof: '#6b757c' },
  { id: 'mall', name: 'Coral Mall', bx: 5, by: 1, color: '#f2c9c2', roof: '#b3502e' },
  { id: 'chapel', name: 'St. Lucia Chapel', bx: 2, by: 4, color: '#f5efe0', roof: '#8a4a5e' },
  { id: 'diner', name: 'Ocean Breeze Diner', bx: 4, by: 5, color: '#f7d774', roof: '#d35450' },
  { id: 'police', name: 'Palmera Police HQ', bx: 4, by: 2, color: '#cdd6e4', roof: '#33507e' },
  { id: 'hospital', name: 'Mercy General Hospital', bx: 6, by: 3, color: '#eef2f0', roof: '#b03a3a' },
  { id: 'casino', name: 'Gilded Palm Casino', bx: 5, by: 3, color: '#e9d8a6', roof: '#7a4a9e' },
  { id: 'docks', name: 'Harbor Freight Docks', bx: 0, by: 5, color: '#a8b0a2', roof: '#5d6b57' },
  { id: 'tower', name: 'Vista Tower', bx: 7, by: 0, color: '#cfd8dc', roof: '#37474f' },
  { id: 'club', name: 'Neon Palms Club', bx: 3, by: 3, color: '#3b2d4d', roof: '#c93d8f' },
  { id: 'market', name: 'Bayview Market', bx: 2, by: 1, color: '#f2e0b8', roof: '#4a7d5a' },
  { id: 'lighthouse', name: 'Lighthouse Point', bx: 7, by: 5, color: '#f0ead8', roof: '#c0392b' },
];

const ROOF_COLORS = ['#b3502e', '#54626b', '#7a6a53', '#4a6b7d', '#8a5a44', '#5d6b57', '#74584a', '#33507e'];
const WALL_COLORS = ['#f2e3c6', '#e8d8c8', '#dcebf2', '#f2c9c2', '#e6e0d0', '#d8e2dc', '#efe6da', '#e9d8a6', '#dfe8ee', '#f0dfc0'];

export function avenueCenterX(i) {
  return i * PITCH + ROAD / 2;
}

export function streetCenterY(j) {
  return j * PITCH + ROAD / 2;
}

export function blockOriginX(bx) {
  return bx * PITCH + ROAD;
}

export function blockOriginY(by) {
  return by * PITCH + ROAD;
}

// Which avenue or street band a point falls in, or -1 when it is inside a block or off land.
export function avenueAt(x) {
  if (x < 0 || x > LAND_W) return -1;
  const i = Math.floor(x / PITCH);
  return x - i * PITCH < ROAD ? i : -1;
}

export function streetAt(y) {
  if (y < 0 || y > LAND_H) return -1;
  const j = Math.floor(y / PITCH);
  return y - j * PITCH < ROAD ? j : -1;
}

export function isRoad(x, y) {
  if (y >= LAND_H) return false;
  return avenueAt(x) !== -1 || streetAt(y) !== -1;
}

// The fixed coordinate of a traffic lane: for a vertical avenue the lane's x, for a
// horizontal street the lane's y. Right-hand traffic: southbound hugs the west kerb,
// eastbound hugs the south kerb.
export function laneCoord(axis, roadIndex, dirSign) {
  if (axis === 'v') return avenueCenterX(roadIndex) + (dirSign > 0 ? -LANE_OFF : LANE_OFF);
  return streetCenterY(roadIndex) + (dirSign > 0 ? LANE_OFF : -LANE_OFF);
}

function addBuilding(city, x, y, w, h, wall, roof, name) {
  const building = { x, y, w, h, wall, roof, name: name ?? null, shade: 0.85 + city.rng() * 0.3 };
  city.buildings.push(building);
  return building;
}

function fillBlock(city, bx, by) {
  const ox = blockOriginX(bx);
  const oy = blockOriginY(by);
  const rng = city.rng;
  const pattern = pick(rng, ['single', 'pairH', 'pairV', 'quad', 'pairH', 'quad']);
  const inset = 54;
  if (pattern === 'single') {
    addBuilding(city, ox + inset, oy + inset, BLOCK - inset * 2, BLOCK - inset * 2, pick(rng, WALL_COLORS), pick(rng, ROOF_COLORS));
  } else if (pattern === 'pairH') {
    const w = (BLOCK - inset * 2 - 26) / 2;
    addBuilding(city, ox + inset, oy + inset, w, BLOCK - inset * 2, pick(rng, WALL_COLORS), pick(rng, ROOF_COLORS));
    addBuilding(city, ox + inset + w + 26, oy + inset, w, BLOCK - inset * 2, pick(rng, WALL_COLORS), pick(rng, ROOF_COLORS));
  } else if (pattern === 'pairV') {
    const h = (BLOCK - inset * 2 - 26) / 2;
    addBuilding(city, ox + inset, oy + inset, BLOCK - inset * 2, h, pick(rng, WALL_COLORS), pick(rng, ROOF_COLORS));
    addBuilding(city, ox + inset, oy + inset + h + 26, BLOCK - inset * 2, h, pick(rng, WALL_COLORS), pick(rng, ROOF_COLORS));
  } else {
    const w = (BLOCK - inset * 2 - 24) / 2;
    const h = (BLOCK - inset * 2 - 24) / 2;
    for (const dx of [0, w + 24]) {
      for (const dy of [0, h + 24]) {
        addBuilding(city, ox + inset + dx, oy + inset + dy, w, h, pick(rng, WALL_COLORS), pick(rng, ROOF_COLORS));
      }
    }
  }
}

function fillDocks(city, bx, by) {
  const ox = blockOriginX(bx);
  const oy = blockOriginY(by);
  // Three long warehouses and a yard of crates.
  addBuilding(city, ox + 34, oy + 40, BLOCK - 68, 62, '#a8b0a2', '#5d6b57', null);
  addBuilding(city, ox + 34, oy + 128, BLOCK - 68, 62, '#9aa48f', '#525f4d', null);
  addBuilding(city, ox + 34, oy + 216, 120, 58, '#b0a89a', '#6b6157', null);
  for (let i = 0; i < 9; i++) {
    city.props.push({
      kind: 'crate',
      x: ox + 190 + (i % 3) * 34,
      y: oy + 222 + Math.floor(i / 3) * 30,
      r: 13,
      tone: pick(city.rng, ['#b08954', '#7d8a99', '#a66a3f']),
    });
  }
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const city = {
    rng,
    buildings: [],
    landmarks: [],
    props: [],
    parkedSpots: [],
    lots: new Map(), // "bx,by" -> 'airfield' | 'docks' for blocks with no ordinary fill
  };

  const landmarkBlocks = new Map();
  for (const spot of LANDMARK_SPOTS) landmarkBlocks.set(spot.bx + ',' + spot.by, spot);

  for (let by = 0; by < BLOCKS_Y; by++) {
    for (let bx = 0; bx < BLOCKS_X; bx++) {
      const key = bx + ',' + by;
      const spot = landmarkBlocks.get(key);
      if (!spot) {
        fillBlock(city, bx, by);
        continue;
      }
      const ox = blockOriginX(bx);
      const oy = blockOriginY(by);
      let building = null;
      if (spot.id === 'airfield') {
        city.lots.set(key, 'airfield');
      } else if (spot.id === 'docks') {
        city.lots.set(key, 'docks');
        fillDocks(city, bx, by);
      } else {
        building = addBuilding(city, ox + 44, oy + 44, BLOCK - 88, BLOCK - 88, spot.color, spot.roof, spot.name);
      }
      city.landmarks.push({
        id: spot.id,
        name: spot.name,
        bx,
        by,
        building,
        // Kerbside entrance: middle of the block's south edge, on the sidewalk.
        point: { x: ox + BLOCK / 2, y: oy + BLOCK - 14 },
        center: { x: ox + BLOCK / 2, y: oy + BLOCK / 2 },
      });
    }
  }

  // Palms along the beach and the southern promenade.
  for (let x = 50; x < WORLD_W - 30; x += randRange(rng, 80, 130)) {
    city.props.push({ kind: 'palm', x, y: LAND_H + 52 + randRange(rng, -8, 26), r: 7, tone: '#3f7d4e' });
  }
  // Palms and lamps sprinkled over the sidewalks.
  for (let i = 0; i < 46; i++) {
    const bx = Math.floor(rng() * BLOCKS_X);
    const by = Math.floor(rng() * BLOCKS_Y);
    const side = Math.floor(rng() * 4);
    const ox = blockOriginX(bx);
    const oy = blockOriginY(by);
    const along = randRange(rng, 26, BLOCK - 26);
    const spots = [
      { x: ox + along, y: oy + 16 },
      { x: ox + along, y: oy + BLOCK - 16 },
      { x: ox + 16, y: oy + along },
      { x: ox + BLOCK - 16, y: oy + along },
    ];
    city.props.push({ kind: 'palm', x: spots[side].x, y: spots[side].y, r: 7, tone: '#3f7d4e' });
  }
  // Lamp posts at intersection corners — they matter at night.
  for (let i = 0; i <= BLOCKS_X; i++) {
    for (let j = 0; j <= BLOCKS_Y; j++) {
      city.props.push({ kind: 'lamp', x: avenueCenterX(i) - ROAD / 2 - 7, y: streetCenterY(j) - ROAD / 2 - 7, r: 0, tone: '#ffd98a' });
    }
  }
  // The lighthouse itself, standing on the sand at the south-east corner.
  city.props.push({ kind: 'lighthouse', x: WORLD_W - 74, y: SHORE_Y - 66, r: 15, tone: '#e8e2d2' });

  // Kerbside parking: fixed spots along avenue and street edges where cars sit waiting
  // to be borrowed. angle is the heading a parked car faces.
  const curb = ROAD / 2 - 10;
  for (let n = 0; n < 30; n++) {
    if (rng() < 0.55) {
      const i = Math.floor(rng() * (BLOCKS_X + 1));
      const j = Math.floor(rng() * BLOCKS_Y);
      const y = blockOriginY(j) + randRange(rng, 40, BLOCK - 40);
      const west = rng() < 0.5;
      city.parkedSpots.push({
        x: avenueCenterX(i) + (west ? -curb : curb),
        y,
        angle: west ? -Math.PI / 2 : Math.PI / 2,
      });
    } else {
      const j = Math.floor(rng() * (BLOCKS_Y + 1));
      const i = Math.floor(rng() * BLOCKS_X);
      const x = blockOriginX(i) + randRange(rng, 40, BLOCK - 40);
      const north = rng() < 0.5;
      city.parkedSpots.push({
        x,
        y: streetCenterY(j) + (north ? -curb : curb),
        angle: north ? 0 : Math.PI,
      });
    }
  }

  return city;
}

export function landmarkById(city, id) {
  return city.landmarks.find((l) => l.id === id) ?? null;
}

// Resolve a moving circle against the solid world: buildings, collidable props, the map
// edge and the waterline. Boats Palmera has none, so nothing on legs or wheels swims.
export function collideWorld(city, x, y, r) {
  let px = Math.max(r, Math.min(WORLD_W - r, x));
  let py = Math.max(r, Math.min(SHORE_Y - 6, y));
  for (const b of city.buildings) {
    if (px < b.x - r || px > b.x + b.w + r || py < b.y - r || py > b.y + b.h + r) continue;
    const fixed = pushOutOfRect(px, py, r, b);
    if (fixed) {
      px = fixed.x;
      py = fixed.y;
    }
  }
  for (const prop of city.props) {
    if (!prop.r || prop.r <= 0) continue;
    const dx = px - prop.x;
    const dy = py - prop.y;
    const rr = r + prop.r;
    if (dx * dx + dy * dy < rr * rr && (dx !== 0 || dy !== 0)) {
      const d = Math.hypot(dx, dy) || 1;
      px = prop.x + (dx / d) * rr;
      py = prop.y + (dy / d) * rr;
    }
  }
  return { x: px, y: py };
}

// Is there a building between two points? A cheap sample walk, good enough for sight lines.
export function lineBlocked(city, ax, ay, bx, by) {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 26);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const b of city.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    }
  }
  return false;
}
