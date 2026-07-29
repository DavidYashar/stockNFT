/**
 * SceneManager — Three.js WebGL background for stockNFT
 * Creates an asymptotic node network (connecting dots with lines)
 * in brand colors.
 * Follows workspace conventions: ESM, delta time, capped pixel ratio, ACESFilmicToneMapping.
 */

import * as THREE from 'three';

export class SceneManager {
  constructor(containerId = 'webgl-bg') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.warn(`SceneManager: container #${containerId} not found`);
      return;
    }

    // State
    this.clock = new THREE.Clock();
    this.mouse = new THREE.Vector2(0, 0);
    this.mouseWorld = new THREE.Vector3(0, 0, 0);
    this.scrollY = 0;
    this.targetScrollY = 0;

    // Collections for cleanup
    this.nodePoints = null;       // THREE.Points for dots
    this.nodeLines = null;        // THREE.LineSegments for connecting lines
    this.nodeData = [];           // Per-node drift/physics data
    this.animationId = null;

    // Config
    this.nodeCount = 150;
    this.connectDist = 1.8;       // Max distance to draw a line
    this.nodeBounds = { x: 7, y: 5, z: 4 }; // Distribution volume

    this.init();
  }

  init() {
    // --- Renderer ---
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.container.appendChild(this.renderer.domElement);

    // --- Scene ---
    this.scene = new THREE.Scene();

    // --- Camera ---
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 8);

    // --- Node Network Graph (connecting dots with lines) ---
    this.createNodeNetwork();

    // --- Events ---
    this.bindEvents();

    // --- Start Loop ---
    this.animate();
  }

  /* ================================================================
     NODE NETWORK GRAPH
     Dots that drift slowly; lines appear between nearby nodes.
     Line opacity = 1 - (distance / connectDist), giving an
     asymptotic fade-in/fade-out as nodes approach/separate.
     ================================================================ */
  createNodeNetwork() {
    const count = this.nodeCount;
    const { x: bx, y: by, z: bz } = this.nodeBounds;

    // Brand colors
    const cPrimary = new THREE.Color('#80C020');   // stockNFT green
    const cRhGreen = new THREE.Color('#CCFF00');   // Robinhood neon
    const cAccent = new THREE.Color('#A0C040');    // yellow-green

    // ---- Node Dots (Points) ----
    const dotPositions = new Float32Array(count * 3);
    const dotColors = new Float32Array(count * 3);
    const dotSizes = new Float32Array(count);

    this.nodeData = [];

    for (let i = 0; i < count; i++) {
      // Random position within bounds
      const px = (Math.random() - 0.5) * bx;
      const py = (Math.random() - 0.5) * by;
      const pz = (Math.random() - 0.5) * bz;

      dotPositions[i * 3] = px;
      dotPositions[i * 3 + 1] = py;
      dotPositions[i * 3 + 2] = pz;

      // Color: mix based on depth (z-position)
      const t = (pz + bz / 2) / bz; // 0 = front, 1 = back
      const col = cPrimary.clone().lerp(cRhGreen, t);
      col.r += (Math.random() - 0.5) * 0.08;
      col.g += (Math.random() - 0.5) * 0.08;

      dotColors[i * 3] = col.r;
      dotColors[i * 3 + 1] = col.g;
      dotColors[i * 3 + 2] = col.b;

      // Size variation
      dotSizes[i] = 0.02 + Math.random() * 0.05;

      // Drift data for animation
      this.nodeData.push({
        baseX: px,
        baseY: py,
        baseZ: pz,
        driftAmpX: 0.1 + Math.random() * 0.5,
        driftAmpY: 0.1 + Math.random() * 0.5,
        driftAmpZ: 0.1 + Math.random() * 0.3,
        driftFreqX: 0.3 + Math.random() * 0.7,
        driftFreqY: 0.3 + Math.random() * 0.7,
        driftFreqZ: 0.2 + Math.random() * 0.5,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        phaseZ: Math.random() * Math.PI * 2,
      });
    }

    const dotGeom = new THREE.BufferGeometry();
    dotGeom.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));
    dotGeom.setAttribute('color', new THREE.BufferAttribute(dotColors, 3));
    dotGeom.setAttribute('size', new THREE.BufferAttribute(dotSizes, 1));

    // Glow dot texture
    const dotCanvas = document.createElement('canvas');
    dotCanvas.width = 32;
    dotCanvas.height = 32;
    const dctx = dotCanvas.getContext('2d');
    const dgrad = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    dgrad.addColorStop(0, 'rgba(255,255,255,1)');
    dgrad.addColorStop(0.15, 'rgba(255,255,255,0.9)');
    dgrad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
    dgrad.addColorStop(1, 'rgba(255,255,255,0)');
    dctx.fillStyle = dgrad;
    dctx.fillRect(0, 0, 32, 32);
    const dotTex = new THREE.CanvasTexture(dotCanvas);

    const dotMat = new THREE.PointsMaterial({
      size: 0.06,
      map: dotTex,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
    });

    this.nodePoints = new THREE.Points(dotGeom, dotMat);
    this.scene.add(this.nodePoints);

    // ---- Connecting Lines (LineSegments) ----
    // Pre-allocate max possible lines (every pair could connect)
    const maxLines = (count * (count - 1)) / 2;
    const linePositionsArr = new Float32Array(maxLines * 6); // 2 vertices * 3
    const lineColorsArr = new Float32Array(maxLines * 6);

    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositionsArr, 3));
    lineGeom.setAttribute('color', new THREE.BufferAttribute(lineColorsArr, 3));
    lineGeom.setDrawRange(0, 0); // Start with no lines drawn

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.6,
      linewidth: 1,
    });

    this.nodeLines = new THREE.LineSegments(lineGeom, lineMat);
    this.scene.add(this.nodeLines);
  }

  /**
   * Update line geometry each frame based on pairwise distances.
   * Only draws lines between nodes closer than connectDist.
   * Line color alpha fades with distance (asymptotic).
   */
  updateNodeLines(elapsed) {
    const posAttr = this.nodePoints.geometry.getAttribute('position');
    const linePosAttr = this.nodeLines.geometry.getAttribute('position');
    const lineColAttr = this.nodeLines.geometry.getAttribute('color');

    const positions = posAttr.array;
    const linePos = linePosAttr.array;
    const lineCol = lineColAttr.array;
    const count = this.nodeCount;
    const threshold = this.connectDist;

    const cLineNear = new THREE.Color('#CCFF00');  // Robinhood neon for close nodes
    const cLineFar = new THREE.Color('#80C020');   // stockNFT green for distant nodes

    let lineIdx = 0;

    for (let i = 0; i < count; i++) {
      const ix = positions[i * 3];
      const iy = positions[i * 3 + 1];
      const iz = positions[i * 3 + 2];

      for (let j = i + 1; j < count; j++) {
        const jx = positions[j * 3];
        const jy = positions[j * 3 + 1];
        const jz = positions[j * 3 + 2];

        const dx = jx - ix;
        const dy = jy - iy;
        const dz = jz - iz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < threshold) {
          // Asymptotic opacity: 1 at dist=0, 0 at dist=threshold
          const t = 1 - (dist / threshold);
          // Use ease-out for smoother fade
          const alpha = t * t;

          const color = cLineNear.clone().lerp(cLineFar, 1 - t);

          // Vertex A (node i)
          const a = lineIdx * 6;
          linePos[a] = ix;
          linePos[a + 1] = iy;
          linePos[a + 2] = iz;
          lineCol[a] = color.r * alpha;
          lineCol[a + 1] = color.g * alpha;
          lineCol[a + 2] = color.b * alpha;

          // Vertex B (node j)
          const b = a + 3;
          linePos[b] = jx;
          linePos[b + 1] = jy;
          linePos[b + 2] = jz;
          lineCol[b] = color.r * alpha;
          lineCol[b + 1] = color.g * alpha;
          lineCol[b + 2] = color.b * alpha;

          lineIdx++;
        }
      }
    }

    // Update draw range and flag attributes as needing update
    this.nodeLines.geometry.setDrawRange(0, lineIdx * 2);
    linePosAttr.needsUpdate = true;
    lineColAttr.needsUpdate = true;
  }

  /**
   * Update node positions with slow sinusoidal drift + mouse repulsion.
   */
  updateNodeDrift(elapsed, delta) {
    const posAttr = this.nodePoints.geometry.getAttribute('position');
    const positions = posAttr.array;

    for (let i = 0; i < this.nodeCount; i++) {
      const nd = this.nodeData[i];

      // Sinusoidal drift around base position
      const dx = Math.sin(elapsed * nd.driftFreqX + nd.phaseX) * nd.driftAmpX;
      const dy = Math.cos(elapsed * nd.driftFreqY + nd.phaseY) * nd.driftAmpY;
      const dz = Math.sin(elapsed * nd.driftFreqZ + nd.phaseZ) * nd.driftAmpZ;

      let px = nd.baseX + dx;
      let py = nd.baseY + dy;
      let pz = nd.baseZ + dz;

      // Mouse interaction: nodes near cursor are gently repelled
      const mx = this.mouseWorld.x;
      const my = this.mouseWorld.y;
      const mdx = px - mx;
      const mdy = py - my;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      const mouseRadius = 1.5;

      if (mdist < mouseRadius && mdist > 0.001) {
        const force = (1 - mdist / mouseRadius) * 0.4;
        px += (mdx / mdist) * force;
        py += (mdy / mdist) * force;
      }

      positions[i * 3] = px;
      positions[i * 3 + 1] = py;
      positions[i * 3 + 2] = pz;
    }

    posAttr.needsUpdate = true;
  }

  /* ---- Events ---- */
  bindEvents() {
    this._onResize = this.onResize.bind(this);
    this._onMouseMove = this.onMouseMove.bind(this);
    this._onScroll = this.onScroll.bind(this);

    window.addEventListener('resize', this._onResize);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('scroll', this._onScroll, { passive: true });
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onMouseMove(event) {
    // Normalized device coords
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // World-space mouse for node repulsion (unproject near-plane point)
    const vec = new THREE.Vector3(this.mouse.x, this.mouse.y, 0.5);
    vec.unproject(this.camera);
    const dir = vec.sub(this.camera.position).normalize();
    const dist = -this.camera.position.z / dir.z;
    this.mouseWorld.copy(this.camera.position).add(dir.multiplyScalar(dist));
  }

  onScroll() {
    this.targetScrollY = window.scrollY;
  }

  /* ---- Animation Loop ---- */
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsed = this.clock.elapsedTime;

    // Smooth scroll follow
    this.scrollY += (this.targetScrollY - this.scrollY) * 0.05;

    // --- Node Network: drift nodes ---
    this.updateNodeDrift(elapsed, delta);

    // --- Node Network: update connecting lines ---
    this.updateNodeLines(elapsed);

    // --- Rotate entire node cloud slowly ---
    if (this.nodePoints) {
      this.nodePoints.rotation.y += delta * 0.03;
      this.nodePoints.rotation.x += delta * 0.01;
      this.nodePoints.position.y = -this.scrollY * 0.0003;
    }
    if (this.nodeLines) {
      this.nodeLines.rotation.y = this.nodePoints.rotation.y;
      this.nodeLines.rotation.x = this.nodePoints.rotation.x;
      this.nodeLines.position.y = this.nodePoints.position.y;
    }

    // --- Camera follows mouse subtly ---
    this.camera.position.x += (this.mouse.x * 1.5 - this.camera.position.x) * delta * 0.8;
    this.camera.position.y += (this.mouse.y * 0.8 - this.camera.position.y) * delta * 0.8;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  /* ---- Cleanup ---- */
  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    // Dispose node points
    if (this.nodePoints) {
      this.nodePoints.geometry.dispose();
      if (this.nodePoints.material.map) this.nodePoints.material.map.dispose();
      this.nodePoints.material.dispose();
      this.scene.remove(this.nodePoints);
    }

    // Dispose node lines
    if (this.nodeLines) {
      this.nodeLines.geometry.dispose();
      this.nodeLines.material.dispose();
      this.scene.remove(this.nodeLines);
    }

    // Remove event listeners
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('scroll', this._onScroll);

    // Dispose renderer
    this.renderer.dispose();
    this.renderer.forceContextLoss();

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    this.scene.clear();
  }
}
