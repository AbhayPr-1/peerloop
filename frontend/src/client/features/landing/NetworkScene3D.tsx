import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class NetworkSceneErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('NetworkScene3D WebGL error; falling back:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function FallbackConstellation() {
  return (
    <div className="pl-3d-fallback fixed inset-0 pointer-events-none -z-10" aria-hidden="true">
      <div className="pl-fallback-core" />
    </div>
  );
}

function WebGLScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [initFailed, setInitFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animId = 0;
    let isDisposed = false;

    const getWidth = () => window.innerWidth || 800;
    const getHeight = () => window.innerHeight || 600;

    try {
      const canvas = document.createElement('canvas');
      canvas.className = 'pl-3d-canvas-full';
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '-1';
      container.appendChild(canvas);

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(getWidth(), getHeight());
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.35;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x060b14, 0.020);

      const isMobileInitial = getWidth() < 768;
      const camera = new THREE.PerspectiveCamera(
        isMobileInitial ? 52 : 45,
        getWidth() / getHeight(),
        0.1,
        100
      );
      camera.position.set(0, 3.5, isMobileInitial ? 9.5 : 11.5);

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // --- HIGH-CONTRAST CINEMATIC LIGHTING ---
      const ambientLight = new THREE.AmbientLight(0x0b1d3a, 0.8);
      scene.add(ambientLight);

      const heroLight = new THREE.PointLight(0x00f3ff, 5.0, 22);
      heroLight.position.set(2, 3.5, 4);
      scene.add(heroLight);

      const midLight = new THREE.PointLight(0x10b981, 4.2, 24);
      midLight.position.set(-3, -4.0, 4);
      scene.add(midLight);

      const lowerLight = new THREE.PointLight(0xf59e0b, 3.8, 24);
      lowerLight.position.set(3, -11.0, 4);
      scene.add(lowerLight);

      const specularRim = new THREE.DirectionalLight(0x38bdf8, 2.5);
      specularRim.position.set(6, 12, 10);
      scene.add(specularRim);

      // --- VERTICAL 3D BLOCKCHAIN SPINE WITH INTERLOCKING CHAIN LINKS ---
      const spineGroup = new THREE.Group();
      scene.add(spineGroup);

      // Spine spline curve running vertically down the entire landing page (Y: +5.0 down to -16.0)
      const spinePoints = [
        new THREE.Vector3(2.2, 4.8, -1.0),
        new THREE.Vector3(2.8, 2.5, -0.5),
        new THREE.Vector3(1.8, 0.2, 0.2),
        new THREE.Vector3(-1.8, -2.2, 0.0),
        new THREE.Vector3(-2.6, -4.8, -0.6),
        new THREE.Vector3(1.6, -7.2, -0.2),
        new THREE.Vector3(2.4, -9.8, 0.2),
        new THREE.Vector3(-1.6, -12.2, -0.4),
        new THREE.Vector3(0.0, -15.5, -0.8)
      ];

      const spineCurve = new THREE.CatmullRomCurve3(spinePoints, false, 'centripetal', 0.5);

      // 1. Multi-layered blockchain hypercube nodes along the spine
      // Circular chain/disc details intentionally removed to keep the cube-driven scene.

      // 2. 18 Multi-Layered Translucent Blockchain Hypercube Nodes
      interface SpineBlock {
        group: THREE.Group;
        outerFrame: THREE.LineSegments;
        glassMesh: THREE.Mesh;
        coreMesh: THREE.Mesh;
        basePos: THREE.Vector3;
        rotSpeedX: number;
        rotSpeedY: number;
        phase: number;
      }

      const spineBlocks: SpineBlock[] = [];
      const blockCount = 18;

      const outerBoxGeo = new THREE.BoxGeometry(1.05, 1.05, 1.05);
      const outerEdgesGeo = new THREE.EdgesGeometry(outerBoxGeo);
      const outerWireMat = new THREE.LineBasicMaterial({ color: 0x38bdf8 });

      const glassBoxGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x072746,
        metalness: 0.92,
        roughness: 0.1,
        transparent: true,
        opacity: 0.68,
        emissive: 0x059669,
        emissiveIntensity: 0.5,
        side: THREE.DoubleSide
      });

      const coreBoxGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0xd97706,
        emissiveIntensity: 0.9
      });

      for (let i = 0; i < blockCount; i++) {
        const u = i / (blockCount - 1);
        const point = spineCurve.getPoint(u);

        const blockGroup = new THREE.Group();
        blockGroup.position.copy(point);

        const outerFrame = new THREE.LineSegments(outerEdgesGeo, outerWireMat);
        const glassMesh = new THREE.Mesh(glassBoxGeo, glassMat);
        const coreMesh = new THREE.Mesh(coreBoxGeo, coreMat);

        blockGroup.add(outerFrame);
        blockGroup.add(glassMesh);
        blockGroup.add(coreMesh);
        spineGroup.add(blockGroup);

        spineBlocks.push({
          group: blockGroup,
          outerFrame,
          glassMesh,
          coreMesh,
          basePos: point.clone(),
          rotSpeedX: 0.25 + (i % 3) * 0.1,
          rotSpeedY: 0.35 + (i % 2) * 0.15,
          phase: i * 0.7
        });
      }

      // 3. Moving High-Luminance Data Packets along the chain
      const packetCount = 36;
      const packetPositions = new Float32Array(packetCount * 3);
      const packetGeo = new THREE.BufferGeometry();
      packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPositions, 3));
      const packetMat = new THREE.PointsMaterial({
        color: 0xf59e0b,
        size: 0.22,
        transparent: true,
        opacity: 0.95
      });
      const packetPoints = new THREE.Points(packetGeo, packetMat);
      spineGroup.add(packetPoints);

      const packetU = new Float32Array(packetCount);
      const packetSpeed = new Float32Array(packetCount);
      for (let p = 0; p < packetCount; p++) {
        packetU[p] = Math.random();
        packetSpeed[p] = 0.07 + Math.random() * 0.12;
      }

      // 4. Floating Ambient Particle Field
      const particleCount = 450;
      const particlePositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount; i++) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 18;
        particlePositions[i * 3 + 1] = 6.0 - Math.random() * 26.0;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0x6ee7b7,
        size: 0.065,
        transparent: true,
        opacity: 0.75
      });
      const particleCloud = new THREE.Points(particleGeo, particleMat);
      scene.add(particleCloud);

      // --- MOUSE & SCROLL STATE TRACKING ---
      let mouseX = 0;
      let mouseY = 0;
      let targetMouseX = 0;
      let targetMouseY = 0;

      let targetScrollFraction = 0;
      let currentScrollFraction = 0;

      const handleScroll = () => {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        targetScrollFraction = Math.max(0, Math.min(1, window.scrollY / maxScroll));
      };

      const handleMouseMove = (e: MouseEvent) => {
        targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
        targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
      handleScroll();
      currentScrollFraction = targetScrollFraction;

      const handleResize = () => {
        if (!renderer || !camera || isDisposed) return;
        const w = getWidth();
        const h = getHeight();
        const isMobile = w < 768;
        camera.aspect = w / h;
        camera.fov = isMobile ? 52 : 45;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      window.addEventListener('resize', handleResize);

      let isVisible = true;
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;
          if (isVisible && !document.hidden) {
            cancelAnimationFrame(animId);
            animate();
          }
          else cancelAnimationFrame(animId);
        },
        { threshold: 0.02 }
      );
      intersectionObserver.observe(container);

      // --- ANIMATION LOOP ---
      let lastTime = performance.now();
      let elapsedTime = 0;

      const animate = () => {
        if (isDisposed || document.hidden || !isVisible) return;
        if (!reducedMotion) animId = requestAnimationFrame(animate);
        if (!isVisible || !renderer) return;

        const now = performance.now();
        const delta = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;
        elapsedTime += delta;

        mouseX += (targetMouseX - mouseX) * 0.06;
        mouseY += (targetMouseY - mouseY) * 0.06;

        const scrollSmooth = 1 - Math.exp(-delta * 7.5);
        currentScrollFraction = THREE.MathUtils.lerp(currentScrollFraction, targetScrollFraction, scrollSmooth);

        if (!reducedMotion) {
          // Camera vertical tracking down the page
          const isMobile = getWidth() < 768;
          const startCamY = isMobile ? 3.0 : 3.5;
          const endCamY = -14.0;
          const targetCamY = THREE.MathUtils.lerp(startCamY, endCamY, currentScrollFraction);

          const startCamZ = isMobile ? 9.5 : 11.5;
          const targetCamZ = THREE.MathUtils.lerp(startCamZ, 12.5, currentScrollFraction);

          const parallaxX = mouseX * 0.65;
          const parallaxY = mouseY * 0.45;

          camera.position.x = parallaxX;
          camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY + parallaxY, scrollSmooth);
          camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, scrollSmooth);

          const targetLookY = THREE.MathUtils.lerp(startCamY - 0.5, endCamY - 1.0, currentScrollFraction);
          camera.lookAt(new THREE.Vector3(parallaxX * 0.3, targetLookY, 0));

          // Animate hypercube blocks along the spine
          spineBlocks.forEach((block, idx) => {
            block.group.rotation.x = elapsedTime * block.rotSpeedX;
            block.group.rotation.y = elapsedTime * block.rotSpeedY;

            const floatOffset = Math.sin(elapsedTime * 2.2 + block.phase) * 0.16;
            block.group.position.x = block.basePos.x + Math.cos(elapsedTime * 1.5 + idx) * 0.12;
            block.group.position.y = block.basePos.y + floatOffset;

            const corePulse = 1 + Math.sin(elapsedTime * 3.8 + idx) * 0.2;
            block.coreMesh.scale.set(corePulse, corePulse, corePulse);
          });

          // Move Data Packets along the spine
          const pArray = packetGeo.getAttribute('position').array as Float32Array;
          for (let p = 0; p < packetCount; p++) {
            packetU[p] = (packetU[p] + delta * packetSpeed[p]) % 1.0;
            const pt = spineCurve.getPoint(packetU[p]);
            pArray[p * 3] = pt.x;
            pArray[p * 3 + 1] = pt.y;
            pArray[p * 3 + 2] = pt.z;
          }
          (packetGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

          particleCloud.rotation.y = elapsedTime * 0.02;
        }

        renderer.render(scene, camera);
      };

      const handleVisibilityChange = () => {
        if (document.hidden) cancelAnimationFrame(animId);
        else animate();
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      animate();

      return () => {
        isDisposed = true;
        cancelAnimationFrame(animId);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        intersectionObserver.disconnect();

        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }

        outerBoxGeo.dispose();
        outerEdgesGeo.dispose();
        outerWireMat.dispose();
        glassBoxGeo.dispose();
        glassMat.dispose();
        coreBoxGeo.dispose();
        coreMat.dispose();
        packetGeo.dispose();
        packetMat.dispose();
        particleGeo.dispose();
        particleMat.dispose();
        if (renderer) renderer.dispose();
      };
    } catch (err) {
      console.warn('WebGL initialization failed, falling back:', err);
      setInitFailed(true);
    }
  }, []);

if (initFailed) {
    return <FallbackConstellation />;
  }

  return <div ref={containerRef} className="pl-3d-scene-container-contained" aria-hidden="true" />;
}

export function NetworkScene3D() {
  return (
    <NetworkSceneErrorBoundary fallback={<FallbackConstellation />}>
      <WebGLScene />
    </NetworkSceneErrorBoundary>
  );
}
