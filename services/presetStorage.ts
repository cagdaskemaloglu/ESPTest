/**
 * services/presetStorage.ts
 * Preset/sahne verileri — AsyncStorage'da saklanır.
 *
 * Efekt tipleri (10 adet):
 *   rainbow, breathe, wave, fire, meteor, twinkle, strobe, comet, theater, pulse
 *
 * Her efektin hız parametresi var: 0=yavaş, 128=normal, 255=hızlı
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export type EffectType =
  | 'rainbow' | 'breathe' | 'wave'   | 'fire'
  | 'meteor'  | 'twinkle' | 'strobe' | 'comet'
  | 'theater' | 'pulse';

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

// Her efektin açıklama metni — PresetsScreen'de gösterilir
export const EFFECT_META: Record<EffectType, { label: string; desc: string; hasColor: boolean }> = {
  rainbow: { label: 'Gökkuşağı',   desc: 'Tüm renkler döngüsel geçiş',       hasColor: false },
  breathe: { label: 'Nefes',       desc: 'Seçili renk yavaşça söner yanar',   hasColor: true  },
  wave:    { label: 'Dalga',       desc: 'Renk dalgası şeritten geçer',       hasColor: true  },
  fire:    { label: 'Ateş',        desc: 'Titreşen alev efekti',             hasColor: false },
  meteor:  { label: 'Meteor',      desc: 'Işık topu izi bırakarak geçer',    hasColor: true  },
  twinkle: { label: 'Yıldız',     desc: 'Rastgele yıldız parlaması',         hasColor: true  },
  strobe:  { label: 'Strobe',      desc: 'Hızlı stroboskop flash',           hasColor: true  },
  comet:   { label: 'Kuyruklu Y.', desc: 'Kuyruklu yıldız gidip gelir',      hasColor: true  },
  theater: { label: 'Marquee',     desc: 'Tiyatro ışıkları — her 3. LED',    hasColor: true  },
  pulse:   { label: 'Nabız',       desc: 'Tüm şerit birlikte nabız atar',    hasColor: true  },
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
  // Efektler
  { id: 'p_rainbow', name: 'Gökkuşağı', icon: '🌈', type: 'effect', effect: 'rainbow', effectSpeed: 128 },
  { id: 'p_breathe', name: 'Nefes',    icon: '🫧', type: 'effect', effect: 'breathe', effectR: 0,   effectG: 150, effectB: 255, effectSpeed: 80  },
  { id: 'p_wave',    name: 'Dalga',    icon: '🌊', type: 'effect', effect: 'wave',    effectR: 0,   effectG: 100, effectB: 255, effectSpeed: 128 },
  { id: 'p_fire',    name: 'Ateş',     icon: '🔥', type: 'effect', effect: 'fire',    effectSpeed: 180 },
  { id: 'p_meteor',  name: 'Meteor',   icon: '☄️', type: 'effect', effect: 'meteor',  effectR: 255, effectG: 255, effectB: 255, effectSpeed: 160 },
  { id: 'p_twinkle', name: 'Yıldız',  icon: '✨', type: 'effect', effect: 'twinkle', effectR: 255, effectG: 255, effectB: 200, effectSpeed: 100 },
  { id: 'p_strobe',  name: 'Strobe',   icon: '⚡', type: 'effect', effect: 'strobe',  effectR: 255, effectG: 255, effectB: 255, effectSpeed: 200 },
  { id: 'p_comet',   name: 'Kuyruklu', icon: '🌠', type: 'effect', effect: 'comet',   effectR: 100, effectG: 200, effectB: 255, effectSpeed: 150 },
  { id: 'p_theater', name: 'Marquee',  icon: '🎭', type: 'effect', effect: 'theater', effectR: 255, effectG: 200, effectB: 0,   effectSpeed: 100 },
  { id: 'p_pulse',   name: 'Nabız',    icon: '💜', type: 'effect', effect: 'pulse',   effectR: 150, effectG: 0,   effectB: 255, effectSpeed: 80  },
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