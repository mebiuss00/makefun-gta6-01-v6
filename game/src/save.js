// save.js — the game remembers: money, story progress and lifetime earnings live in
// localStorage, so closing the tab mid-job loses nothing but the drive back.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: Number(data.money) || 0,
      storyIndex: Number(data.storyIndex) || 0,
      storyDone: Boolean(data.storyDone),
      errandsDone: Number(data.errandsDone) || 0,
      totalEarned: Number(data.totalEarned) || 0,
      muted: Boolean(data.muted),
    };
  } catch {
    return null; // a corrupt save is a fresh start, not a crash
  }
}

export function storeSave(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: g.money,
      storyIndex: g.storyIndex,
      storyDone: g.storyDone,
      errandsDone: g.errandsDone,
      totalEarned: g.totalEarned,
      muted: g.sound ? g.sound.muted : false,
    }));
  } catch {
    // Private mode and full storage both land here; the game plays on regardless.
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to wipe is a fine outcome too.
  }
}
