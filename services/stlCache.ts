/**
   * services/stlCache.ts
   * Hybrid STL geometry cache:
   *
   * 1. Bundle içi  → assets/models/{key}.stl (hızlı, offline)
   * 2. Disk cache  → FileSystem.documentDirectory/models/{key}.stl
   * 3. Remote      → https://torva-atelier.vercel.app/parts/stl/{key}.stl
   *
   * Akış:
   *   Bundle'da var mı? → Evet: bundle'dan yükle
   *   Bundle'da yok → Disk cache'de var mı? → Evet: diskten oku
   *   Disk cache yok → Vercel'den indir → diske kaydet → memory'e al
   */

  import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as THREE from 'three';

  // ── Remote URL ────────────────────────────────────────────────────────────────
  const REMOTE_BASE_URL = 'https://www.ambiencebureau.com/parts/stl';

  // ── Disk cache klasörü ────────────────────────────────────────────────────────
  const CACHE_DIR = `${FileSystem.documentDirectory ?? ''}models/`;

  // ── Bundle içi STL map ────────────────────────────────────────────────────────
  // Sadece uygulama içinde paketlenen partlar — yeni partlar remote'dan gelir
  const BUNDLE_ASSET_MAP: Record<string, () => any> = {
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

  // ── Memory cache ──────────────────────────────────────────────────────────────
  const geometryCache  = new Map<string, THREE.BufferGeometry>();
  const loadingPromises = new Map<string, Promise<THREE.BufferGeometry | null>>();

  // ── STL Parser ────────────────────────────────────────────────────────────────
  function parseSTL(buffer: ArrayBuffer): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const dv       = new DataView(buffer);

    const numTris  = dv.getUint32(80, true);
    const expected = 84 + numTris * 50;
    const isBinary = buffer.byteLength === expected && numTris > 0;

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
      const text     = new TextDecoder().decode(buffer);
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

  // ── Disk cache klasörünü başlat ───────────────────────────────────────────────
  async function ensureCacheDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  }

  // ── Buffer'dan geometry oluştur ───────────────────────────────────────────────
  async function bufferFromUri(uri: string): Promise<ArrayBuffer> {
    const response = await fetch(uri);
    return response.arrayBuffer();
  }

  // ── Bundle'dan yükle ──────────────────────────────────────────────────────────
  async function loadFromBundle(key: string): Promise<THREE.BufferGeometry | null> {
    const loader = BUNDLE_ASSET_MAP[key];
    if (!loader) return null;

    try {
      const asset = Asset.fromModule(loader());
      await asset.downloadAsync();
      if (!asset.localUri) return null;

      const buffer   = await bufferFromUri(asset.localUri);
      const geometry = parseSTL(buffer);
      console.log(`📦 Bundle: ${key}`);
      return geometry;
    } catch (e) {
      console.warn(`Bundle yüklenemedi: ${key}`, e);
      return null;
    }
  }

  // ── Disk cache'den oku ────────────────────────────────────────────────────────
  async function loadFromDisk(key: string): Promise<THREE.BufferGeometry | null> {
    const path = `${CACHE_DIR}${key}.stl`;
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return null;

      const buffer   = await bufferFromUri(path);
      const geometry = parseSTL(buffer);
      console.log(`💾 Disk cache: ${key}`);
      return geometry;
    } catch {
      return null;
    }
  }

  // ── Remote'dan indir, diske kaydet ────────────────────────────────────────────
  async function loadFromRemote(key: string): Promise<THREE.BufferGeometry | null> {
    const url      = `${REMOTE_BASE_URL}/${key}.stl`;
    const diskPath = `${CACHE_DIR}${key}.stl`;

    try {
      await ensureCacheDir();

      console.log(`🌐 Remote indiriliyor: ${key}`);

      // Vercel'den diske indir
      const result = await FileSystem.downloadAsync(url, diskPath);

      if (result.status !== 200) {
        console.warn(`Remote 404/hata: ${key} (${result.status})`);
        return null;
      }

      // Diskten oku ve parse et
      const buffer   = await bufferFromUri(result.uri);
      const geometry = parseSTL(buffer);
      console.log(`✅ Remote indirildi: ${key}`);
      return geometry;
    } catch (e) {
      console.warn(`Remote yüklenemedi: ${key}`, e);
      // İndirme başarısız olduysa yarım dosyayı sil
      try { await FileSystem.deleteAsync(diskPath, { idempotent: true }); } catch {}
      return null;
    }
  }

  // ── Ana yükleme fonksiyonu ────────────────────────────────────────────────────
  async function loadGeometry(key: string): Promise<THREE.BufferGeometry | null> {
    // 1. Memory cache
    if (geometryCache.has(key)) return geometryCache.get(key)!;

    // 2. Aynı key zaten yükleniyorsa bekle
    if (loadingPromises.has(key)) return loadingPromises.get(key)!;

    const promise = (async () => {
      try {
        // 3. Bundle içi
        let geometry = await loadFromBundle(key);

        // 4. Disk cache
        if (!geometry) geometry = await loadFromDisk(key);

        // 5. Remote (Vercel)
        if (!geometry) geometry = await loadFromRemote(key);

        if (geometry) {
          geometryCache.set(key, geometry);
          return geometry;
        }

        console.warn(`STL hiçbir kaynakta bulunamadı: ${key}`);
        return null;
      } finally {
        loadingPromises.delete(key);
      }
    })();

    loadingPromises.set(key, promise);
    return promise;
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  // Birden fazla part'ı paralel preload
  export async function preloadGeometries(keys: string[]): Promise<void> {
    const missing = keys.filter((k) => !geometryCache.has(k));
    if (missing.length === 0) return;

    console.log(`🔄 Preload: [${missing.join(', ')}]`);
    await Promise.all(missing.map(loadGeometry));
    console.log(`✅ Preload tamamlandı`);
  }

  // Geometry al (clone — her mesh bağımsız)
  export async function getGeometry(key: string): Promise<THREE.BufferGeometry | null> {
    const geo = await loadGeometry(key);
    return geo ? geo.clone() : null;
  }

  // Cache'de var mı?
  export function isCached(key: string): boolean {
    return geometryCache.has(key);
  }

  // Remote cache'i temizle (sadece disk, bundle dokunulmaz)
  export async function clearRemoteCache(): Promise<void> {
    try {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      // Memory'den sadece bundle dışı olanları sil
      geometryCache.forEach((_, key) => {
        if (!BUNDLE_ASSET_MAP[key]) geometryCache.delete(key);
      });
      console.log('🗑 Remote cache temizlendi');
    } catch (e) {
      console.warn('Cache temizleme hatası:', e);
    }
  }

  // Tüm memory cache'i temizle
  export function clearMemoryCache(): void {
    geometryCache.forEach((geo) => geo.dispose());
    geometryCache.clear();
  }