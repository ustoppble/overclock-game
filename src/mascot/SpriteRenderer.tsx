import React, { useRef, useEffect, useState } from 'react';
import { FormId, OverclockForm, AnimationState, Particle } from './types';
import { audioEngine } from './AudioEngine';

interface SpriteRendererProps {
  form: OverclockForm;
  animation: AnimationState;
  rageLevel: number; // 100 to 1000 (%)
  isMuted: boolean;
  onFrameUpdate?: (frame: number) => void;
  isTransforming?: boolean;
  targetForm?: OverclockForm | null;
  transformProgress?: number;
  /** Bare canvas (no studio chrome), for the living corner widget. */
  compact?: boolean;
}

export const FORMS_INFO: Record<FormId, OverclockForm> = {
  base: {
    id: 'base',
    name: 'Base Mode',
    namePT: 'Modo Base',
    primaryColor: '#FF6B35', // Match bright Orange from reference picture
    secondaryColor: '#9A3412', // Rich terracotta/cocoa secondary color for shadow
    auraColor: 'rgba(251, 113, 133, 0.3)',
    auraSparkleColor: '#F97316',
    hairColor: null,
    electricColor: null,
    rageMultiplier: 1.0
  },
  boost: {
    id: 'boost',
    name: 'Boost Mode',
    namePT: 'Modo Boost',
    primaryColor: '#FF6B35', // Orange (Neutro, same as base body)
    secondaryColor: '#9A3412', // Rich terracotta shadow
    auraColor: 'rgba(251, 191, 36, 0.55)', // soft gold yellow aura
    auraSparkleColor: '#FDE68A', // light yellow sparkles
    hairColor: '#FBBF24', // beautiful gold yellow hair
    electricColor: null,
    rageMultiplier: 2.5
  },
  turbo: {
    id: 'turbo',
    name: 'Turbo Mode',
    namePT: 'Modo Turbo',
    primaryColor: '#C2410C', // Dark Orange (Laranja Escuro)
    secondaryColor: '#7C2D12', // Dark shadow
    auraColor: 'rgba(249, 115, 22, 0.75)', // fiery orange aura
    auraSparkleColor: '#FDE68A',
    hairColor: '#F97316', // Fiery orange spiky hair
    electricColor: '#60A5FA', // classic blue lightning
    rageMultiplier: 5.0
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive Mode',
    namePT: 'Modo Overdrive',
    primaryColor: '#DC2626', // Red (Vermelho)
    secondaryColor: '#7F1D1D', // Dark Red Shadow
    auraColor: 'rgba(220, 38, 38, 0.85)', // fierce red warm flame
    auraSparkleColor: '#FCA5A5', // light red sparkles
    hairColor: '#EF4444', // brilliant fiery red spiky hair
    electricColor: '#EF4444', // bright red flame-like surges
    rageMultiplier: 10.0
  },
  redline: {
    id: 'redline',
    name: 'Redline Mode',
    namePT: 'Modo Redline',
    primaryColor: '#EF4444', // Super Red (Super Vermelho)
    secondaryColor: '#450A0A', // Darkest Red Shadow
    auraColor: 'rgba(239, 68, 68, 0.90)', // extreme red-hot raging aura
    auraSparkleColor: '#93C5FD', // bright blue contrast sparkles
    hairColor: '#3B82F6', // magnificent blue spiky hair
    electricColor: '#93C5FD', // blinding white-cyan lightning
    rageMultiplier: 15.0
  }
};

// Helper function to blend two hex color codes
function interpolateColor(color1: string, color2: string, factor: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  
  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);
  
  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}

// Procedural pixel-art matrix draw helper for absolute alignment
export function drawOverclockFrame({
  ctx,
  ox, // Offset X (on target canvas)
  oy, // Offset Y (on target canvas)
  pixelSize, // size of 1 "retro" pixel e.g. 5px
  animation,
  frameIndex,
  form,
  rageLevel,
  particles = [],
  smokeFrame = 0,
  isTransforming = false,
  targetForm = null,
  transformProgress = 0
}: {
  ctx: CanvasRenderingContext2D;
  ox: number;
  oy: number;
  pixelSize: number;
  animation: AnimationState;
  frameIndex: number;
  form: OverclockForm;
  rageLevel: number;
  particles?: Particle[];
  smokeFrame?: number;
  isTransforming?: boolean;
  targetForm?: OverclockForm | null;
  transformProgress?: number;
}) {
  const intensity = (rageLevel - 100) / 900; // 0 to 1
  
  // Define animation parameters (breathing, vibration, squashing)
  let breatheY = 0;
  let vibrateX = 0;
  let vibrateY = 0;
  let bodyStretchX = 0;
  let bodyStretchY = 0;

  if (animation === 'idle') {
    // 4-frame breathing cycle
    const cycle = frameIndex % 4;
    if (cycle === 1) {
      breatheY = -1;
      bodyStretchY = 1;
    } else if (cycle === 3) {
      breatheY = 0;
      bodyStretchY = -1;
      bodyStretchX = 1;
    }
  } else if (animation === 'charge' || isTransforming) {
    // Heavy vibration!
    const speedFactor = isTransforming ? 3 : (intensity > 0.5 ? 2 : 1);
    vibrateX = Math.round((Math.random() - 0.5) * 2 * speedFactor);
    vibrateY = Math.round((Math.random() - 0.5) * 2 * speedFactor);
    // Slight pulsating squish
    bodyStretchX = Math.round(Math.sin((Date.now() / 40) % Math.PI) * 1);
    bodyStretchY = Math.round(Math.cos((Date.now() / 40) % Math.PI) * 1);
  } else if (animation === 'blast') {
    // Beam charging or blasting
    if (frameIndex === 0) {
      breatheY = 1;
      bodyStretchX = 2;
      bodyStretchY = -2;
      vibrateX = Math.round((Math.random() - 0.5) * 1.5);
    } else if (frameIndex >= 1 && frameIndex <= 4) {
      vibrateX = Math.round((Math.random() - 0.5) * 3);
      vibrateY = Math.round((Math.random() - 0.5) * 2);
      bodyStretchX = 3; // squashed long towards right
      bodyStretchY = -1;
      ox += 4; // slide forward!
    } else {
      breatheY = 2;
      bodyStretchY = -2;
    }
  } else if (animation === 'dash') {
    vibrateX = Math.round((Math.random() - 0.5) * 3);
    bodyStretchX = 4; // squashed forward
    bodyStretchY = -2; // thin top-bottom
  } else if (animation === 'steam') {
    breatheY = 2;
    bodyStretchY = -3;
    bodyStretchX = 1;
  }

  // Draw Aura behind character only while ACTIVELY reacting (charge/blast/dash) or transforming.
  // At rest (idle) the mascot is calm — no permanent aura — so energy reads as a real reaction.
  const isActiveAnim = animation === 'charge' || animation === 'blast' || animation === 'dash';
  const shouldDrawAura = (isActiveAnim || isTransforming) && (form.id !== 'base' || intensity > 0.6 || isTransforming);
  
  // GRID SIZE: 48x48 pixels
  // Body center base: Width = 20, Height = 18
  // Body top-left without stretch: x = 14, y = 18
  const baseW = 20;
  const baseH = 18;
  const w = baseW + bodyStretchX;
  const h = baseH + bodyStretchY;
  
  // Starting coordinates centered on grid
  let bx = 14 - Math.round(bodyStretchX / 2) + vibrateX;
  let by = 18 - Math.round(bodyStretchY) + breatheY + vibrateY;

  // Render helpers inside pixel unit space
  const drawPixel = (px: number, py: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + px * pixelSize, oy + py * pixelSize, pixelSize, pixelSize);
  };

  const drawRect = (rx: number, ry: number, rw: number, rh: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + rx * pixelSize, oy + ry * pixelSize, rw * pixelSize, rh * pixelSize);
  };

  // Intermediate color morphing computation!
  // Normal Claude: bright orange #FF6B35, shadow is #9A3412
  // When high rage base: shifts to determined orange #E0531A and dark shadow #7C2D12 (not full red, so it matches S1/S2 beautifully!)
  let currentPrimary = form.primaryColor;
  let currentSecondary = form.secondaryColor;

  if (isTransforming && targetForm) {
    const factor = transformProgress / 100;
    
    let startPri = form.primaryColor;
    let startSec = form.secondaryColor;
    if (form.id === 'base') {
      const rageIntensity = (rageLevel - 100) / 900;
      startPri = interpolateColor('#FF6B35', '#E0531A', rageIntensity);
      startSec = interpolateColor('#9A3412', '#7C2D12', rageIntensity);
    }
    
    let endPri = targetForm.primaryColor;
    let endSec = targetForm.secondaryColor;
    if (targetForm.id === 'base') {
      const rageIntensity = (rageLevel - 100) / 900;
      endPri = interpolateColor('#FF6B35', '#E0531A', rageIntensity);
      endSec = interpolateColor('#9A3412', '#7C2D12', rageIntensity);
    }

    currentPrimary = interpolateColor(startPri, endPri, factor);
    currentSecondary = interpolateColor(startSec, endSec, factor);
  } else if (form.id === 'base') {
    const rageIntensity = (rageLevel - 100) / 900;
    currentPrimary = interpolateColor('#FF6B35', '#E0531A', rageIntensity);
    currentSecondary = interpolateColor('#9A3412', '#7C2D12', rageIntensity);
  }

  // Calculate scaling for Antenna and Hair spikes
  let antennaScale = 0; // Disabled completely based on user request to remove Claude's antenna
  let hairScale = 0;

  if (isTransforming && targetForm) {
    const startHasHair = !!form.hairColor;
    const endHasHair = !!targetForm.hairColor;

    if (startHasHair && endHasHair) hairScale = 1;
    else if (!startHasHair && endHasHair) hairScale = transformProgress / 100;
    else if (startHasHair && !endHasHair) hairScale = 1 - (transformProgress / 100);
  } else {
    hairScale = form.hairColor ? 1 : 0;
  }

  // 1. DRAW BACKSIDE AURA GLOW
  if (shouldDrawAura) {
    const auraRadius = 6 + Math.round(intensity * 4);
    
    for (let frameOffsetY = -auraRadius; frameOffsetY < h + auraRadius; frameOffsetY++) {
      const rowY = by + frameOffsetY;
      const waveOsc = Math.sin((Date.now() / 100) - rowY * 0.4) * (2 + intensity * 3);
      const rowWidth = w + auraRadius * 1.5 - Math.abs(frameOffsetY / 2) + waveOsc;
      const startSegX = bx - (rowWidth - w) / 2;
      
      const alphaVal = Math.max(0.1, 0.7 - Math.abs(frameOffsetY) / (auraRadius * 1.3));
      
      // Interpolate aura color based on forms
      if (isTransforming && targetForm) {
        const factor = transformProgress / 100;
        const sColor = form.id === 'boost' ? '251, 191, 36' :
                       form.id === 'turbo' ? '249, 115, 22' :
                       form.id === 'overdrive'  ? '220, 38, 38' :
                       form.id === 'redline' ? '239, 68, 68' : '249, 115, 22';
        const tColor = targetForm.id === 'boost' ? '251, 191, 36' :
                       targetForm.id === 'turbo' ? '249, 115, 22' :
                       targetForm.id === 'overdrive'  ? '220, 38, 38' :
                       targetForm.id === 'redline' ? '239, 68, 68' : '249, 115, 22';
        const rgb = factor < 0.5 ? sColor : tColor;
        ctx.fillStyle = `rgba(${rgb}, ${alphaVal})`;
      } else {
        const rgb = form.id === 'boost' ? '251, 191, 36' :
                    form.id === 'turbo' ? '249, 115, 22' :
                    form.id === 'overdrive'  ? '220, 38, 38' :
                    form.id === 'redline' ? '239, 68, 68' : '249, 115, 22';
        ctx.fillStyle = `rgba(${rgb}, ${alphaVal})`;
      }
      
      ctx.fillRect(
        ox + Math.round(startSegX) * pixelSize,
        oy + rowY * pixelSize,
        Math.round(rowWidth) * pixelSize,
        pixelSize
      );
    }
  }

  // 2. DRAW SPIKY ENERGY HAIR (Rises step-by-step during transition!)
  if (hairScale > 0.05 && animation !== 'steam') {
    const hc = targetForm?.hairColor || form.hairColor || '#FACC15';
    const hShadow = targetForm?.secondaryColor || form.secondaryColor || '#991B1B';
    const hairY = by;
    
    const activeHairFormId = isTransforming && targetForm ? (targetForm.hairColor ? targetForm.id : form.id) : form.id;
    
    if (activeHairFormId === 'boost') {
      const sh1 = Math.round(3 * hairScale);
      drawRect(bx, hairY - sh1, 3, sh1, hc);
      if (hairScale > 0.6) {
        drawRect(bx + 1, hairY - sh1 - 2, 2, 2, hc);
        drawPixel(bx + 1, hairY - sh1 - 3, '#FFF');
      }

      const sh2 = Math.round(4 * hairScale);
      const sh2_top = Math.round(8 * hairScale);
      drawRect(bx + 4, hairY - sh2, 3, sh2, hShadow);
      drawRect(bx + 5, hairY - Math.round(6 * hairScale), 3, Math.round(6 * hairScale), hc);
      if (hairScale > 0.5) {
        drawRect(bx + 6, hairY - sh2_top, 2, 3, hc);
        drawPixel(bx + 6, hairY - sh2_top - 1, '#FDE68A');
      }

      const sh3 = Math.round(5 * hairScale);
      const sh3_top = Math.round(10 * hairScale);
      drawRect(bx + 10, hairY - sh3, 3, sh3, hShadow);
      drawRect(bx + 11, hairY - Math.round(8 * hairScale), 3, Math.round(8 * hairScale), hc);
      if (hairScale > 0.5) {
        drawRect(bx + 12, hairY - sh3_top, 2, 3, hc);
        drawPixel(bx + 12, hairY - sh3_top - 1, '#FFF');
      }

      const sh4 = Math.round(3 * hairScale);
      drawRect(bx + 16, hairY - sh4, 3, sh4, hc);
      if (hairScale > 0.6) {
        drawRect(bx + 17, hairY - sh4 - 1, 2, 2, hc);
        drawPixel(bx + 18, hairY - sh4 - 2, '#FDE68A');
      }
    } else if (activeHairFormId === 'turbo') {
      const randomHairVibrate = Math.round(Math.random() * 1);
      drawRect(bx - 1, hairY - Math.round(2 * hairScale), 3, Math.round(3 * hairScale), hc);
      
      drawRect(bx + 1, hairY - Math.round(6 * hairScale), 3, Math.round(5 * hairScale), hc);
      if (hairScale > 0.6) {
        drawRect(bx + 2, hairY - Math.round((8 + randomHairVibrate) * hairScale), 2, 3, hc);
        drawPixel(bx + 2, hairY - Math.round((9 + randomHairVibrate) * hairScale), '#FFF');
      }
      
      const midH1 = Math.round(9 * hairScale);
      drawRect(bx + 5, hairY - Math.round(5 * hairScale), 4, Math.round(6 * hairScale), hShadow);
      drawRect(bx + 6, hairY - midH1, 3, Math.round(5 * hairScale), hc);
      if (hairScale > 0.7) {
        drawRect(bx + 7, hairY - Math.round(12 * hairScale), 2, 4, hc);
        drawPixel(bx + 7, hairY - Math.round(13 * hairScale), '#FFE066');
      }

      const midH2 = Math.round(10 * hairScale);
      drawRect(bx + 11, hairY - Math.round(5 * hairScale), 4, Math.round(6 * hairScale), hShadow);
      drawRect(bx + 11, hairY - midH2, 3, Math.round(6 * hairScale), hc);
      if (hairScale > 0.7) {
        drawRect(bx + 12, hairY - Math.round(13 * hairScale), 2, 4, hc);
        drawPixel(bx + 12, hairY - Math.round(14 * hairScale), '#FFE066');
      }

      drawRect(bx + 16, hairY - Math.round(6 * hairScale), 3, Math.round(5 * hairScale), hc);
      if (hairScale > 0.7) {
        drawRect(bx + 17, hairY - Math.round(8 * hairScale), 2, 3, hc);
      }
    } else if (activeHairFormId === 'overdrive') {
      drawRect(bx, hairY - Math.round(2 * hairScale), 3, Math.round(3 * hairScale), hc);
      if (hairScale > 0.5) {
        drawRect(bx + 2, hairY - Math.round(5 * hairScale), 3, Math.round(4 * hairScale), hc);
        drawRect(bx + 3, hairY - Math.round(7 * hairScale), 2, 3, '#F87171'); // Fire red highlight
      }

      drawRect(bx + 6, hairY - Math.round(4 * hairScale), 4, Math.round(5 * hairScale), hShadow);
      drawRect(bx + 7, hairY - Math.round(8 * hairScale), 3, Math.round(5 * hairScale), hc);
      if (hairScale > 0.7) {
        drawRect(bx + 8, hairY - Math.round(11 * hairScale), 2, 4, hc);
        drawPixel(bx + 8, hairY - Math.round(12 * hairScale), '#FEE2E2'); // warm red-white flare highlight
      }

      drawRect(bx + 11, hairY - Math.round(4 * hairScale), 4, Math.round(5 * hairScale), hShadow);
      drawRect(bx + 11, hairY - Math.round(9 * hairScale), 3, Math.round(6 * hairScale), hc);
      if (hairScale > 0.7) {
        drawRect(bx + 12, hairY - Math.round(11 * hairScale), 2, 3, hc);
      }

      drawRect(bx + 16, hairY - Math.round(4 * hairScale), 3, Math.round(4 * hairScale), hc);
    } else if (activeHairFormId === 'redline') {
      const flow = Math.sin(Date.now() / 60) * 1;
      
      drawRect(bx - 2, hairY - Math.round(3 * hairScale), 4, Math.round(4 * hairScale), hShadow);
      drawRect(bx - 1, hairY - Math.round(6 * hairScale), 3, Math.round(4 * hairScale), hc);
      
      drawRect(bx + 4, hairY - Math.round(6 * hairScale), 5, Math.round(7 * hairScale), hShadow);
      drawRect(bx + 5, hairY - Math.round(11 * hairScale), 4, Math.round(6 * hairScale), hc);
      if (hairScale > 0.6) {
        drawRect(bx + 6 + Math.round(flow), hairY - Math.round(15 * hairScale), 3, Math.round(5 * hairScale), hc);
        drawRect(bx + 6 + Math.round(flow), hairY - Math.round(17 * hairScale), 2, Math.round(3 * hairScale), '#FFF');
      }

      drawRect(bx + 11, hairY - Math.round(6 * hairScale), 5, Math.round(7 * hairScale), hShadow);
      drawRect(bx + 11, hairY - Math.round(12 * hairScale), 4, Math.round(7 * hairScale), hc);
      if (hairScale > 0.6) {
        drawRect(bx + 12, hairY - Math.round(15 * hairScale), 2, Math.round(4 * hairScale), hc);
        drawPixel(bx + 12, hairY - Math.round(16 * hairScale), '#93C5FD');
      }

      drawRect(bx + 17, hairY - Math.round(4 * hairScale), 4, Math.round(5 * hairScale), hc);
      if (hairScale > 0.7) {
        drawRect(bx + 18, hairY - Math.round(7 * hairScale), 2, Math.round(4 * hairScale), hc);
      }
    }
  }

  // 3. DRAW MAIN BODY CUBE
  // Fill background
  drawRect(bx, by, w, h, currentPrimary);

  // Bottom Shadow Depth
  drawRect(bx, by + h - 2, w, 2, currentSecondary);
  drawRect(bx, by, 1, h, currentSecondary); // left outline
  drawRect(bx + w - 1, by, 1, h, currentSecondary); // right outline

  // Corners rounded transparent painting (makes it a beautiful rounded box mascot)
  drawPixel(bx, by, 'transparent');
  drawPixel(bx + w - 1, by, 'transparent');
  drawPixel(bx, by + h - 1, 'transparent');
  drawPixel(bx + w - 1, by + h - 1, 'transparent');

  // Draw inner highlights for depth
  drawPixel(bx + 1, by + 1, '#FFFFFF3F');
  drawRect(bx + 1, by + 1, w - 2, 1, '#FFFFFF17');

  // 4. DRAW MASCOT ANTENNA (For base Claude and while transitioning)
  if (antennaScale > 0.05) {
    const termColor = currentPrimary; 
    const antStemY = by - 1;
    const antH = Math.max(1, Math.round(3 * antennaScale));
    const antX = bx + Math.floor(w / 2);
    
    // Draw antenna stem
    drawRect(antX, antStemY - antH + 1, 1, antH, termColor);
    
    // Draw glowing bulb
    const bulbY = antStemY - antH;
    let bulbColor = '#FBBF24'; // steady warm yellow
    if (rageLevel > 600 || isTransforming) {
      bulbColor = Math.floor(Date.now() / 100) % 2 === 0 ? '#EF4444' : '#FDE68A'; // blinking red/amber
    }
    
    drawRect(antX - 1, bulbY - 1, 3, 2, bulbColor);
    
    if (isTransforming || rageLevel > 500) {
      if (Math.random() < 0.3) {
        drawPixel(antX - 2 + Math.round(Math.random() * 4), bulbY - 2 + Math.round(Math.random() * 3), '#67E8F9');
      }
    }
  }

  // 4b. DRAW HORNS (Drawn on all other forms except base, grows dynamically)
  let hornScale = 0;
  if (isTransforming && targetForm) {
    const startHasHorns = form.id !== 'base';
    const endHasHorns = targetForm.id !== 'base';
    if (startHasHorns && endHasHorns) hornScale = 1;
    else if (!startHasHorns && endHasHorns) hornScale = transformProgress / 100;
    else if (startHasHorns && !endHasHorns) hornScale = 1 - (transformProgress / 100);
  } else {
    hornScale = form.id !== 'base' ? 1 : 0;
  }

  if (hornScale > 0.05) {
    const leftHornX = bx + 1;
    const rightHornX = bx + w - w/5; // robust positioning
    const hornY = by - 3;
    const hornH = Math.max(1, Math.round(3 * hornScale));
    
    if (animation !== 'steam') {
      // Left horn
      drawRect(leftHornX, hornY + (3 - hornH), 3, hornH, currentPrimary);
      if (hornScale > 0.6) {
        drawPixel(leftHornX + 1, hornY - 1, currentSecondary);
        drawPixel(leftHornX, hornY + 1, currentSecondary);
      }
      
      // Right horn
      drawRect(rightHornX, hornY + (3 - hornH), 3, hornH, currentPrimary);
      if (hornScale > 0.6) {
        drawPixel(rightHornX + 1, hornY - 1, currentSecondary);
        drawPixel(rightHornX + 2, hornY + 1, currentSecondary);
      }
    } else {
      drawRect(leftHornX, hornY + 1, 3, 2, currentPrimary);
      drawRect(rightHornX, hornY + 2, 3, 1, currentPrimary);
    }
  }

  // 5. DRAW THE FACE (Cute mascot face transforms into a raging energy based on its specific form)
  const faceY = by + 5;
  const mouthY = faceY + 5;
  const effectiveRage = isTransforming ? 700 : rageLevel;
  const activeFaceFormId = isTransforming && targetForm ? (transformProgress > 50 ? targetForm.id : form.id) : form.id;

  if (activeFaceFormId === 'base') {
    if (effectiveRage < 350) {
      // A1. CUTE COY BASE (friendly wide-smiling mascot, happy eyes)
      drawRect(bx + 3, faceY, 2, 2, '#3E3431');
      drawRect(bx + w - 5, faceY, 2, 2, '#3E3431');
      drawPixel(bx + 3, faceY, '#FFFFFF');
      drawPixel(bx + w - 5, faceY, '#FFFFFF');
      
      const mouthW = w - 14; 
      drawRect(bx + 7, mouthY, mouthW, 1, '#3E3431');
      drawRect(bx + 8, mouthY + 1, mouthW - 2, 1, '#3E3431');
      drawRect(bx + 9, mouthY + 2, mouthW - 4, 1, '#3E3431');
    } else if (effectiveRage < 650) {
      // A2. DETERMINED/ANNOYED BASE (flat brows, flat round eyes, flat line mouth)
      drawRect(bx + 3, faceY - 1, 3, 1, currentSecondary);
      drawRect(bx + w - 6, faceY - 1, 3, 1, currentSecondary);
      
      drawRect(bx + 3, faceY + 1, 2, 2, '#3E3431');
      drawRect(bx + w - 5, faceY + 1, 2, 2, '#3E3431');
      drawPixel(bx + 3, faceY + 1, '#FFFFFF');
      drawPixel(bx + w - 5, faceY + 1, '#FFFFFF');
      
      drawRect(bx + 7, mouthY + 1, w - 14, 1, '#3E3431');
    } else {
      // A3. RAGING BASE (angled dark eyebrows, glowing gold eyes, clenched mouth)
      const browColor = '#000000';
      // Left eye & Brow (Supreme Fierce Angry look)
      drawPixel(bx + 1, faceY - 1, browColor);
      drawPixel(bx + 2, faceY - 1, browColor);
      drawRect(bx + 2, faceY, 4, 1, browColor);
      drawRect(bx + 5, faceY + 1, 2, 1, browColor);
      
      // Left Glowing Core (Fiery Orange/Yellow gradient)
      drawPixel(bx + 3, faceY + 1, '#EA580C'); // deep intense orange glow
      drawPixel(bx + 4, faceY + 1, '#F59E0B'); // bright orange-yellow
      drawPixel(bx + 4, faceY + 2, '#FEF08A'); // yellow core
      drawPixel(bx + 5, faceY + 2, '#FFFFFF'); // blazing white hot spark
      
      // Right eye & Brow (Supreme Fierce Angry look)
      drawPixel(bx + w - 2, faceY - 1, browColor);
      drawPixel(bx + w - 3, faceY - 1, browColor);
      drawRect(bx + w - 6, faceY, 4, 1, browColor);
      drawRect(bx + w - 7, faceY + 1, 2, 1, browColor);
      
      // Right Glowing Core (Fiery Orange/Yellow gradient)
      drawPixel(bx + w - 4, faceY + 1, '#EA580C'); // deep intense orange glow
      drawPixel(bx + w - 5, faceY + 1, '#F59E0B'); // bright orange-yellow
      drawPixel(bx + w - 5, faceY + 2, '#FEF08A'); // yellow core
      drawPixel(bx + w - 6, faceY + 2, '#FFFFFF'); // blazing white hot spark
      
      // Mouth
      drawRect(bx + 6, mouthY, w - 12, 1, '#000');
      drawPixel(bx + 5, mouthY + 1, '#000');
      drawPixel(bx + w - 5, mouthY + 1, '#000');
      drawPixel(bx + w - 7, mouthY + 1, '#FFFFFF');
    }
  } else if (activeFaceFormId === 'boost') {
    // B. BOOST FORM: "UM POUCO MAIS BRABO"
    // He has moderately tilted/angled yellow eyebrows, warning glowing cyan eyes, and a cool grumpy determined mouth with his signature tooth!
    const browColor = '#000000';
    
    if (animation !== 'steam') {
      // Left Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + 1, faceY - 1, browColor);
      drawPixel(bx + 2, faceY - 1, browColor);
      drawRect(bx + 2, faceY, 4, 1, browColor);
      drawRect(bx + 5, faceY + 1, 2, 1, browColor);
      
      // Left Glowing Core (Volt-Cyan gradient)
      drawPixel(bx + 3, faceY + 1, '#0891B2'); // deep cyan
      drawPixel(bx + 4, faceY + 1, '#06B6D4'); // cyan
      drawPixel(bx + 4, faceY + 2, '#67E8F9'); // light cyan
      drawPixel(bx + 5, faceY + 2, '#FFFFFF'); // blazing white core
      
      // Right Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + w - 2, faceY - 1, browColor);
      drawPixel(bx + w - 3, faceY - 1, browColor);
      drawRect(bx + w - 6, faceY, 4, 1, browColor);
      drawRect(bx + w - 7, faceY + 1, 2, 1, browColor);
      
      // Right Glowing Core (Volt-Cyan gradient)
      drawPixel(bx + w - 4, faceY + 1, '#0891B2');
      drawPixel(bx + w - 5, faceY + 1, '#06B6D4');
      drawPixel(bx + w - 5, faceY + 2, '#67E8F9');
      drawPixel(bx + w - 6, faceY + 2, '#FFFFFF');
      
      // Clenched rage mouth with his signature single tooth!
      drawRect(bx + 6, mouthY, w - 12, 1, '#000');
      drawPixel(bx + 5, mouthY + 1, '#000');
      drawPixel(bx + w - 5, mouthY + 1, '#000');
      drawPixel(bx + w - 7, mouthY + 1, '#FFFFFF'); // The single tooth!
    } else {
      drawRect(bx + 3, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + w - 6, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + 8, mouthY + 1, 4, 1, '#000');
    }
  } else if (activeFaceFormId === 'turbo') {
    // C. TURBO FORM: "MAIS BRABO / FOCUS SHOCK"
    // Very angry eyebrows, electric cyan glowing eyes, clenched angry smile with his signature single tooth!
    const browColor = '#000000';
    
    if (animation !== 'steam') {
      // Left Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + 1, faceY - 1, browColor);
      drawPixel(bx + 2, faceY - 1, browColor);
      drawRect(bx + 2, faceY, 4, 1, browColor);
      drawRect(bx + 5, faceY + 1, 2, 1, browColor);
      
      // Left Glowing Core (Hot electric blue/teal gradient)
      drawPixel(bx + 3, faceY + 1, '#2563EB'); // intense royal blue
      drawPixel(bx + 4, faceY + 1, '#3B82F6'); // bright blue
      drawPixel(bx + 4, faceY + 2, '#93C5FD'); // ice blue
      drawPixel(bx + 5, faceY + 2, '#FFFFFF'); // blazing white core
      
      // Right Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + w - 2, faceY - 1, browColor);
      drawPixel(bx + w - 3, faceY - 1, browColor);
      drawRect(bx + w - 6, faceY, 4, 1, browColor);
      drawRect(bx + w - 7, faceY + 1, 2, 1, browColor);
      
      // Right Glowing Core (Hot electric blue/teal gradient)
      drawPixel(bx + w - 4, faceY + 1, '#2563EB');
      drawPixel(bx + w - 5, faceY + 1, '#3B82F6');
      drawPixel(bx + w - 5, faceY + 2, '#93C5FD');
      drawPixel(bx + w - 6, faceY + 2, '#FFFFFF');
      
      // Clenched rage mouth with his signature single tooth!
      drawRect(bx + 6, mouthY, w - 12, 1, '#000');
      drawPixel(bx + 5, mouthY + 1, '#000');
      drawPixel(bx + w - 5, mouthY + 1, '#000');
      drawPixel(bx + w - 7, mouthY + 1, '#FFFFFF'); // The single tooth!
    } else {
      drawRect(bx + 3, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + w - 6, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + 8, mouthY, 4, 2, '#000');
    }
  } else if (activeFaceFormId === 'overdrive') {
    // D. OVERDRIVE FORM: "BRABISSIMO DEUS"
    // Deep red angry eyebrows, glowing pink-red warm eyes, shouting/roaring open mouth but WITH a single tooth!
    const browColor = '#000000';
    
    if (animation !== 'steam') {
      // Left Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + 1, faceY - 1, browColor);
      drawPixel(bx + 2, faceY - 1, browColor);
      drawRect(bx + 2, faceY, 4, 1, browColor);
      drawRect(bx + 5, faceY + 1, 2, 1, browColor);
      
      // Left Glowing Core (Divine fiery crimson red gradient)
      drawPixel(bx + 3, faceY + 1, '#991B1B'); // deep vermilion crimson
      drawPixel(bx + 4, faceY + 1, '#DC2626'); // fire red
      drawPixel(bx + 4, faceY + 2, '#FCA5A5'); // warm rose
      drawPixel(bx + 5, faceY + 2, '#FFFFFF'); // white hot core
      
      // Right Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + w - 2, faceY - 1, browColor);
      drawPixel(bx + w - 3, faceY - 1, browColor);
      drawRect(bx + w - 6, faceY, 4, 1, browColor);
      drawRect(bx + w - 7, faceY + 1, 2, 1, browColor);
      
      // Right Glowing Core (Divine fiery crimson red gradient)
      drawPixel(bx + w - 4, faceY + 1, '#991B1B');
      drawPixel(bx + w - 5, faceY + 1, '#DC2626');
      drawPixel(bx + w - 5, faceY + 2, '#FCA5A5');
      drawPixel(bx + w - 6, faceY + 2, '#FFFFFF');
      
      // Open shouting mouth with a signature single pixel tooth at the corner!
      drawRect(bx + 7, mouthY, 6, 2, '#000');
      drawPixel(bx + 9, mouthY + 1, '#DC2626'); // Red heat deep inside
      drawPixel(bx + 12, mouthY, '#FFFFFF'); // Iconic single tooth on the right!
    } else {
      drawRect(bx + 3, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + w - 6, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + 8, mouthY, 4, 2, '#000');
    }
  } else {
    // E. REDLINE FORM: "MUITO BRABO / BRABASSO SEVERO"
    // Ultimate dark purple/black highly angled eyebrows, glowing hot magenta-red eyes with stark white slash slit,
    // and a roaring predator mouth with HIS UNIQUE SINGLE TOOTH preserved inside!
    const browColor = '#000000';
    
    if (animation !== 'steam') {
      // Left Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + 1, faceY - 1, browColor);
      drawPixel(bx + 2, faceY - 1, browColor);
      drawRect(bx + 2, faceY, 4, 1, browColor);
      drawRect(bx + 5, faceY + 1, 2, 1, browColor);
      
      // Left Glowing Core (Void magenta neon electrical gradient)
      drawPixel(bx + 3, faceY + 1, '#701A75'); // dark magenta void
      drawPixel(bx + 4, faceY + 1, '#D946EF'); // glowing purple/pink
      drawPixel(bx + 4, faceY + 2, '#F472B6'); // lightning rose pink
      drawPixel(bx + 5, faceY + 2, '#FFFFFF'); // supernova white core
      
      // Right Eye & Angry Brow (Supreme Fierce Angry look)
      drawPixel(bx + w - 2, faceY - 1, browColor);
      drawPixel(bx + w - 3, faceY - 1, browColor);
      drawRect(bx + w - 6, faceY, 4, 1, browColor);
      drawRect(bx + w - 7, faceY + 1, 2, 1, browColor);
      
      // Right Glowing Core (Void magenta neon electrical gradient)
      drawPixel(bx + w - 4, faceY + 1, '#701A75');
      drawPixel(bx + w - 5, faceY + 1, '#D946EF');
      drawPixel(bx + w - 5, faceY + 2, '#F472B6');
      drawPixel(bx + w - 6, faceY + 2, '#FFFFFF');
      
      // Epic screaming roaring mouth with exactly ONE signature white tooth!
      drawRect(bx + 6, mouthY - 1, 8, 3, '#000000');
      // Red roaring throat/tongue inside
      drawRect(bx + 8, mouthY, 4, 2, '#EF4444');
      // Unique single corner tooth / fang for Claude's identity!
      drawPixel(bx + 13, mouthY - 1, '#FFFFFF'); // The single tooth on the right!
    } else {
      drawRect(bx + 3, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + w - 6, faceY + 1, 3, 1, '#1F2937');
      drawRect(bx + 7, mouthY - 1, 6, 3, '#000');
    }
  }

  // 6. DRAW ARMS
  const armColor = currentPrimary;
  const armShadow = currentSecondary;
  const armY = by + 9;

  if (animation === 'idle' || animation === 'charge' || isTransforming) {
    // Left Arm
    drawRect(bx - 3, armY, 3, 1, armColor);
    drawRect(bx - 3, armY + 1, 1, 3, armShadow);
    drawRect(bx - 2, armY + 4, 2, 1, armColor);
    
    // Right Arm
    drawRect(bx + w, armY, 3, 1, armColor);
    drawRect(bx + w + 2, armY + 1, 1, 3, armShadow);
    drawRect(bx + w, armY + 4, 2, 1, armColor);
  } else if (animation === 'blast') {
    if (frameIndex === 0) {
      drawRect(bx + w - 2, armY - 1, 3, 2, armColor);
      drawRect(bx + w - 2, armY + 2, 3, 2, armColor);
    } else {
      drawRect(bx + w - 1, armY - 1, 5, 2, armColor);
      drawRect(bx + w - 1, armY - 1, 5, 1, '#FFF');
      drawRect(bx + w - 1, armY + 2, 5, 2, armColor);
    }
  } else if (animation === 'dash') {
    drawRect(bx - 4, armY + 1, 4, 1, armShadow);
    drawRect(bx - 5, armY + 2, 3, 1, armColor);
  } else if (animation === 'steam') {
    drawRect(bx - 1, armY, 1, 5, armColor);
    drawRect(bx + w, armY, 1, 5, armColor);
  }

  // 7. DRAW LEGS
  const legY = by + h;
  const legH = 4;
  const legColor = currentSecondary;

  if (animation === 'idle') {
    const walkPeriod = frameIndex % 4;
    const leftOffset = walkPeriod === 1 ? -1 : 0;
    const rightOffset = walkPeriod === 3 ? -1 : 0;
    
    drawRect(bx + 4, legY, 3, legH + leftOffset, legColor);
    drawRect(bx + w - 7, legY, 3, legH + rightOffset, legColor);
  } else if (animation === 'charge' || isTransforming) {
    const floatOsc = Math.sin(Date.now() / 80) * 1.5;
    drawRect(bx + 4, legY, 2, Math.round(legH + floatOsc), legColor);
    drawRect(bx + w - 6, legY, 2, Math.round(legH - floatOsc), legColor);
  } else if (animation === 'blast') {
    if (frameIndex >= 1 && frameIndex <= 4) {
      drawRect(bx + 1, legY, 2, legH, legColor);
      drawRect(bx + 1, legY + legH, 3, 1, '#000');
      
      drawRect(bx + w - 3, legY, 2, legH, legColor);
      drawRect(bx + w - 3, legY + legH, 3, 1, '#000');
    } else {
      drawRect(bx + 4, legY, 2, legH, legColor);
      drawRect(bx + w - 6, legY, 2, legH, legColor);
    }
  } else if (animation === 'dash') {
    drawRect(bx - 3, legY - 3, legH, 2, legColor);
    drawRect(bx - 4, legY - 1, legH, 2, legColor);
  } else if (animation === 'steam') {
    drawRect(bx + 3, legY, 3, 2, legColor);
    drawRect(bx + 1, legY + 2, 3, 1, '#000');
    
    drawRect(bx + w - 6, legY, 3, 2, legColor);
    drawRect(bx + w - 4, legY + 2, 3, 1, '#000');
  }

  // 8. STEAM PARTICLES OVERLAY
  if (animation === 'steam') {
    ctx.fillStyle = `rgba(243, 244, 246, ${0.4 + Math.sin(Date.now() / 200) * 0.3})`;
    const steamX1 = (bx + 1) + Math.sin(smokeFrame * 0.2) * 2;
    const steamY1 = (by - 3) - 2 - (smokeFrame % 12);
    ctx.fillRect(ox + Math.round(steamX1) * pixelSize, oy + Math.round(steamY1) * pixelSize, 2 * pixelSize, 2 * pixelSize);

    const steamX2 = (bx + w - 4) + Math.cos(smokeFrame * 0.25) * 2;
    const steamY2 = (by - 3) - 4 - ((smokeFrame + 6) % 12);
    ctx.fillRect(ox + Math.round(steamX2) * pixelSize, oy + Math.round(steamY2) * pixelSize, 2 * pixelSize, 2 * pixelSize);
  }

  // 9. LIGHTNING SHOCK SPARKS (Both side-sparks and frontal-sparks crossing in front of their bodies)
  // Reactions only — NOT the level-up morph (isTransforming). Level/stage stays global (C-040):
  // any mascot, anywhere, can morph form. But the lightning is local feedback (charge = worker
  // running here, blast = worker just finished here) — a morph driven by burn from another
  // workspace/instance must not light up a workspace where nothing local is happening.
  const lightningColor = targetForm?.electricColor || form.electricColor;
  if (lightningColor && (animation === 'charge' || (animation === 'blast' && frameIndex > 0))) {
    // A. Epic Side discharges (classic lightning sparks in the aura)
    if (Math.random() < 0.40) {
      ctx.strokeStyle = lightningColor;
      ctx.lineWidth = Math.max(1, Math.round(pixelSize / 2));
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      
      const lightningSide = Math.random() < 0.5 ? -1 : 1;
      let startX = bx + (lightningSide > 0 ? w + 3 : -4) + Math.round((Math.random() - 0.5) * 4);
      let startY = by - 8 + Math.round(Math.random() * (h + 12));
      
      ctx.moveTo(ox + startX * pixelSize, oy + startY * pixelSize);
      for (let segment = 0; segment < 4; segment++) {
        startX += Math.round((Math.random() - 0.5) * 5);
        startY += Math.round(Math.random() * 6);
        ctx.lineTo(ox + startX * pixelSize, oy + startY * pixelSize);
      }
      ctx.stroke();
    }

    // B. NEW: Frontal lightning bolts crossing directly in front of their face / body!
    // Drawn on top of the character with a premium dual-stroke (neon colored base + hot white core)
    if (Math.random() < 0.45) {
      // Choose a random path starts near the hair/horns and snakes downward
      let startX = bx + 1 + Math.round(Math.random() * (w - 2));
      let startY = by - 6 + Math.round(Math.random() * 6);
      
      const pts = [{ x: startX, y: startY }];
      const segments = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < segments; s++) {
        startX += Math.round((Math.random() - 0.5) * 8); // nice dramatic zig-zag spikes
        startY += Math.round(4 + Math.random() * 5);     // direct downward descent
        pts.push({ x: startX, y: startY });
      }
      
      // First Stroke: Thick background color glow
      ctx.strokeStyle = lightningColor;
      ctx.lineWidth = Math.max(2, Math.round(pixelSize / 1.5));
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      ctx.moveTo(ox + pts[0].x * pixelSize, oy + pts[0].y * pixelSize);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(ox + pts[i].x * pixelSize, oy + pts[i].y * pixelSize);
      }
      ctx.stroke();
      
      // Second Stroke: Bright white electrical core overlay
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, Math.round(pixelSize / 3));
      ctx.beginPath();
      ctx.moveTo(ox + pts[0].x * pixelSize, oy + pts[0].y * pixelSize);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(ox + pts[i].x * pixelSize, oy + pts[i].y * pixelSize);
      }
      ctx.stroke();
    }
  }

  // 10. ENERGY DIRECT REACTION PARTICLES
  if (particles && particles.length > 0) {
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillRect(ox + p.x * pixelSize, oy + p.y * pixelSize, p.size * pixelSize, p.size * pixelSize);
    });
    ctx.globalAlpha = 1.0;
  }
}

export const SpriteRenderer: React.FC<SpriteRendererProps> = ({
  form,
  animation,
  rageLevel,
  isMuted,
  onFrameUpdate,
  isTransforming = false,
  targetForm = null,
  transformProgress = 0,
  compact = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [smokeFrame, setSmokeFrame] = useState(0);
  const particlesRef = useRef<Particle[]>([]);

  // Sound triggers on animation state change
  useEffect(() => {
    audioEngine.setMute(isMuted);
    
    if (animation === 'charge' || isTransforming) {
      audioEngine.startCharge(form.rageMultiplier);
    } else if (animation === 'blast') {
      audioEngine.playBlast();
    } else if (animation === 'dash') {
      audioEngine.playDash();
    } else if (animation === 'steam') {
      audioEngine.playSteam();
    } else {
      audioEngine.stopCharge();
    }

    return () => {
      audioEngine.stopCharge();
    };
  }, [animation, form.id, isMuted, isTransforming]);

  // Modulate charge audio on rage level slide
  useEffect(() => {
    if (animation === 'charge' || isTransforming) {
      audioEngine.modulateCharge(form.rageMultiplier * (rageLevel / 100));
    }
  }, [rageLevel, animation, form.id, isTransforming]);

  // Frame tick loop
  useEffect(() => {
    let frameRate = 120;
    if (animation === 'charge' || isTransforming) {
      frameRate = 80;
    } else if (animation === 'blast') {
      frameRate = 140;
    } else if (animation === 'dash') {
      frameRate = 60;
    } else if (animation === 'steam') {
      frameRate = 180;
    }

    const interval = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (onFrameUpdate) onFrameUpdate(next);
        return next;
      });
      setSmokeFrame((prev) => prev + 1);
    }, frameRate);

    return () => clearInterval(interval);
  }, [animation, onFrameUpdate, isTransforming]);

  // Particle updates & canvas painting loop
  useEffect(() => {
    let animationFrameId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const pixelSize = canvas.width / 48;
      const particles = particlesRef.current;
      const intensity = (rageLevel - 100) / 900;
      
      if ((animation === 'charge' || isTransforming) && Math.random() < 0.4 + intensity * 0.4) {
        particles.push({
          x: 10 + Math.random() * 28,
          y: 40 + Math.random() * 8,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -1.2 - Math.random() * 1.5 - intensity * 1,
          size: Math.random() < 0.4 ? 2 : 1,
          color: Math.random() < 0.3 ? '#FFFFFF' : (targetForm?.auraSparkleColor || form.auraSparkleColor),
          life: 25,
          maxLife: 25,
          type: 'spark'
        });
        
        if (Math.random() < 0.08) {
          audioEngine.playCrackle();
        }
      } else if (animation === 'blast' && frameIndex % 6 >= 1 && frameIndex % 6 <= 4) {
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: 28 + Math.random() * 20,
            y: 20 + Math.random() * 12,
            vx: 3 + Math.random() * 4,
            vy: (Math.random() - 0.5) * 3,
            size: 1 + Math.round(Math.random() * 2),
            color: Math.random() < 0.3 ? '#FFFFFF' : form.auraSparkleColor,
            life: 15,
            maxLife: 15,
            type: 'flame'
          });
        }
      }

      // Physics update Loop
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }

      // Faint retro grid background (skipped in compact/widget mode → transparent canvas).
      if (!compact) {
      ctx.save();
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.08)';
      ctx.lineWidth = 0.5;
      for (let gridX = 0; gridX <= canvas.width; gridX += pixelSize) {
        ctx.beginPath();
        ctx.moveTo(gridX, 0);
        ctx.lineTo(gridX, canvas.height);
        ctx.stroke();
      }
      for (let gridY = 0; gridY <= canvas.height; gridY += pixelSize) {
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(canvas.width, gridY);
        ctx.stroke();
      }
      ctx.restore();
      }

      // DRAW BEAM BLAST COLUMNS
      if (animation === 'blast' && frameIndex % 6 >= 1 && frameIndex % 6 <= 4) {
        const blastY = 22;
        const blastWidth = canvas.width - (33 * pixelSize);
        const waveScale = Math.sin((Date.now() / 25)) * 6;
        
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = form.hairColor || form.primaryColor;

        ctx.fillStyle = form.auraColor;
        ctx.fillRect(
          33 * pixelSize,
          (blastY - 5) * pixelSize - waveScale / 2,
          blastWidth,
          10 * pixelSize + waveScale
        );

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(
          35 * pixelSize,
          (blastY - 2) * pixelSize,
          blastWidth,
          4 * pixelSize
        );
        ctx.restore();

        ctx.save();
        const shakeX = Math.round((Math.random() - 0.5) * 5);
        const shakeY = Math.round((Math.random() - 0.5) * 5);
        ctx.translate(shakeX, shakeY);
      }

      // Draw character frame
      drawOverclockFrame({
        ctx,
        ox: 0,
        oy: 0,
        pixelSize,
        animation,
        frameIndex,
        form,
        rageLevel,
        particles,
        smokeFrame,
        isTransforming,
        targetForm,
        transformProgress
      });

      if (animation === 'blast' && frameIndex % 6 >= 1 && frameIndex % 6 <= 4) {
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [form.id, animation, frameIndex, rageLevel, smokeFrame, isTransforming, targetForm, transformProgress]);

  if (compact) {
    return (
      <canvas
        ref={canvasRef}
        width={384}
        height={384}
        className="w-full h-full object-contain"
        style={{ imageRendering: 'pixelated' }}
      />
    )
  }

  return (
    <div className="relative flex items-center justify-center bg-radial from-[#1E293B]/60 to-[#0F172A] w-full max-w-[360px] aspect-square rounded-2xl border-4 border-[#334155] shadow-2xl overflow-hidden group">
      <canvas
        ref={canvasRef}
        width={384}
        height={384}
        id="overclock-live-viewport"
        className="w-full h-full object-contain"
        style={{ imageRendering: 'pixelated' }}
      />
      
      <div className="absolute top-2 left-2 flex gap-1 pointer-events-none">
        <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
        <span className="text-[9px] font-mono text-rose-500 font-bold">LIVE MATRIX RECR</span>
      </div>
      
      <div className="absolute bottom-2 right-3 font-mono text-[9px] text-[#475569] pointer-events-none select-none">
        GRID STATUS: DUAL_SYNC (48x48)
      </div>
    </div>
  );
};
