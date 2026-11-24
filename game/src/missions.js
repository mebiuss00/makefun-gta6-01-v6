// missions.js — the work that pays. An eight-job story chain runs Rico's errands into
// something bigger, each job a short list of steps (go, steal, pick up, rough up, deliver)
// watched by the engine below; between story jobs the city itself offers repeatable paid
// errands — a pickup at one landmark, a timed drop at another.

import { CAR_TYPES } from './config.js';
import { landmarkById } from './city.js';
import { dist, pick, randRange } from './random.js';
import { makeCar } from './vehicles.js';
import { makePed } from './people.js';
import { reportCrime } from './combat.js';

// The story, in order. Steps are resolved against the city's landmarks when a job starts,
// so this table stays a story, not a pile of coordinates.
export function storyMissions(city) {
  const L = (id) => landmarkById(city, id).point;
  return [
    {
      id: 'first-wheels',
      title: 'First Wheels',
      giver: 'Rico',
      intro: 'Rico needs a coupe moved, no questions. Start at his garage.',
      payout: 300,
      steps: [
        { kind: 'goto', at: L('garage'), label: "Meet Rico at Rico's Garage" },
        { kind: 'steal', at: L('club'), label: 'Steal the marked coupe behind the Neon Palms Club', carAt: { x: L('club').x + 66, y: L('club').y + 30 } },
        { kind: 'deliver', at: L('diner'), label: 'Bring the coupe to the Ocean Breeze Diner', needsMissionCar: true },
      ],
    },
    {
      id: 'lucias-package',
      title: "Lucia's Package",
      giver: 'Lucia',
      intro: 'A guest at the Palmera Grand left something that cannot fly. Take it to the marina.',
      payout: 450,
      steps: [
        { kind: 'pickup', at: L('hotel'), label: 'Pick up the package at the Palmera Grand Hotel', heatOnDone: 'missionPickup' },
        { kind: 'deliver', at: L('marina'), label: 'Deliver it to the Marina & Yacht Club' },
      ],
    },
    {
      id: 'market-money',
      title: 'Market Money',
      giver: 'Lucia',
      intro: "Bayview Market's stalls pay for protection in cash. Collect it, and leave it where the faithful will find it.",
      payout: 550,
      steps: [
        { kind: 'pickup', at: L('market'), label: 'Collect the cashbox at Bayview Market', heatOnDone: 'missionPickup' },
        { kind: 'deliver', at: L('chapel'), label: 'Leave it at St. Lucia Chapel' },
      ],
    },
    {
      id: 'dockside-debts',
      title: 'Dockside Debts',
      giver: 'Rico',
      intro: 'Three men at the docks owe Rico money and have forgotten. Remind them.',
      payout: 600,
      steps: [
        { kind: 'goto', at: L('docks'), label: 'Head to the Harbor Freight Docks' },
        { kind: 'rough', at: L('docks'), label: 'Rough up the debtors (0/3)', count: 3 },
        { kind: 'deliver', at: L('garage'), label: "Report back to Rico's Garage" },
      ],
    },
    {
      id: 'chapel-bells',
      title: 'Chapel Bells',
      giver: 'Rico',
      intro: "A wedding at St. Lucia needs a coupe with ribbons, and Mercy General's car park has one nobody will miss.",
      payout: 750,
      steps: [
        { kind: 'goto', at: L('hospital'), label: "Meet Rico's cousin at Mercy General Hospital" },
        { kind: 'steal', at: L('hospital'), label: 'Take the marked coupe from the hospital car park', carAt: { x: L('hospital').x + 66, y: L('hospital').y + 30 } },
        { kind: 'deliver', at: L('chapel'), label: 'Bring the coupe to St. Lucia Chapel', needsMissionCar: true },
      ],
    },
    {
      id: 'sunport-run',
      title: 'Sunport Run',
      giver: 'Lucia',
      intro: 'Cargo lands at Sunport after dark that the whole PPD will want. Move it fast.',
      payout: 900,
      steps: [
        { kind: 'pickup', at: L('airfield'), label: 'Collect the cargo at Sunport Airfield', forceStars: 3 },
        { kind: 'deliver', at: L('club'), label: 'Drop it at the Neon Palms Club' },
      ],
    },
    {
      id: 'mercy-run',
      title: 'Mercy Run',
      giver: 'Lucia',
      intro: 'A surgeon at Mercy General has a cooler that cannot wait for paperwork. Get it to the marina before it warms up.',
      payout: 1200,
      steps: [
        { kind: 'pickup', at: L('hospital'), label: 'Collect the cooler at Mercy General Hospital', heatOnDone: 'missionPickup' },
        { kind: 'deliver', at: L('marina'), label: 'Get it to the Marina & Yacht Club' },
      ],
    },
    {
      id: 'the-vice-run',
      title: 'The Vice Run',
      giver: 'Rico & Lucia',
      intro: 'One night, three cash bags, every light in Palmera watching. Then disappear.',
      payout: 1600,
      steps: [
        { kind: 'pickup', at: L('casino'), label: 'Take the bag at the Gilded Palm Casino', heatOnDone: 'missionPickup' },
        { kind: 'pickup', at: L('tower'), label: 'Take the bag at Vista Tower', heatOnDone: 'missionPickup' },
        { kind: 'pickup', at: L('mall'), label: 'Take the bag at Coral Mall', heatOnDone: 'missionPickup', forceStars: 3 },
        { kind: 'deliver', at: L('lighthouse'), label: 'Vanish to Lighthouse Point' },
      ],
    },
  ];
}

export function startStoryMission(g, index) {
  const def = g.storyDefs[index];
  if (!def) return;
  g.mission = { def, stepIndex: 0, targets: [], car: null, startedAt: g.time };
  const step = def.steps[0];
  activateStep(g, step);
  g.showBanner(def.title, def.intro, 4.6);
  g.dirtySave = true;
}

function activateStep(g, step) {
  if (step.kind === 'steal') {
    const type = CAR_TYPES[0];
    const car = makeCar(type, step.carAt.x, step.carAt.y, Math.PI / 2, '#f25cd6');
    car.missionCar = true;
    g.cars.push(car);
    g.mission.car = car;
  }
  if (step.kind === 'rough') {
    g.mission.targets = [];
    for (let i = 0; i < step.count; i++) {
      const ped = makePed(g.rng, step.at.x + randRange(g.rng, -70, 70), step.at.y + randRange(g.rng, -50, 50));
      ped.isTarget = true;
      ped.block = { bx: 0, by: 5, corner: i % 4 };
      g.peds.push(ped);
      g.mission.targets.push(ped);
    }
  }
}

function currentStep(g) {
  if (!g.mission) return null;
  return g.mission.def.steps[g.mission.stepIndex] ?? null;
}

function finishStep(g, step) {
  if (step.heatOnDone) reportCrime(g, step.heatOnDone, step.at.x, step.at.y);
  if (step.forceStars) {
    g.heat = Math.max(g.heat, 46);
    g.lastCrimeAt = g.time;
    g.lastCrimePos = { x: step.at.x, y: step.at.y };
  }
  g.sound.pickup();
  g.mission.stepIndex++;
  const next = currentStep(g);
  if (!next) {
    finishMission(g);
  } else {
    activateStep(g, next);
  }
}

function finishMission(g) {
  const def = g.mission.def;
  g.mission = null;
  g.money += def.payout;
  g.totalEarned += def.payout;
  g.sound.cash();
  g.sound.missionDone();
  g.storyIndex++;
  if (g.storyIndex >= g.storyDefs.length) {
    g.storyDone = true;
    g.showBanner('Story complete', 'Palmera is yours now. The errands keep paying, if you keep driving.', 6);
  } else {
    g.showBanner('Job done  +$' + def.payout, 'Next job starting: ' + g.storyDefs[g.storyIndex].title, 4);
    g.nextMissionAt = g.time + 3.5;
  }
  g.dirtySave = true;
}

// What the HUD and minimap point at: the story step first, then any live errand.
export function currentObjective(g) {
  const step = currentStep(g);
  if (step) {
    return { x: step.at.x, y: step.at.y, title: g.mission.def.title, label: stepLabel(g, step), color: '#ffd23d' };
  }
  if (g.errand) {
    const e = g.errand;
    if (e.state === 'offer') return { x: e.from.x, y: e.from.y, title: 'Errand', label: 'Pick up at ' + e.fromName, color: '#3de2d0' };
    return { x: e.to.x, y: e.to.y, title: 'Errand', label: 'Deliver to ' + e.toName + ' — ' + Math.max(0, Math.ceil(e.timeLeft)) + 's', color: '#3de2d0' };
  }
  return null;
}

function stepLabel(g, step) {
  if (step.kind === 'rough') {
    // A debtor counts once he is down: dead, or beaten to his knees and staying there.
    const left = g.mission.targets.filter((t) => t.state !== 'dead' && t.state !== 'roughed').length;
    const total = step.count;
    return 'Rough up the debtors (' + (total - left) + '/' + total + ')';
  }
  return step.label;
}

export function updateMissions(g, dt) {
  const p = g.player;

  // Chain the story: the next job starts itself a few seconds after the last one paid.
  if (!g.mission && !g.storyDone && g.nextMissionAt && g.time >= g.nextMissionAt) {
    g.nextMissionAt = 0;
    startStoryMission(g, g.storyIndex);
  }

  // A wrecked marked coupe is not the end of the job: the giver leaves a fresh one
  // where the first was parked, and the job rewinds to the steal.
  if (g.mission && g.mission.car && g.mission.car.wrecked && p.car !== g.mission.car) {
    const stealIndex = g.mission.def.steps.findIndex((s) => s.kind === 'steal');
    if (stealIndex >= 0 && g.mission.stepIndex >= stealIndex) {
      g.cars.splice(g.cars.indexOf(g.mission.car), 1);
      g.mission.car = null;
      g.mission.stepIndex = stealIndex;
      activateStep(g, g.mission.def.steps[stealIndex]);
      g.showBanner('The marked car is scrap', 'A fresh coupe waits where the first one was parked.', 3.6);
    }
  }

  const step = currentStep(g);
  if (step) {
    const d = dist(p.x, p.y, step.at.x, step.at.y);
    if (step.kind === 'goto' || step.kind === 'pickup') {
      if (d < 46) finishStep(g, step);
    } else if (step.kind === 'deliver') {
      const carOk = !step.needsMissionCar || p.car === g.mission.car;
      if (d < 58 && carOk) finishStep(g, step);
      else if (d < 58 && !carOk) g.promptText = 'You need the marked coupe for this drop.';
    } else if (step.kind === 'steal') {
      if (g.mission.car && p.car === g.mission.car) finishStep(g, step);
      else if (d < 90) g.promptText = 'The pink coupe. Take it.';
    } else if (step.kind === 'rough') {
      const left = g.mission.targets.filter((t) => t.state !== 'dead' && t.state !== 'roughed').length;
      if (left === 0) finishStep(g, step);
    }
  }

  updateErrand(g, dt);
}

// --- errands: the city's own repeatable work ----------------------------------------------

function offerErrand(g) {
  const spots = g.city.landmarks.filter((l) => l.id !== 'airfield' && l.id !== 'police');
  const from = pick(g.rng, spots);
  let to = pick(g.rng, spots);
  if (to === from) to = spots[(spots.indexOf(from) + 3) % spots.length];
  g.errand = {
    state: 'offer',
    from: from.point,
    fromName: from.name,
    to: to.point,
    toName: to.name,
    timeLeft: 0,
    payout: 0,
  };
}

function updateErrand(g, dt) {
  const p = g.player;
  if (!g.errand) {
    g.errandAt = g.errandAt ?? g.time + 6;
    if (g.time >= g.errandAt) offerErrand(g);
    return;
  }
  const e = g.errand;
  if (e.state === 'offer') {
    if (dist(p.x, p.y, e.from.x, e.from.y) < 46) {
      const d = dist(e.from.x, e.from.y, e.to.x, e.to.y);
      e.state = 'deliver';
      e.timeLeft = Math.round(d / 14) + 18;
      e.payout = Math.round(d / 11) + 45;
      g.sound.pickup();
      g.showBanner('Errand picked up', 'Get it to ' + e.toName + ' — $' + e.payout + ' on the dash.', 3);
    }
  } else if (e.state === 'deliver') {
    e.timeLeft -= dt;
    if (dist(p.x, p.y, e.to.x, e.to.y) < 58) {
      g.money += e.payout;
      g.totalEarned += e.payout;
      g.errandsDone++;
      g.sound.cash();
      g.showBanner('Errand done  +$' + e.payout, '', 2.6);
      g.errand = null;
      g.errandAt = g.time + 18;
      g.dirtySave = true;
    } else if (e.timeLeft <= 0) {
      g.showBanner('Errand lost', 'Too slow — the fare walked away.', 2.6);
      g.errand = null;
      g.errandAt = g.time + 14;
    }
  }
}
