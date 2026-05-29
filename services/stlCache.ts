/**
 * services/stlCache.ts
 * STL geometrilerini uygulama seviyesinde cache'ler.
 * 
 * İlk yüklemede Asset.downloadAsync() + fetch + parse yapılır.
 * Sonraki çağrılarda cache'den direkt döner — anında.
 * 
 * Kullanım:
 *   const geo = await getGeometry('base01');
 */

import { Asset } from 'expo-asset';
import * as THREE from 'three';

// Tüm STL asset'leri
const STL_ASSET_MAP: Record<string, () => any> = {
  base01: () => require('../assets/models/base01.stl'),
  base02: () => require('../assets/models/base02.stl'),
  base03: () => require('../assets/models/base03.stl'),
  base04: () => require('../assets/models/base04.stl'),
  base05: () => require('../assets/models/base05.stl'),
  base06: () => require('../assets/models/base06.stl'),
  base07: () => require('../assets/models/base07.stl'),
  base08: () => require('../assets/models/base08.stl'),
  base09: () => require('../assets/models/base09.stl'),
  base10: () => require('../assets/models/base10.stl'),
  body01: () => require('../assets/models/body01.stl'),
  body02: () => require('../assets/models/body02.stl'),
  body03: () => require('../assets/models/body03.stl'),
  body04: () => require('../assets/models/body04.stl'),
  body05: () => require('../assets/models/body05.stl'),
  body06: () => require('../assets/models/body06.stl'),
  body07: () => require('../assets/models/body07.stl'),
  body08: () => require('../assets/models/body08.stl'),
  body09: () => require('../assets/models/body09.stl'),
  body10: () => require('../assets/models/body10.stl'),
  head01: () => require('../assets/models/head01.stl'),
  head02: () => require('../assets/models/head02.stl'),
  head03: () => require('../assets/models/head03.stl'),
  head04: () => require('../assets/models/head04.stl'),
  head05: () => require('../assets/models/head05.stl'),
  head06: () => require('../assets/models/head06.stl'),
  head07: () => require('../assets/models/head07.stl'),
  head08: () => require('../assets/models/head08.stl'),
  head09: () => require('../assets/models/head09.stl'),
  head10: () => require('../assets/models/head10.stl'),
};

// Geometry cache — key: part adı, value: parsed geometry
const geometryCache = new Map<string, THREE.BufferGeometry>();

// Yükleniyor olan promise'leri tut — aynı key için çift fetch engelleyen
const loadingPromises = new Map<string, Promise<THREE.BufferGeometry | null>>();

function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const dv       = new DataView(buffer);

  const numTris    = dv.getUint32(80, true);
  const expected   = 84 + numTris * 50;
  const isBinary   = buffer.byteLength === expected && numTris > 0;

  if (isBinary) {
    const vertices = new Float32Array(numTris * 9);
    const normals  = new Float32Array(numTris * 9);
    let offset = 84;

    for (let i = 0; i < numTris; i++) {
      const nx = dv.getFloat32(offset,     true);
      const ny = dv.getFloat32(offset + 4, true);
      const nz = dv.getFloat32(offset + 8, true);
      offset += 12;

      for (let v = 0; v < 3; v++) {
        const vi = i * 9 + v * 3;
        vertices[vi]     = dv.getFloat32(offset,     true);
        vertices[vi + 1] = dv.getFloat32(offset + 4, true);
        vertices[vi + 2] = dv.getFloat32(offset + 8, true);
        normals[vi]      = nx;
        normals[vi + 1]  = ny;
        normals[vi + 2]  = nz;
        offset += 12;
      }
      offset += 2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('normal',   new THREE.BufferAttribute(normals,  3));
  } else {
    const text  = new TextDecoder().decode(buffer);
    const verts: number[] = [];
    const norms: number[] = [];
    const vertRe   = /vertex\s+([\d.e+\-]+)\s+([\d.e+\-]+)\s+([\d.e+\-]+)/g;
    const normalRe = /facet normal\s+([\d.e+\-]+)\s+([\d.e+\-]+)\s+([\d.e+\-]+)/g;
    const normalList: [number, number, number][] = [];

    let nm: RegExpExecArray | null;
    while ((nm = normalRe.exec(text)) !== null) {
      normalList.push([parseFloat(nm[1]), parseFloat(nm[2]), parseFloat(nm[3])]);
    }

    let triIdx = 0;
    let vm: RegExpExecArray | null;
    while ((vm = vertRe.exec(text)) !== null) {
      verts.push(parseFloat(vm[1]), parseFloat(vm[2]), parseFloat(vm[3]));
      const ni = normalList[Math.floor(triIdx / 3)];
      norms.push(ni?.[0] ?? 0, ni?.[1] ?? 0, ni?.[2] ?? 1);
      triIdx++;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geometry.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(norms), 3));
  }

  geometry.computeVertexNormals();
  return geometry;
}

// Tek bir part'ı yükle ve cache'le
async function loadGeometry(key: string): Promise<THREE.BufferGeometry | null> {
  // Cache'de varsa direkt dön
  if (geometryCache.has(key)) {
    return geometryCache.get(key)!;
  }

  // Zaten yükleniyorsa aynı promise'i döndür
  if (loadingPromises.has(key)) {
    return loadingPromises.get(key)!;
  }

  const loader = STL_ASSET_MAP[key];
  if (!loader) {
    console.warn(`STL asset map'te yok: ${key}`);
    return null;
  }

  const promise = (async () => {
    try {
      const asset = Asset.fromModule(loader());
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('no localUri');

      const response = await fetch(asset.localUri);
      const buffer   = await response.arrayBuffer();
      const geometry = parseSTL(buffer);

      geometryCache.set(key, geometry);
      console.log(`✅ STL cache: ${key}`);
      return geometry;
    } catch (e) {
      console.warn(`STL yüklenemedi: ${key}`, e);
      return null;
    } finally {
      loadingPromises.delete(key);
    }
  })();

  loadingPromises.set(key, promise);
  return promise;
}

// Birden fazla part'ı paralel yükle
export async function preloadGeometries(keys: string[]): Promise<void> {
  const missing = keys.filter((k) => !geometryCache.has(k));
  if (missing.length === 0) return;

  console.log(`📦 STL preload: ${missing.join(', ')}`);
  await Promise.all(missing.map(loadGeometry));
}

// Cache'den geometry al (clone — her mesh kendi geometry'sine sahip olmalı)
export async function getGeometry(key: string): Promise<THREE.BufferGeometry | null> {
  const geo = await loadGeometry(key);
  return geo ? geo.clone() : null;
}

// Cache'de var mı?
export function isCached(key: string): boolean {
  return geometryCache.has(key);
}

// Tüm cache'i temizle (factory reset veya bellek baskısı için)
export function clearCache(): void {
  geometryCache.forEach((geo) => geo.dispose());
  geometryCache.clear();
}
