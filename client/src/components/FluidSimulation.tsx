import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * FluidSimulation Component
 * 
 * Design Philosophy: Organic Minimalism with Digital Fluidity
 * - Three.js WebGL-based fluid simulation
 * - Gyroscope sensor integration (DeviceOrientation API)
 * - Physics-based particle dynamics
 * - High-end visual rendering with custom shaders
 */

interface FluidSimulationProps {
  onReady?: () => void;
}

export const FluidSimulation: React.FC<FluidSimulationProps> = ({ onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const gyroRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const velocityRef = useRef<Float32Array | null>(null);
  const [gyroPermission, setGyroPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  // Vertex Shader
  const vertexShader = `
    attribute float size;
    attribute float life;
    
    varying float vLife;
    varying float vSize;
    
    void main() {
      vLife = life;
      vSize = size;
      
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  // Fragment Shader - Creates smooth, glowing particles
  const fragmentShader = `
    varying float vLife;
    varying float vSize;
    
    void main() {
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      
      if (dist > 0.5) discard;
      
      // Smooth circle with soft edge
      float alpha = (1.0 - dist * 2.0) * vLife;
      alpha *= smoothstep(0.5, 0.0, dist);

      // Deep blue liquid - dark & saturated for clear contrast on light beige bg
      gl_FragColor = vec4(0.04, 0.18, 0.45, alpha);
    }
  `;

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f1ed); // Warm beige
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 100;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create particle system
    const particleCount = 12000;
    const geometry = new THREE.BufferGeometry();
    
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    const lives = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

      velocities[i * 3] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 1;

      sizes[i] = Math.random() * 4 + 2;
      lives[i] = 1.0;
    }

    velocityRef.current = velocities;

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('life', new THREE.BufferAttribute(lives, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particlesRef.current = particles;

    // Request gyroscope permission (iOS 13+)
    const requestGyroPermission = async () => {
      setGyroPermission('requesting');
      try {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission === 'granted') {
            setGyroPermission('granted');
            window.addEventListener('deviceorientation', handleDeviceOrientation);
          } else {
            setGyroPermission('denied');
          }
        } else {
          // Non-iOS or older browsers
          setGyroPermission('granted');
          window.addEventListener('deviceorientation', handleDeviceOrientation);
        }
      } catch (error) {
        console.error('Gyro permission error:', error);
        setGyroPermission('denied');
      }
    };

    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      gyroRef.current = {
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0,
      };
    };

    // Animation loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
      const lifeAttribute = geometry.getAttribute('life') as THREE.BufferAttribute;
      const positions = positionAttribute.array as Float32Array;
      const lives = lifeAttribute.array as Float32Array;
      const velocities = velocityRef.current!;

      // Gravity from gyroscope (stronger so the tilt response is clearly visible)
      const gravityX = (gyroRef.current.gamma / 90) * 1.6;
      const gravityY = -(gyroRef.current.beta / 90) * 1.6;
      const gravityZ = 0;

      for (let i = 0; i < particleCount; i++) {
        // Apply gravity
        velocities[i * 3] += gravityX * 0.05;
        velocities[i * 3 + 1] += gravityY * 0.05;
        velocities[i * 3 + 2] -= 0.01; // Slight downward drift

        // Damping
        velocities[i * 3] *= 0.98;
        velocities[i * 3 + 1] *= 0.98;
        velocities[i * 3 + 2] *= 0.98;

        // Update position
        positions[i * 3] += velocities[i * 3];
        positions[i * 3 + 1] += velocities[i * 3 + 1];
        positions[i * 3 + 2] += velocities[i * 3 + 2];

        // Boundary conditions - wrap around
        if (positions[i * 3] > 150) {
          positions[i * 3] = -150;
          velocities[i * 3] *= -0.5;
        }
        if (positions[i * 3] < -150) {
          positions[i * 3] = 150;
          velocities[i * 3] *= -0.5;
        }
        if (positions[i * 3 + 1] > 150) {
          positions[i * 3 + 1] = -150;
          velocities[i * 3 + 1] *= -0.5;
        }
        if (positions[i * 3 + 1] < -150) {
          positions[i * 3 + 1] = 150;
          velocities[i * 3 + 1] *= -0.5;
        }

        // Life decay
        lives[i] -= 0.002;
        if (lives[i] < 0) {
          lives[i] = 1.0;
          positions[i * 3] = (Math.random() - 0.5) * 200;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 200;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 50;
          velocities[i * 3] = (Math.random() - 0.5) * 2;
          velocities[i * 3 + 1] = (Math.random() - 0.5) * 2;
          velocities[i * 3 + 2] = (Math.random() - 0.5) * 1;
        }
      }

      positionAttribute.needsUpdate = true;
      lifeAttribute.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('deviceorientation', handleDeviceOrientation);
      cancelAnimationFrame(animationId);
      containerRef.current?.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-[#f5f1ed]"
    >
      {/* Gyro Permission Dialog */}
      {gyroPermission === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
          <div className="bg-white rounded-lg p-8 max-w-sm mx-4 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-[#1a1a1a]">
              デバイスを傾けて始める
            </h2>
            <p className="text-gray-600 mb-6">
              このデモはスマートフォンのジャイロセンサーを使用して、液体をリアルタイムで制御します。
            </p>
            <button
              onClick={async () => {
                if (typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                  try {
                    const permission = await (DeviceOrientationEvent as any).requestPermission();
                    if (permission === 'granted') {
                      setGyroPermission('granted');
                      window.addEventListener('deviceorientation', (event) => {
                        gyroRef.current = {
                          alpha: event.alpha || 0,
                          beta: event.beta || 0,
                          gamma: event.gamma || 0,
                        };
                      });
                    }
                  } catch (error) {
                    console.error('Permission error:', error);
                    setGyroPermission('denied');
                  }
                } else {
                  setGyroPermission('granted');
                  window.addEventListener('deviceorientation', (event) => {
                    gyroRef.current = {
                      alpha: event.alpha || 0,
                      beta: event.beta || 0,
                      gamma: event.gamma || 0,
                    };
                  });
                }
              }}
              className="w-full bg-[#1a1a1a] text-white py-3 rounded-lg font-semibold hover:bg-[#2c2c2c] transition-colors"
            >
              許可する
            </button>
            <button
              onClick={() => setGyroPermission('denied')}
              className="w-full mt-3 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              スキップ
            </button>
          </div>
        </div>
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-[#1a1a1a] mb-2">
            流体シミュレーション
          </h1>
          <p className="text-lg text-[#2c2c2c] opacity-75">
            傾けて、感じる。
          </p>
        </div>

        {/* Footer Info */}
        <div className="text-center">
          <p className="text-sm text-[#2c2c2c] opacity-60">
            {gyroPermission === 'granted'
              ? 'ジャイロセンサー: 有効'
              : 'ジャイロセンサー: 無効'}
          </p>
          <p className="text-xs text-[#2c2c2c] opacity-50 mt-2">
            スマートフォンを傾けると液体が流れます
          </p>
        </div>
      </div>
    </div>
  );
};

export default FluidSimulation;
