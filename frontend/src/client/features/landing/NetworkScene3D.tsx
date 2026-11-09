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
    console.warn('NetworkScene3D encountered a WebGL error; gracefully rendering CSS constellation fallback:', error);
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
    <div className="pl-3d-fallback" aria-hidden="true">
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

    // Safely check dimensions
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    try {
      // Create canvas dynamically so it never has a pre-existing conflicting context
      const canvas = document.createElement('canvas');
      canvas.className = 'pl-3d-canvas';
      container.appendChild(canvas);

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'default'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x060b14, 0.032);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      camera.position.set(0, 0, 13);

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
      scene.add(ambientLight);

      const pointLight = new THREE.PointLight(0x34d399, 3.2, 25);
      pointLight.position.set(0, 0, 2);
      scene.add(pointLight);

      const goldLight = new THREE.DirectionalLight(0xd4af37, 1.4);
      goldLight.position.set(5, 6, 6);
      scene.add(goldLight);

      const rimLight = new THREE.DirectionalLight(0x34d399, 1.2);
      rimLight.position.set(-6, -4, -3);
      scene.add(rimLight);

      // Root cluster group
      const cluster = new THREE.Group();
      scene.add(cluster);

      // 1. Central Cryptographic Exchange Core (Torus Knot)
      const coreGeo = new THREE.TorusKnotGeometry(1.85, 0.42, 100, 24, 2, 3);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x168567,
        roughness: 0.3,
        metalness: 0.65,
        emissive: 0x10b981,
        emissiveIntensity: 0.5
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      cluster.add(coreMesh);

      // 2. Decentralized Network Nodes (Metallic Spheres)
      const nodeCount = 28;
      const nodePositions: THREE.Vector3[] = [];
      const nodeGroup = new THREE.Group();
      cluster.add(nodeGroup);

      const nodeGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const nodeMat = new THREE.MeshStandardMaterial({
        color: 0xf2cf66,
        metalness: 0.72,
        roughness: 0.25,
        emissive: 0x34d399,
        emissiveIntensity: 0.55
      });

      for (let i = 0; i < nodeCount; i++) {
        const phi = Math.acos(-1 + (2 * i) / nodeCount);
        const theta = Math.sqrt(nodeCount * Math.PI) * phi;
        const radius = 3.2 + (Math.sin(i * 1.5) * 0.9);

        const pos = new THREE.Vector3(
          radius * Math.cos(theta) * Math.sin(phi),
          radius * Math.sin(theta) * Math.sin(phi),
          radius * Math.cos(phi)
        );
        nodePositions.push(pos);

        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.position.copy(pos);
        nodeGroup.add(nodeMesh);
      }

      // 3. Connecting Network Edges
      const linePositions: number[] = [];
      const maxDistance = 2.4;

      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          const d = nodePositions[i].distanceTo(nodePositions[j]);
          if (d < maxDistance) {
            linePositions.push(
              nodePositions[i].x, nodePositions[i].y, nodePositions[i].z,
              nodePositions[j].x, nodePositions[j].y, nodePositions[j].z
            );
          }
        }
      }

      const linesGeo = new THREE.BufferGeometry();
      linesGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      const linesMat = new THREE.LineBasicMaterial({
        color: 0x6ee7b7,
        transparent: true,
        opacity: 0.42
      });
      const networkLines = new THREE.LineSegments(linesGeo, linesMat);
      cluster.add(networkLines);

      // 4. Ambient Data Particle Cloud
      const particleCount = 220;
      const particlePositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        particlePositions[i] = (Math.random() - 0.5) * 16;
        particlePositions[i + 1] = (Math.random() - 0.5) * 14;
        particlePositions[i + 2] = (Math.random() - 0.5) * 10;
      }

      const particlesGeo = new THREE.BufferGeometry();
      particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particlesMat = new THREE.PointsMaterial({
        color: 0x6ee7b7,
        size: 0.06,
        transparent: true,
        opacity: 0.72
      });
      const particleField = new THREE.Points(particlesGeo, particlesMat);
      scene.add(particleField);

      // Parallax tracking
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const onPointerMove = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
        targetX = x * 0.8;
        targetY = y * 0.6;
      };

      window.addEventListener('mousemove', onPointerMove, { passive: true });

      // Handle Resize
      const onResize = () => {
        if (!container || !renderer || !camera || isDisposed) return;
        const w = container.clientWidth || 300;
        const h = container.clientHeight || 300;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };

      const resizeObserver = new ResizeObserver(onResize);
      resizeObserver.observe(container);

      // Pause when scrolled offscreen
      let isVisible = true;
      const intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          isVisible = entry.isIntersecting;
        },
        { threshold: 0.05 }
      );
      intersectionObserver.observe(container);

      // Render loop
      const clock = new THREE.Clock();

      const animate = () => {
        if (isDisposed) return;
        animId = requestAnimationFrame(animate);
        if (!isVisible || !renderer) return;

        const delta = clock.getDelta();

        if (!reducedMotion) {
          coreMesh.rotation.x += delta * 0.22;
          coreMesh.rotation.y += delta * 0.35;

          nodeGroup.rotation.y += delta * 0.08;
          networkLines.rotation.y += delta * 0.08;
          particleField.rotation.y += delta * 0.02;

          mouseX += (targetX - mouseX) * 0.05;
          mouseY += (targetY - mouseY) * 0.05;

          cluster.rotation.y = mouseX * 0.45;
          cluster.rotation.x = -mouseY * 0.35;

          camera.position.x = mouseX * 1.2;
          camera.position.y = mouseY * 0.8;
          camera.lookAt(0, 0, 0);
        }

        renderer.render(scene, camera);
      };

      animate();

      return () => {
        isDisposed = true;
        cancelAnimationFrame(animId);
        window.removeEventListener('mousemove', onPointerMove);
        resizeObserver.disconnect();
        intersectionObserver.disconnect();

        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }

        coreGeo.dispose();
        coreMat.dispose();
        nodeGeo.dispose();
        nodeMat.dispose();
        linesGeo.dispose();
        linesMat.dispose();
        particlesGeo.dispose();
        particlesMat.dispose();
        if (renderer) renderer.dispose();
      };
    } catch (err) {
      console.warn('WebGL initialization failed, falling back to CSS animation:', err);
      setInitFailed(true);
    }
  }, []);

  if (initFailed) {
    return <FallbackConstellation />;
  }

  return <div ref={containerRef} className="pl-3d-scene-container" aria-hidden="true" />;
}

export function NetworkScene3D() {
  return (
    <NetworkSceneErrorBoundary fallback={<FallbackConstellation />}>
      <WebGLScene />
    </NetworkSceneErrorBoundary>
  );
}
