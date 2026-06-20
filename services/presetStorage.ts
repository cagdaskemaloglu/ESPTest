/**
 * services/presetStorage.ts
 * Preset/sahne verileri — AsyncStorage'da saklanır.
 *
 * Efekt tipleri (23 adet):
 *   rainbow, breathe, wave, fire, meteor, twinkle, strobe, comet, theater, pulse,
 *   colorCycle, gradient, wipe, bouncing, scanner, chase, ripple,
 *   sparkle, noise, larsonScanner, confetti, juggle, bpm
 *
 * Her efektin hız parametresi var: 0=yavaş, 128=normal, 255=hızlı
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type EffectType =
  | 'rainbow' | 'breathe' | 'wave'   | 'fire'
  | 'meteor'  | 'twinkle' | 'strobe' | 'comet'
  | 'theater' | 'pulse'
  | 'colorCycle' | 'gradient' | 'wipe'    | 'bouncing'
  | 'scanner'    | 'chase'    | 'ripple'  | 'sparkle'
  | 'noise'      | 'larsonScanner' | 'confetti' | 'juggle' | 'bpm';

export type Preset = {
  id:          string;
  name:        string;
  icon:        string;
  type:        'static' | 'effect';
  // static
  r?:          number;
  g?:          number;
  b?:          number;
  brightness?: number;
  // effect
  effect?:     EffectType;
  effectR?:    number;
  effectG?:    number;
  effectB?:    number;
  effectSpeed?: number;  // 0-255, varsayılan 128
};

export const EFFECT_META: Record<EffectType, { label: string; desc: string; hasColor: boolean }> = {
  // Mevcut efektler
  rainbow:      { label: 'Gökkuşağı',    desc: 'Tüm renkler döngüsel geçiş',         hasColor: false },
  breathe:      { label: 'Nefes',        desc: 'Seçili renk yavaşça söner yanar',     hasColor: true  },
  wave:         { label: 'Dalga',        desc: 'Renk dalgası şeritten geçer',         hasColor: true  },
  fire:         { label: 'Ateş',         desc: 'Titreşen alev efekti',               hasColor: false },
  meteor:       { label: 'Meteor',       desc: 'Işık topu izi bırakarak geçer',      hasColor: true  },
  twinkle:      { label: 'Yıldız',      desc: 'Rastgele yıldız parlaması',           hasColor: true  },
  strobe:       { label: 'Strobe',       desc: 'Hızlı stroboskop flash',             hasColor: true  },
  comet:        { label: 'Kuyruklu Y.', desc: 'Kuyruklu yıldız gidip gelir',         hasColor: true  },
  theater:      { label: 'Marquee',      desc: 'Tiyatro ışıkları — her 3. LED',      hasColor: true  },
  pulse:        { label: 'Nabız',        desc: 'Tüm şerit birlikte nabız atar',      hasColor: true  },
  // Yeni efektler
  colorCycle:   { label: 'Renk Döngüsü', desc: 'Tek renk yavaşça başka renge geçer', hasColor: false },
  gradient:     { label: 'Gradient',     desc: 'Ucundan ucuna renk geçişi',           hasColor: false },
  wipe:         { label: 'Silme',        desc: 'Renk bir uçtan diğerine süpürür',     hasColor: true  },
  bouncing:     { label: 'Sekme',        desc: 'Işık noktası ileri geri sekip durur', hasColor: true  },
  scanner:      { label: 'Tarama',       desc: 'Knight Rider tarzı sağa sola tarama', hasColor: true  },
  chase:        { label: 'Kovalama',     desc: 'Işık noktaları peş peşe koşar',      hasColor: true  },
  ripple:       { label: 'Dalgalanma',   desc: 'Ortadan kenarlara dalgalar yayılır',  hasColor: true  },
  sparkle:      { label: 'Işıltı',       desc: 'Rastgele tek piksel anında parlar',   hasColor: true  },
  noise:        { label: 'Bulut',        desc: 'Organik dalgalanan renk geçişi',      hasColor: false },
  larsonScanner:{ label: 'Larson',       desc: 'Yumuşak ışık tobu gidip gelir',       hasColor: true  },
  confetti:     { label: 'Konfeti',      desc: 'Rastgele renk patlamaları',           hasColor: false },
  juggle:       { label: 'Jonglör',      desc: 'Farklı hızlarda bağımsız toplar',     hasColor: false },
  bpm:          { label: 'BPM',          desc: 'Ritme senkron nabız atışı',           hasColor: false },
};

const STORAGE_KEY = 'torva_presets';

// ── Varsayılan presetler ──────────────────────────────────────────────────────
export const DEFAULT_PRESETS: Preset[] = [
  // Statik
  { id: 'p_white',   name: 'Beyaz',    icon: '💡', type: 'static', r: 255, g: 255, b: 255, brightness: 255 },
  { id: 'p_warm',    name: 'Sıcak',    icon: '🕯️', type: 'static', r: 255, g: 147, b: 41,  brightness: 200 },
  { id: 'p_night',   name: 'Gece',     icon: '🌙', type: 'static', r: 20,  g: 20,  b: 80,  brightness: 40  },
  { id: 'p_focus',   name: 'Odak',     icon: '🎯', type: 'static', r: 200, g: 230, b: 255, brightness: 255 },
  { id: 'p_red',     name: 'Kırmızı',  icon: '🔴', type: 'static', r: 255, g: 0,   b: 0,   brightness: 200 },
  { id: 'p_green',   name: 'Yeşil',    icon: '🟢', type: 'static', r: 0,   g: 255, b: 50,  brightness: 200 },
  // Mevcut efektler
  { id: 'p_rainbow',  name: 'Gökkuşağı',  icon: '🌈', type: 'effect', effect: 'rainbow',  effectSpeed: 128 },
  { id: 'p_breathe',  name: 'Nefes',      icon: '🫧', type: 'effect', effect: 'breathe',  effectR: 0,   effectG: 150, effectB: 255, effectSpeed: 80  },
  { id: 'p_wave',     name: 'Dalga',      icon: '🌊', type: 'effect', effect: 'wave',     effectR: 0,   effectG: 100, effectB: 255, effectSpeed: 128 },
  { id: 'p_fire',     name: 'Ateş',       icon: '🔥', type: 'effect', effect: 'fire',     effectSpeed: 180 },
  { id: 'p_meteor',   name: 'Meteor',     icon: '☄️', type: 'effect', effect: 'meteor',   effectR: 255, effectG: 255, effectB: 255, effectSpeed: 160 },
  { id: 'p_twinkle',  name: 'Yıldız',    icon: '✨', type: 'effect', effect: 'twinkle',  effectR: 255, effectG: 255, effectB: 200, effectSpeed: 100 },
  { id: 'p_strobe',   name: 'Strobe',     icon: '⚡', type: 'effect', effect: 'strobe',   effectR: 255, effectG: 255, effectB: 255, effectSpeed: 200 },
  { id: 'p_comet',    name: 'Kuyruklu',   icon: '🌠', type: 'effect', effect: 'comet',    effectR: 100, effectG: 200, effectB: 255, effectSpeed: 150 },
  { id: 'p_theater',  name: 'Marquee',    icon: '🎭', type: 'effect', effect: 'theater',  effectR: 255, effectG: 200, effectB: 0,   effectSpeed: 100 },
  { id: 'p_pulse',    name: 'Nabız',      icon: '💜', type: 'effect', effect: 'pulse',    effectR: 150, effectG: 0,   effectB: 255, effectSpeed: 80  },
  // Yeni efektler
  { id: 'p_colorCycle',    name: 'Renk Döngüsü', icon: '🎨', type: 'effect', effect: 'colorCycle',    effectSpeed: 100 },
  { id: 'p_gradient',      name: 'Gradient',     icon: '🌅', type: 'effect', effect: 'gradient',      effectSpeed: 80  },
  { id: 'p_wipe',          name: 'Silme',        icon: '🖌️', type: 'effect', effect: 'wipe',          effectR: 0,   effectG: 200, effectB: 255, effectSpeed: 150 },
  { id: 'p_bouncing',      name: 'Sekme',        icon: '🏀', type: 'effect', effect: 'bouncing',      effectR: 255, effectG: 100, effectB: 0,   effectSpeed: 160 },
  { id: 'p_scanner',       name: 'Tarama',       icon: '🔦', type: 'effect', effect: 'scanner',       effectR: 255, effectG: 0,   effectB: 0,   effectSpeed: 150 },
  { id: 'p_chase',         name: 'Kovalama',     icon: '🏃', type: 'effect', effect: 'chase',         effectR: 0,   effectG: 255, effectB: 100, effectSpeed: 160 },
  { id: 'p_ripple',        name: 'Dalgalanma',   icon: '💧', type: 'effect', effect: 'ripple',        effectR: 0,   effectG: 150, effectB: 255, effectSpeed: 128 },
  { id: 'p_sparkle',       name: 'Işıltı',       icon: '💫', type: 'effect', effect: 'sparkle',       effectR: 255, effectG: 255, effectB: 255, effectSpeed: 120 },
  { id: 'p_noise',         name: 'Bulut',        icon: '☁️', type: 'effect', effect: 'noise',         effectSpeed: 100 },
  { id: 'p_larsonScanner', name: 'Larson',       icon: '👁️', type: 'effect', effect: 'larsonScanner', effectR: 255, effectG: 0,   effectB: 0,   effectSpeed: 140 },
  { id: 'p_confetti',      name: 'Konfeti',      icon: '🎊', type: 'effect', effect: 'confetti',      effectSpeed: 100 },
  { id: 'p_juggle',        name: 'Jonglör',      icon: '🤹', type: 'effect', effect: 'juggle',        effectSpeed: 128 },
  { id: 'p_bpm',           name: 'BPM',          icon: '🥁', type: 'effect', effect: 'bpm',           effectSpeed: 128 },
];

export const DEFAULT_IDS = new Set(DEFAULT_PRESETS.map((p) => p.id));

export async function getPresets(): Promise<Preset[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRESETS;
    return JSON.parse(raw) as Preset[];
  } catch { return DEFAULT_PRESETS; }
}

export async function savePresets(presets: Preset[]): Promise<void> {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); }
  catch (e) { console.error('savePresets hata:', e); }
}

export async function addPreset(preset: Preset): Promise<void> {
  const current = await getPresets();
  await savePresets([...current, preset]);
}

export async function deletePreset(id: string): Promise<void> {
  const current = await getPresets();
  await savePresets(current.filter((p) => p.id !== id));
}

export async function applyPreset(ip: string, preset: Preset): Promise<void> {
  try {
    if (preset.type === 'static') {
      await fetch(`http://${ip}/led/color?r=${preset.r}&g=${preset.g}&b=${preset.b}`);
      await fetch(`http://${ip}/led/brightness?value=${preset.brightness ?? 255}`);
      await fetch(`http://${ip}/led/on`);
    } else {
      let url = `http://${ip}/effect?type=${preset.effect}`;
      if (preset.effectR !== undefined) url += `&r=${preset.effectR}&g=${preset.effectG}&b=${preset.effectB}`;
      if (preset.effectSpeed !== undefined) url += `&speed=${preset.effectSpeed}`;
      await fetch(url);
    }
  } catch (e) {
    console.error('applyPreset hata:', e);
    throw e;
  }
}