'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Three.js WebGL background — node network with drifting dots and connecting lines.
 * Wrapped as a React component for Next.js. Disposes on unmount.
 */
export default function SceneBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── State ──
    const clock = new THREE.Clock();
    const mouse = new THREE.Vector2(0, 0);
    const mouseWorld = new THREE.Vector3(0, 0, 0);
    let scrollY = 0;
    let targetScrollY = 0;
    let animationId: number;
    const nodeCount = 150;
    const connectDist = 1.8;
    const nodeData: any[] = [];

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // ── Scene + Camera ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 8);

    // ── Nodes ──
    const bx = 7, by = 5, bz = 4;
    const cPrimary = new THREE.Color('#80C020');
    const cRhGreen = new THREE.Color('#CCFF00');
    const dotPositions = new Float32Array(nodeCount * 3);
    const dotColors = new Float32Array(nodeCount * 3);
    const dotSizes = new Float32Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
      const px = (Math.random() - 0.5) * bx;
      const py = (Math.random() - 0.5) * by;
      const pz = (Math.random() - 0.5) * bz;
      dotPositions[i * 3] = px;
      dotPositions[i * 3 + 1] = py;
      dotPositions[i * 3 + 2] = pz;
      const t = (pz + bz / 2) / bz;
      const col = cPrimary.clone().lerp(cRhGreen, t);
      col.r += (Math.random() - 0.5) * 0.08;
      col.g += (Math.random() - 0.5) * 0.08;
      dotColors[i * 3] = col.r;
      dotColors[i * 3 + 1] = col.g;
      dotColors[i * 3 + 2] = col.b;
      dotSizes[i] = 0.02 + Math.random() * 0.05;
      nodeData.push({ baseX: px, baseY: py, baseZ: pz, driftAmpX: 0.1 + Math.random() * 0.5, driftAmpY: 0.1 + Math.random() * 0.5, driftAmpZ: 0.1 + Math.random() * 0.3, driftFreqX: 0.3 + Math.random() * 0.7, driftFreqY: 0.3 + Math.random() * 0.7, driftFreqZ: 0.2 + Math.random() * 0.5, phaseX: Math.random() * Math.PI * 2, phaseY: Math.random() * Math.PI * 2, phaseZ: Math.random() * Math.PI * 2 });
    }

    const dotGeom = new THREE.BufferGeometry();
    dotGeom.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
    dotGeom.setAttribute('color', new THREE.BufferAttribute(dotColors, 3));
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 32; dotCanvas.height = 32;
    const dctx = dotCanvas.getContext('2d')!;
    const dgrad = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    dgrad.addColorStop(0, 'rgba(255,255,255,1)');
    dgrad.addColorStop(0.15, 'rgba(255,255,255,0.9)');
    dgrad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    dgrad.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = dgrad; dctx.fillRect(0, 0, 32, 32);
    const dotTex = new THREE.CanvasTexture(dotCanvas);

    const nodePoints = new THREE.Points(dotGeom, new THREE.PointsMaterial({ size: 0.06, map: dotTex, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    scene.add(nodePoints);

    // ── Lines ──
    const maxLines = (nodeCount * (nodeCount - 1)) / 2;
    const linePosArr = new Float32Array(maxLines * 6);
    const lineColArr = new Float32Array(maxLines * 6);
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePosArr, 3));
    lineGeom.setAttribute('color', new THREE.BufferAttribute(lineColArr, 3));
    lineGeom.setDrawRange(0, 0);
    const nodeLines = new THREE.LineSegments(lineGeom, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
    scene.add(nodeLines);

    // ── Animation helpers ──
    const updateLines = () => {
      const posAttr = nodePoints.geometry.getAttribute('position');
      const positions = posAttr.array as Float32Array;
      const count = nodeCount;
      const threshold = connectDist;
      const cNear = new THREE.Color('#CCFF00');
      const cFar = new THREE.Color('#80C020');
      let lineIdx = 0;
      for (let i = 0; i < count; i++) {
        const ix = positions[i * 3], iy = positions[i * 3 + 1], iz = positions[i * 3 + 2];
        for (let j = i + 1; j < count; j++) {
          const jx = positions[j * 3], jy = positions[j * 3 + 1], jz = positions[j * 3 + 2];
          const dx = jx - ix, dy = jy - iy, dz = jz - iz;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist < threshold) {
            const t = 1 - (dist / threshold);
            const alpha = t * t;
            const color = cNear.clone().lerp(cFar, 1 - t);
            const a = lineIdx * 6;
            linePosArr[a] = ix; linePosArr[a + 1] = iy; linePosArr[a + 2] = iz;
            lineColArr[a] = color.r * alpha; lineColArr[a + 1] = color.g * alpha; lineColArr[a + 2] = color.b * alpha;
            const b = a + 3;
            linePosArr[b] = jx; linePosArr[b + 1] = jy; linePosArr[b + 2] = jz;
            lineColArr[b] = color.r * alpha; lineColArr[b + 1] = color.g * alpha; lineColArr[b + 2] = color.b * alpha;
            lineIdx++;
          }
        }
      }
      nodeLines.geometry.setDrawRange(0, lineIdx * 2);
      (nodeLines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (nodeLines.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    };

    const updateDrift = (elapsed: number) => {
      const posAttr = nodePoints.geometry.getAttribute('position');
      const positions = posAttr.array as Float32Array;
      for (let i = 0; i < nodeCount; i++) {
        const nd = nodeData[i];
        const dx = Math.sin(elapsed * nd.driftFreqX + nd.phaseX) * nd.driftAmpX;
        const dy = Math.cos(elapsed * nd.driftFreqY + nd.phaseY) * nd.driftAmpY;
        const dz = Math.sin(elapsed * nd.driftFreqZ + nd.phaseZ) * nd.driftAmpZ;
        let px = nd.baseX + dx, py = nd.baseY + dy, pz = nd.baseZ + dz;
        const mx = mouseWorld.x, my = mouseWorld.y;
        const mdx = px - mx, mdy = py - my;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 1.5 && mdist > 0.001) {
          const force = (1 - mdist / 1.5) * 0.4;
          px += (mdx / mdist) * force; py += (mdy / mdist) * force;
        }
        positions[i * 3] = px; positions[i * 3 + 1] = py; positions[i * 3 + 2] = pz;
      }
      (posAttr as THREE.BufferAttribute).needsUpdate = true;
    };

    // ── Events ──
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    const onMouse = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      const vec = new THREE.Vector3(mouse.x, mouse.y, 0.5);
      vec.unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const dist = -camera.position.z / dir.z;
      mouseWorld.copy(camera.position).add(dir.multiplyScalar(dist));
    };
    const onScroll = () => { targetScrollY = window.scrollY; };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('scroll', onScroll, { passive: true });

    // ── Loop ──
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.elapsedTime;
      scrollY += (targetScrollY - scrollY) * 0.05;
      updateDrift(elapsed);
      updateLines();
      nodePoints.rotation.y += delta * 0.03;
      nodePoints.rotation.x += delta * 0.01;
      nodePoints.position.y = -scrollY * 0.0003;
      nodeLines.rotation.y = nodePoints.rotation.y;
      nodeLines.rotation.x = nodePoints.rotation.x;
      nodeLines.position.y = nodePoints.position.y;
      camera.position.x += (mouse.x * 0.3 - camera.position.x) * 0.02;
      camera.position.y += (-mouse.y * 0.2 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll);
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} id="webgl-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />;
}
