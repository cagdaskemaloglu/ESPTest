/**
 * components/Model3DViewer.tsx
 * stlCache servisi üzerinden geometry alır — anında render.
 * İlk yüklemede cache doluysa sıfır bekleme süresi.
 */

import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as THREE from 'three';
import { getGeometry, preloadGeometries } from '../services/stlCache';
import { Colors, Fonts } from '../theme/colors';
import { PartMaterial } from '../types/Device';

type Props = {
  parts:         string[];
  partMaterials: Record<string, PartMaterial>;
  isOn:          boolean;
  lightColor:    { r: number; g: number; b: number };
  width:         number;
  height:        number;
};

export default function Model3DViewer({
  parts,
  partMaterials,
  isOn,
  lightColor,
  width,
  height,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const frameRef    = useRef<number>(0);
  const groupRef    = useRef<THREE.Group | null>(null);
  const spotRef     = useRef<THREE.SpotLight | null>(null);
  const glowRef     = useRef<THREE.PointLight | null>(null);
  const meshesRef   = useRef<THREE.Mesh[]>([]);
  const isDragging  = useRef(false);
  const lastX       = useRef(0);
  const rotationY   = useRef(0);
  const glRef       = useRef<any>(null);
  const mountedRef  = useRef(true);
  const animatingRef = useRef(false);

  useEffect(() => {
    mountedRef.current  = true;
    animatingRef.current = false;

    if (parts.length > 0) {
      preloadGeometries(parts).catch(() => {});
    }

    return () => {
      // Unmount — render loop'u durdur
      mountedRef.current   = false;
      animatingRef.current = false;
      cancelAnimationFrame(frameRef.current);

      // Mesh'leri temizle
      meshesRef.current.forEach((m) => {
        m.geometry?.dispose();
        (m.material as THREE.Material)?.dispose();
      });
      meshesRef.current = [];

      // Renderer dispose
      try {
        rendererRef.current?.dispose?.();
      } catch {}
      rendererRef.current = null;
    };
  }, []);

  // Işık değişince güncelle
  useEffect(() => {
    const spot = spotRef.current;
    const glow = glowRef.current;
    if (!spot || !glow) return;
    const hex = (lightColor.r << 16) | (lightColor.g << 8) | lightColor.b;
    spot.color.setHex(hex);
    spot.intensity = isOn ? 80 : 0;
    glow.color.setHex(hex);
    glow.intensity = isOn ? 25 : 0;
  }, [isOn, lightColor]);

  const onContextCreate = async (gl: any) => {
    // Önceki loop varsa durdur
    animatingRef.current = false;
    cancelAnimationFrame(frameRef.current);
    glRef.current = gl;

    try {
      const renderer = new Renderer({ gl });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.shadowMap.enabled = true;
      rendererRef.current = renderer;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x070b14);
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        35, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 2000
      );
      camera.position.set(0, 120, 400);
      cameraRef.current = camera;

      // Işıklar
      scene.add(new THREE.AmbientLight(0xc8b89a, 0.6));
      scene.add(new THREE.HemisphereLight(0x4466aa, 0xc8a870, 0.9));
      const key = new THREE.DirectionalLight(0xfff5e6, 2.5);
      key.position.set(200, 400, 300);
      key.castShadow = true;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xa0b8c8, 0.8);
      fill.position.set(-200, 100, -200);
      scene.add(fill);

      // Lamba ışığı
      const spot = new THREE.SpotLight(0xffffff, 0);
      spot.angle    = Math.PI / 2.2;
      spot.penumbra = 0.4;
      spot.decay    = 0;
      spot.position.set(0, 600, 0);
      scene.add(spot);
      scene.add(spot.target);
      spotRef.current = spot;

      const glow = new THREE.PointLight(0xffffff, 0, 0);
      glow.position.set(0, 200, 50);
      scene.add(glow);
      glowRef.current = glow;

      // Grid
      const grid = new THREE.GridHelper(400, 16, 0x2a2a28, 0x1e1e1c);
      (grid.material as THREE.Material).opacity     = 0.5;
      (grid.material as THREE.Material).transparent = true;
      scene.add(grid);

      // Model group
      const group = new THREE.Group();
      scene.add(group);
      groupRef.current = group;

      // Geometry'leri cache'den al (preload sayesinde çoğu zaman hazır)
      await buildMeshes(parts, partMaterials, group, camera, spot, glow);

      if (!mountedRef.current) return;
      setLoading(false);

      // Başlangıç ışık durumu
      const hex = (lightColor.r << 16) | (lightColor.g << 8) | lightColor.b;
      spot.color.setHex(hex);
      spot.intensity = isOn ? 80 : 0;
      glow.color.setHex(hex);
      glow.intensity = isOn ? 25 : 0;

      // Render loop
      animatingRef.current = true;
      const animate = () => {
        if (!animatingRef.current || !mountedRef.current) return;
        frameRef.current = requestAnimationFrame(animate);
        try {
          if (!isDragging.current) rotationY.current += 0.004;
          group.rotation.y = rotationY.current;
          renderer.render(scene, camera);
          gl.endFrameEXP();
        } catch {
          // GL context kayboldu — dur
          animatingRef.current = false;
        }
      };
      animate();

    } catch (e: any) {
      console.error('Model3DViewer:', e);
      if (mountedRef.current) {
        setError('Model yüklenemedi');
        setLoading(false);
      }
    }
  };

  const buildMeshes = async (
    keys:      string[],
    materials: Record<string, PartMaterial>,
    group:     THREE.Group,
    camera:    THREE.PerspectiveCamera,
    spot:      THREE.SpotLight,
    glow:      THREE.PointLight,
  ) => {
    // Eski mesh'leri temizle
    meshesRef.current.forEach((m) => {
      m.geometry?.dispose();
      (m.material as THREE.Material)?.dispose();
      group.remove(m);
    });
    meshesRef.current = [];

    if (keys.length === 0) return;

    let currentY = 0;

    for (const key of keys) {
      const mat = materials[key] ?? { color: '#2a2a2a', roughness: 0.8, metalness: 0.1 };

      // Cache'den geometry al — clone ile her mesh bağımsız
      const geometry = await getGeometry(key);

      let mesh: THREE.Mesh;
      if (geometry) {
        const material = new THREE.MeshStandardMaterial({
          color:     new THREE.Color(mat.color),
          roughness: mat.roughness,
          metalness: mat.metalness,
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow    = true;
        mesh.receiveShadow = true;
      } else {
        // Fallback — wire kutu
        const geo = new THREE.BoxGeometry(60, 80, 60);
        const material = new THREE.MeshStandardMaterial({
          color:       new THREE.Color(mat.color),
          wireframe:   true,
          opacity:     0.3,
          transparent: true,
        });
        mesh = new THREE.Mesh(geo, material);
      }

      // Stack — Y ekseninde üst üste
      if (mesh.geometry.boundingBox === null) {
        mesh.geometry.computeBoundingBox();
      }
      const bbox   = mesh.geometry.boundingBox!;
      const size   = new THREE.Vector3();
      const center = new THREE.Vector3();
      bbox.getSize(size);
      bbox.getCenter(center);

      mesh.position.x = -center.x;
      mesh.position.z = -center.z;
      mesh.position.y = currentY - center.y + size.y / 2;
      currentY += size.y;

      group.add(mesh);
      meshesRef.current.push(mesh);
    }

    // Kamera fit
    if (meshesRef.current.length > 0) {
      const box    = new THREE.Box3().setFromObject(group);
      const size   = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov    = (camera.fov * Math.PI) / 180;
      const dist   = ((maxDim / 2) / Math.tan(fov / 2)) * 1.8;

      camera.position.set(center.x, center.y + size.y * 0.1, dist);
      camera.lookAt(center);

      spot.position.set(0, box.max.y + size.y * 2, 0);
      spot.target.position.set(0, center.y, 0);
      spot.target.updateMatrixWorld();
      glow.position.set(0, center.y, 0);
    }
  };

  if (parts.length === 0) {
    return (
      <View style={[styles.root, { width, height }]}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>3D MODEL</Text>
          <Text style={styles.emptySubText}>parts tanımlanmamış</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { width, height }]}>
      <View
        style={{ width, height }}
        onTouchStart={(e) => {
          isDragging.current = true;
          lastX.current = e.nativeEvent.locationX;
        }}
        onTouchMove={(e) => {
          if (!isDragging.current) return;
          const dx = e.nativeEvent.locationX - lastX.current;
          rotationY.current += dx * 0.01;
          lastX.current = e.nativeEvent.locationX;
        }}
        onTouchEnd={() => { isDragging.current = false; }}
      >
        <GLView style={{ width, height }} onContextCreate={onContextCreate} />
      </View>

      {loading && (
        <View style={styles.overlay}>
          <ActivityIndicator color={Colors.cyan} size="small" />
          <Text style={styles.loadingText}>MODEL YÜKLENİYOR</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.overlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#070b14',
    overflow: 'hidden',
  },
  emptyBox: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  emptyText: {
    fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 4, color: Colors.text3,
  },
  emptySubText: {
    fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 2, color: Colors.border2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,11,20,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  loadingText: {
    fontFamily: Fonts.mono, fontSize: 8, letterSpacing: 3, color: Colors.text3,
  },
  errorText: {
    fontFamily: Fonts.mono, fontSize: 10, letterSpacing: 2, color: Colors.red,
  },
});