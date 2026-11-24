// config.js — every shared tuning number and table for Palmera Heat: Vice Run.
// The city is a grid of avenues (vertical) and streets (horizontal). Blocks sit between them;
// south of the last street the land ends in a beach and open water.

export const BLOCK = 300; // width and height of one city block, in world pixels
export const ROAD = 92; // width of every avenue and street
export const BLOCKS_X = 8; // avenues: BLOCKS_X + 1
export const BLOCKS_Y = 6; // streets: BLOCKS_Y + 1
export const PITCH = BLOCK + ROAD; // distance between neighbouring road starts

export const LAND_W = BLOCKS_X * BLOCK + (BLOCKS_X + 1) * ROAD; // built-up land width
export const LAND_H = BLOCKS_Y * BLOCK + (BLOCKS_Y + 1) * ROAD; // built-up land height
export const SAND_H = 150; // beach strip below the last street
export const WATER_H = 330; // open water below the beach
export const WORLD_W = LAND_W;
export const WORLD_H = LAND_H + SAND_H + WATER_H;
export const SHORE_Y = LAND_H + SAND_H; // y where sand meets water

export const LANE_OFF = 15; // lane centre offset from a road's centre line (right-hand traffic)

// Player tuning.
export const WALK_SPEED = 168;
export const SPRINT_SPEED = 252;
export const PLAYER_RADIUS = 11;
export const PLAYER_MAX_HP = 100;
export const REGEN_DELAY = 5; // seconds without damage before health returns
export const REGEN_RATE = 9; // hp per second while regenerating

// Wanted system: heat points decide the star count; heat cools off while unseen.
export const STAR_THRESHOLDS = [0, 8, 22, 45, 80, 130]; // heat needed for 0..5 stars
export const HEAT_DECAY_HIDDEN = 1.7; // per second while no officer can see the player
export const HEAT_DECAY_SEEN = 0.2; // per second while watched
export const SIGHT_RANGE = 350; // an officer closer than this keeps the heat on

export const CRIME_HEAT = {
  carjack: 10,
  assault: 7,
  killPed: 30,
  shootAtCop: 16,
  hitCopCar: 14,
  runOver: 26,
  missionPickup: 12,
};

// Police strength per star: how many units the city sends, and when they open fire.
export const POLICE_CARS_BY_STAR = [0, 1, 2, 3, 4, 6];
export const POLICE_FOOT_BY_STAR = [0, 0, 1, 2, 3, 4];
export const POLICE_SHOOT_STARS = 3;
export const BUST_RADIUS = 36; // an officer this close to a slow player starts the bust ring
export const BUST_FILL_TIME = 2.1; // seconds of contact to complete a bust
export const BUST_FINE_BASE = 100;
export const BUST_FINE_PER_STAR = 60;
export const WASTED_FEE = 150; // hospital bill when the player is wasted

// Traffic and crowds.
export const TRAFFIC_TARGET = 13; // civilian cars kept rolling near the player
export const TRAFFIC_SPAWN_DIST = 880;
export const TRAFFIC_DESPAWN_DIST = 1150;
export const PED_TARGET = 28;
export const PED_DESPAWN_DIST = 1000;

// Day and night: one full cycle in seconds; 0.25 is sunrise, 0.5 noon, 0.78 sunset.
export const DAY_LENGTH = 300;
export const DAY_START = 0.34; // the game opens mid-morning

// The driveable fleet: name, size, feel and the colours it wears around Palmera.
export const CAR_TYPES = [
  { id: 'coupe', name: 'Solana Coupe', length: 46, width: 23, accel: 265, maxSpeed: 342, reverse: 110, grip: 3.4, hp: 130, colors: ['#e2483d', '#f2a03d', '#3d7de2', '#e8e4da', '#30343c'] },
  { id: 'sedan', name: 'Bayline Sedan', length: 48, width: 24, accel: 225, maxSpeed: 300, reverse: 100, grip: 3.1, hp: 150, colors: ['#9aa3ad', '#4a5560', '#7d2e2e', '#2e4a7d', '#d8d8d8'] },
  { id: 'hatch', name: 'Pico Hatch', length: 40, width: 22, accel: 205, maxSpeed: 272, reverse: 105, grip: 3.6, hp: 110, colors: ['#58b368', '#e2c53d', '#3dc9e2', '#e27fb1', '#f0efe9'] },
  { id: 'pickup', name: 'Dune Pickup', length: 50, width: 25, accel: 215, maxSpeed: 282, reverse: 95, grip: 2.8, hp: 190, colors: ['#b08954', '#5d6e46', '#74584a', '#8b9299', '#3f4a56'] },
  { id: 'van', name: 'Cargo Van', length: 52, width: 26, accel: 180, maxSpeed: 252, reverse: 90, grip: 2.6, hp: 210, colors: ['#e8e8e8', '#c9cfd4', '#7a8894', '#4c5a68'] },
  { id: 'cabrio', name: 'Marina Cabrio', length: 45, width: 23, accel: 280, maxSpeed: 356, reverse: 112, grip: 3.5, hp: 120, colors: ['#f25cd6', '#3de2d0', '#ffd23d', '#ffffff', '#8a5cf2'] },
];
export const POLICE_CAR_TYPE = { id: 'cruiser', name: 'PPD Cruiser', length: 49, width: 24, accel: 300, maxSpeed: 368, reverse: 110, grip: 3.6, hp: 220, colors: ['#1d2733'] };

// Save file key in localStorage.
export const SAVE_KEY = 'palmera-heat-vice-run/save/v1';
