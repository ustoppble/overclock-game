export type FormId = 'base' | 'boost' | 'turbo' | 'overdrive' | 'redline';

export interface OverclockForm {
  id: FormId;
  name: string;
  namePT: string;
  primaryColor: string; // Hex for the main body
  secondaryColor: string; // Accent/shadows
  auraColor: string; // Main aura glow
  auraSparkleColor: string; // Sparkle particles
  hairColor: string | null; // Hair color, if any
  electricColor: string | null; // Lightning crackle color
  rageMultiplier: number;
}

export type AnimationState = 'idle' | 'charge' | 'blast' | 'dash' | 'steam';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  type: 'flame' | 'spark' | 'lightning' | 'ring' | 'smoke';
}

export interface SpriteFrame {
  animation: AnimationState;
  frameIndex: number;
  canvas: HTMLCanvasElement | null;
}
