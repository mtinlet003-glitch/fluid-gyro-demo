import FluidSimulation from '@/components/FluidSimulation';

/**
 * Home Page - Fluid Simulation Demo
 * 
 * Design Philosophy: Organic Minimalism with Digital Fluidity
 * - Full-screen Three.js canvas with fluid simulation
 * - Gyroscope integration for interactive control
 * - Minimalist UI overlay with typography
 */

export default function Home() {
  return (
    <div className="w-full h-screen">
      <FluidSimulation />
    </div>
  );
}
