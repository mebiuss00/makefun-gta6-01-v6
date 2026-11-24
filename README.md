# makefun-gta6-01-v2

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/mebiuss00/makefun-gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/mebiuss00/makefun-gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Palmera Heat: Vice Run** — a top-down 2D open-world crime game set in Palmera, a sun-soaked coastal vice city of 8×6 avenue blocks, fifteen named landmarks, a beach and open water to the south. Everything is drawn and synthesized in code: no image or audio files, no libraries, no network requests — the whole game is static files under `game/`.

What is in the city:

- **Open world on foot and by car** — walk the sidewalks, sprint, swim nowhere (the sea is a wall, like real consequences), and drive six civilian vehicle types plus the PPD cruiser, each with its own speed, grip and toughness.
- **Traffic and crowds** — civilian cars follow the lane grid, turn at intersections, brake for each other and for pedestrians; 28 pedestrians stroll the block loops and flee, cower or run from gunfire, crashes and fast cars.
- **Carjacking** — pull a driver out of a moving car and take it, if you can live with the report that follows.
- **A wanted system, 1–5 stars** — crimes add heat; cruisers and officers respond in strength, chase on wheels and on foot, open fire at three stars and up, and close a bust ring around a player caught slow. Break their sight line and the heat cools.
- **Combat** — fists with F, mouse-aimed shooting with the left button, for the player and for the police.
- **Five chained story jobs** — *First Wheels*, *Lucia's Package*, *Dockside Debts*, *Sunport Run* and *The Vice Run* ($300–$1,600 each), plus repeatable timed errands between landmarks that keep paying after the story ends.
- **HUD and live minimap** — cash, health, wanted stars, the current objective, police and objective markers on the map.
- **A full day/night cycle** — sunset tint, lit street lamps, headlight cones and neon after dark.
- **Procedural WebAudio** — a synthwave loop, an engine that follows the throttle, two-tone sirens, gunshots, punches, crashes and payouts. Nothing is sampled.
- **Saving** — money, story progress and earnings persist in `localStorage`.

## Run it

```sh
node serve.ts          # serves game/ at http://localhost:8080
# or hand the entry in (writes out/dossier.json):
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Open the page, press **ENTER**, and Palmera is yours. There is also a self-test: open `index.html?test=1` and the game plays itself — walking, driving, crime, a finished job, a save — and reports 19 checks in the page.

## Controls

| Input | Action |
|---|---|
| WASD / arrows | Walk, or drive in a car |
| E | Enter / exit a car (pull a driver out to steal it) |
| Mouse | Aim |
| Left mouse button | Shoot |
| F | Melee |
| Shift | Sprint on foot |
| Space | Handbrake |
| P / Esc | Pause |
| H | Help |
| M | Mute |

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to the output and writes `dossier.json` with the vendored kit library.
- `game/src/` — the game, one job per file: `city.js` builds the world, `vehicles.js` drives it, `people.js` walks it, `police.js` polices it, `combat.js` fights in it, `missions.js` pays for work in it, `render.js` and `hud.js` draw it, `audio.js` scores it, `save.js` remembers it, `shots.js` stages its screenshots and runs its self-test, and `main.js` ties the frame together.
- `screenshots/` — four real renders of the game (cover, chase, mission, night), staged by the `?shot=` scenes in `shots.json`.

MIT licensed — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
