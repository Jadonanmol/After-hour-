import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Sparkles, AlertCircle, ArrowLeft } from 'lucide-react';

interface CinematicPortalProps {
  roomCode: string;
  isJoining: boolean;
  isReady?: boolean;
  error?: string | null;
  onTraverseComplete: () => void;
  onCancel: () => void;
}

export const CinematicPortal: React.FC<CinematicPortalProps> = ({
  roomCode,
  isReady = true,
  error,
  onTraverseComplete,
  onCancel,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [phaseText, setPhaseText] = useState('Opening dimensional gateway...');
  const [hasTraversed, setHasTraversed] = useState(false);
  const isCancelledRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const isReadyRef = useRef(isReady);
  useEffect(() => {
    isReadyRef.current = isReady;
  }, [isReady]);

  const roomCodeRef = useRef(roomCode);
  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  const errorRef = useRef(error);
  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  const onTraverseCompleteRef = useRef(onTraverseComplete);
  useEffect(() => {
    onTraverseCompleteRef.current = onTraverseComplete;
  }, [onTraverseComplete]);

  // Check prefers-reduced-motion
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060d, 0.04);

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 1000);
    camera.position.set(0, 0, 16);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    // Check headless
    const isHeadless = typeof navigator !== 'undefined' && (/HeadlessChrome/i.test(navigator.userAgent) || navigator.webdriver);
    renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    // -------------------------------------------------------------------------
    // Portal Ring Geometry & Concentric Layers
    // -------------------------------------------------------------------------
    const portalGroup = new THREE.Group();
    scene.add(portalGroup);

    // Outer Energy Ring (Violet Emissive)
    const outerRingGeo = new THREE.TorusGeometry(3.6, 0.16, 24, 100);
    const outerRingMat = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x7c3aed,
      emissiveIntensity: 3.2,
      roughness: 0.15,
      metalness: 0.4,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    portalGroup.add(outerRing);

    // Inner Counter-Rotating Ring (Cyan Emissive)
    const innerRingGeo = new THREE.TorusGeometry(3.2, 0.1, 20, 90);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 2.6,
      roughness: 0.2,
      metalness: 0.4,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    portalGroup.add(innerRing);

    // Fine Accent Orbit Ring
    const accentRingGeo = new THREE.TorusGeometry(2.85, 0.045, 16, 80);
    const accentRingMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xc084fc,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });
    const accentRing = new THREE.Mesh(accentRingGeo, accentRingMat);
    portalGroup.add(accentRing);

    // Event Horizon Swirling Disc
    const horizonGeo = new THREE.RingGeometry(0.1, 3.15, 64);
    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0x3b0764,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const horizonMesh = new THREE.Mesh(horizonGeo, horizonMat);
    portalGroup.add(horizonMesh);

    // Glowing Core Center Aura
    const coreAuraGeo = new THREE.CircleGeometry(2.2, 48);
    const coreAuraMat = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const coreAuraMesh = new THREE.Mesh(coreAuraGeo, coreAuraMat);
    coreAuraMesh.position.z = -0.05;
    portalGroup.add(coreAuraMesh);

    // -------------------------------------------------------------------------
    // Particle Vortex (Spiral swirling into center)
    // -------------------------------------------------------------------------
    const particleCount = prefersReducedMotion ? 200 : 900;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleAngles = new Float32Array(particleCount);
    const particleRadii = new Float32Array(particleCount);
    const particleSpeeds = new Float32Array(particleCount);
    const particleZDrifts = new Float32Array(particleCount);

    const cViolet = new THREE.Color(0xa855f7);
    const cCyan = new THREE.Color(0x38bdf8);
    const cIndigo = new THREE.Color(0x6366f1);
    const tempColor = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.4 + Math.random() * 6.5;
      const angle = Math.random() * Math.PI * 2;
      const z = (Math.random() - 0.5) * 14;

      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = Math.sin(angle) * radius;
      particlePositions[i * 3 + 2] = z;

      particleAngles[i] = angle;
      particleRadii[i] = radius;
      particleSpeeds[i] = (0.4 + Math.random() * 0.8) * (1 / (radius * 0.4 + 1));
      particleZDrifts[i] = 1.0 + Math.random() * 2.5;

      // Color gradient by radius
      const t = Math.min(1, radius / 6.0);
      if (t < 0.5) {
        tempColor.copy(cCyan).lerp(cIndigo, t * 2);
      } else {
        tempColor.copy(cIndigo).lerp(cViolet, (t - 0.5) * 2);
      }
      particleColors[i * 3] = tempColor.r;
      particleColors[i * 3 + 1] = tempColor.g;
      particleColors[i * 3 + 2] = tempColor.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // -------------------------------------------------------------------------
    // Warp Starfield (Depth Streaks)
    // -------------------------------------------------------------------------
    const starCount = prefersReducedMotion ? 100 : 450;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 40;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      starPositions[i * 3 + 2] = -30 + Math.random() * 50;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0xc4b5fd,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);

    // -------------------------------------------------------------------------
    // Volumetric & Accent Lighting Rig
    // -------------------------------------------------------------------------
    const ambientLight = new THREE.AmbientLight(0x2e1065, 1.8);
    scene.add(ambientLight);

    const frontKeyLight = new THREE.DirectionalLight(0xd8b4fe, 2.8);
    frontKeyLight.position.set(0, 4, 14);
    scene.add(frontKeyLight);

    const frontFillLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    frontFillLight.position.set(0, -4, 10);
    scene.add(frontFillLight);

    const centerLight = new THREE.PointLight(0x818cf8, 4.5, 35);
    centerLight.position.set(0, 0, 0);
    scene.add(centerLight);

    const accentLight = new THREE.PointLight(0x06b6d4, 3.5, 25);
    accentLight.position.set(3, 2, 2);
    scene.add(accentLight);

    // -------------------------------------------------------------------------
    // Cinematic Animation Timeline
    // -------------------------------------------------------------------------
    const startTime = performance.now();
    let hasCompletedTraverse = false;

    // Initial portal state (opens up)
    portalGroup.scale.set(0.01, 0.01, 0.01);

    const animate = (time: number) => {
      if (isCancelledRef.current) return;

      const elapsed = (time - startTime) / 1000;

      // Handle error state: freeze forward travel and glow red/amber
      if (errorRef.current) {
        outerRingMat.color.setHex(0xef4444);
        outerRingMat.emissive.setHex(0xb91c1c);
        centerLight.color.setHex(0xef4444);
        frontKeyLight.color.setHex(0xef4444);
        renderer.render(scene, camera);
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      // Rotate portal layers
      outerRing.rotation.z += 0.012;
      innerRing.rotation.z -= 0.018;
      accentRing.rotation.x = Math.sin(elapsed * 1.5) * 0.2;
      accentRing.rotation.y = Math.cos(elapsed * 1.5) * 0.2;
      accentRing.rotation.z += 0.025;
      horizonMesh.rotation.z += 0.006;
      coreAuraMesh.rotation.z -= 0.01;

      // Animate swirling particles in spiral
      const posAttr = particleGeo.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        particleAngles[i] += particleSpeeds[i] * 0.04;
        // Inward vortex pull
        particleRadii[i] -= 0.008;
        if (particleRadii[i] < 0.2) {
          particleRadii[i] = 5.0 + Math.random() * 2.0;
        }

        positions[i * 3] = Math.cos(particleAngles[i]) * particleRadii[i];
        positions[i * 3 + 1] = Math.sin(particleAngles[i]) * particleRadii[i];
        // Move towards camera
        positions[i * 3 + 2] += particleZDrifts[i] * 0.06;
        if (positions[i * 3 + 2] > 18) {
          positions[i * 3 + 2] = -12;
        }
      }
      posAttr.needsUpdate = true;

      // Rotate and pulse light
      accentLight.position.x = Math.cos(elapsed * 2) * 4;
      accentLight.position.y = Math.sin(elapsed * 2) * 4;
      centerLight.intensity = 3.5 + Math.sin(elapsed * 6) * 1.5;

      // Timeline phases
      if (elapsed < 0.6) {
        // Phase 1: Portal Ring Opening
        const progress = Math.min(1, elapsed / 0.6);
        const easeOutBack = (x: number) => {
          const c1 = 1.70158;
          const c3 = c1 + 1;
          return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
        };
        const scale = Math.max(0.01, easeOutBack(progress));
        portalGroup.scale.set(scale, scale, scale);
        setPhaseText('Synchronizing quantum frequencies...');
      } else if (elapsed < 1.7) {
        // Phase 2: Camera Fly-Through / Warp Acceleration
        const flightTime = elapsed - 0.6;
        const flightDuration = 1.1;
        const t = Math.min(1, flightTime / flightDuration);

        // Smooth cubic ease-in acceleration into the portal
        const easeInCubic = t * t * t;
        camera.position.z = 16 - easeInCubic * 18.5; // fly from z=16 through ring at z=0 to z=-2.5
        camera.fov = 65 + t * 25; // Warp FOV effect
        camera.updateProjectionMatrix();

        setPhaseText(`Entering Hangout Space #${roomCodeRef.current}...`);
      } else {
        // Phase 3: Traversed through portal into room!
        if (isReadyRef.current) {
          if (!hasCompletedTraverse) {
            hasCompletedTraverse = true;
            setHasTraversed(true);
            onTraverseCompleteRef.current?.();
          }
        } else {
          camera.position.z = -2.5 + Math.sin(elapsed * 2) * 0.15;
          setPhaseText(`Connecting to Hangout Space #${roomCodeRef.current}...`);
        }
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle Window Resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || window.innerWidth;
      const newH = container.clientHeight || window.innerHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isCancelledRef.current = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener('resize', handleResize);

      // Clean disposal of Three.js objects
      outerRingGeo.dispose();
      outerRingMat.dispose();
      innerRingGeo.dispose();
      innerRingMat.dispose();
      accentRingGeo.dispose();
      accentRingMat.dispose();
      horizonGeo.dispose();
      horizonMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between transition-opacity duration-500 overflow-hidden select-none bg-[#05060d] ${
        hasTraversed ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Three.js Portal Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none" />

      {/* Top Header info */}
      <div className="relative z-10 w-full max-w-5xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-600/40 text-white font-black text-sm tracking-wider">
            AH
          </div>
          <div>
            <span className="font-black text-white text-sm tracking-widest block">AFTERHOURS</span>
            <span className="text-[10px] font-mono text-indigo-300">DIMENSIONAL GATEWAY</span>
          </div>
        </div>

        <button
          onClick={onCancel}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-lg backdrop-blur-md"
        >
          <ArrowLeft size={13} />
          <span>Cancel & Return</span>
        </button>
      </div>

      {/* Center Status / Portal Information */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-md my-auto">
        {error ? (
          <div className="p-6 rounded-3xl bg-red-950/80 border border-red-500/50 backdrop-blur-xl shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Gateway Connection Failed</h3>
            <p className="text-xs text-red-200 mb-5 leading-relaxed">{error}</p>
            <button
              onClick={onCancel}
              type="button"
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-red-600/30"
            >
              Try Another Room Code
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold tracking-widest shadow-xl backdrop-blur-md">
              <Sparkles size={13} className="text-indigo-400 animate-spin" />
              <span>ROOM #{roomCode}</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-lg">
              {phaseText}
            </h2>

            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Connecting persistent LiveKit audio/video & syncing real-time lounge state
            </p>
          </div>
        )}
      </div>

      {/* Bottom Subtle Ethereal Glow & Dimension Label */}
      <div className="relative z-10 pb-8 text-center">
        <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase">
          AFTERHOURS • Spatial Virtual Hangout
        </span>
      </div>
    </div>
  );
};
