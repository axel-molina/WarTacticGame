import React, { useRef, useEffect, useState } from 'react';
import { Character, GridCell, GameState, Particle, ViewMode } from '../types';
import { getDistance, isCoverActive, calculateShot } from '../utils/gameEngine';
import { Shield, Heart, Zap, Crosshair, ChevronRight, Activity, RefreshCw, Trophy, Swords, RotateCcw, Bomb, ChevronsRight, Box, Compass } from 'lucide-react';

interface BattleCanvasProps {
  gameState: GameState;
  particles: Particle[];
  setParticles: React.Dispatch<React.SetStateAction<Particle[]>>;
  hoveredCell: { x: number; y: number } | null;
  setHoveredCell: (cell: { x: number; y: number } | null) => void;
  onCellClick: (x: number, y: number) => void;
  onSelectAction: (action: string | null) => void;
  onEndPlayerTurn: () => void;
  onToggleViewMode: () => void;
  onResetGame: () => void;
  onNextWave: () => void;
}

// Custom Class Avatar SVG and AP Diamond renderer for tactical console HUD
const renderClassAvatar = (charClass: string) => {
  let visorColor = '#38bdf8'; // assault = blue
  let accentColor = '#00f0ff';
  
  if (charClass === 'snipers') {
    visorColor = '#a855f7'; // purple
    accentColor = '#c084fc';
  } else if (charClass === 'medic') {
    visorColor = '#f43f5e'; // red/pink
    accentColor = '#fb7185';
  }

  return (
    <div className="relative border border-slate-800 bg-slate-950/60 p-1 rounded-lg shrink-0">
      <svg viewBox="0 0 100 100" className="w-16 h-16 md:w-[76px] md:h-[76px] drop-shadow-[0_0_8px_rgba(0,240,255,0.15)]">
        {/* Background circular tech grid */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="2 2" />
        <circle cx="50" cy="50" r="40" fill="rgba(15, 23, 42, 0.4)" stroke="#334155" strokeWidth="1" />
        
        {/* Helmet structure */}
        <path d="M25 65 C25 35, 75 35, 75 65 C75 75, 70 80, 50 82 C30 80, 25 75, 25 65 Z" fill="#0f172a" stroke="#475569" strokeWidth="2" />
        
        {/* Visor */}
        <path d="M32 50 Q50 42 68 50 Q68 58 50 62 Q32 58 32 50 Z" fill={visorColor} fillOpacity="0.45" stroke={accentColor} strokeWidth="2" />
        
        {/* Visor reflection highlight */}
        <path d="M36 50 Q50 45 64 50" fill="none" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.6" />
        
        {/* Respirator */}
        <rect x="45" y="66" width="10" height="12" rx="2" fill="#334155" stroke="#475569" strokeWidth="1" />
        <line x1="47" y1="70" x2="53" y2="70" stroke="#1e293b" strokeWidth="1" />
        <line x1="47" y1="73" x2="53" y2="73" stroke="#1e293b" strokeWidth="1" />
        <line x1="47" y1="76" x2="53" y2="76" stroke="#1e293b" strokeWidth="1" />
        
        {/* Ear pro */}
        <rect x="21" y="55" width="5" height="15" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        <rect x="74" y="55" width="5" height="15" rx="1" fill="#1e293b" stroke="#475569" strokeWidth="1" />
        
        {/* Corner brackets */}
        <path d="M10 25 L10 10 L25 10" fill="none" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.5" />
        <path d="M90 25 L90 10 L75 10" fill="none" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.5" />
        <path d="M10 75 L10 90 L25 90" fill="none" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.5" />
        <path d="M90 75 L90 90 L75 90" fill="none" stroke="#00f0ff" strokeWidth="1" strokeOpacity="0.5" />
      </svg>
      {/* Scanline overlay */}
      <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-20 rounded-lg"></div>
    </div>
  );
};

const renderAPDiamonds = (ap: number, maxAp: number) => {
  const diamonds = [];
  for (let i = 0; i < maxAp; i++) {
    if (i < ap) {
      diamonds.push(
        <span key={i} className="text-amber-400 font-extrabold text-[13px] leading-none drop-shadow-[0_0_6px_rgba(251,191,36,0.85)]" title="AP Disponible">◆</span>
      );
    } else {
      diamonds.push(
        <span key={i} className="text-slate-800 font-extrabold text-[13px] leading-none" title="AP Consumido">◇</span>
      );
    }
  }
  return <div className="flex items-center gap-1.5">{diamonds}</div>;
};

export const BattleCanvas: React.FC<BattleCanvasProps> = ({
  gameState,
  particles,
  setParticles,
  hoveredCell,
  setHoveredCell,
  onCellClick,
  onSelectAction,
  onEndPlayerTurn,
  onToggleViewMode,
  onResetGame,
  onNextWave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Camera State (Smoothed)
  const cameraRef = useRef({
    zoom: 1.0,
    angle: -Math.PI / 4, // 45 degree yaw
    pitch: 0.8,         // Tilt down
    centerX: 400,
    centerY: 250,
  });

  // Target Camera values
  const [cameraTarget, setCameraTarget] = useState({
    zoom: 1.0,
    angle: -Math.PI / 4,
    pitch: 0.8,
    centerX: 400,
    centerY: 250,
  });

  // Handle Resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.max(300, width);
        const h = Math.max(300, height);
        setDimensions({ width: w, height: h });
        setCameraTarget((prev) => ({
          ...prev,
          centerX: w / 2,
          centerY: h / 2 + 30,
        }));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Adjust camera targets - locked to isometric overview
  useEffect(() => {
    const { width, height } = dimensions;

    setCameraTarget({
      zoom: 0.95,
      angle: -Math.PI / 4,
      pitch: 0.8,
      centerX: width / 2,
      centerY: height / 2 + 20,
    });
  }, [dimensions]);

  // Handle canvas rendering and animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const cellSize = 55;
    const cellHeightStep = 25;

    // Camera values inside ref for instantaneous updates in animation loop
    const cam = cameraRef.current;

    // Helper: 3D to 2D projection
    const project = (x: number, y: number, z: number) => {
      // Centering coordinates relative to grid center (3,3)
      const x3d = (x - 3) * cellSize;
      const y3d = (y - 3) * cellSize;
      const z3d = z * cellHeightStep;

      // Rotate around Z axis (yaw / camera.angle)
      const xRot = x3d * Math.cos(cam.angle) - y3d * Math.sin(cam.angle);
      const yRot = x3d * Math.sin(cam.angle) + y3d * Math.cos(cam.angle);

      // Rotate around X axis (pitch / camera.pitch)
      const screenX = xRot * cam.zoom + cam.centerX;
      const screenY = (yRot * Math.cos(cam.pitch) - z3d) * cam.zoom + cam.centerY;

      return { x: screenX, y: screenY, depth: yRot }; // Depth used for painter's sorting
    };

    // Main render frame
    const render = () => {
      // Smoothly interpolate camera
      cam.zoom += (cameraTarget.zoom - cam.zoom) * 0.08;
      cam.angle += (cameraTarget.angle - cam.angle) * 0.08;
      cam.pitch += (cameraTarget.pitch - cam.pitch) * 0.08;
      cam.centerX += (cameraTarget.centerX - cam.centerX) * 0.08;
      cam.centerY += (cameraTarget.centerY - cam.centerY) * 0.08;

      ctx.clearRect(0, 0, dimensions.width, dimensions.height);

      // Draw background sky/ground gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, dimensions.height);
      skyGrad.addColorStop(0, '#0a0d16'); // Dark cosmic blue
      skyGrad.addColorStop(0.6, '#111827'); // Midnight gray
      skyGrad.addColorStop(1, '#1f2937'); // Warm dark gray
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Subtle tech details in background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let i = 0; i < dimensions.width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, dimensions.height);
        ctx.stroke();
      }

      // Gather elements to render and sort them by depth (painter's algorithm)
      interface Renderable {
        type: 'cell' | 'character' | 'cover' | 'particle';
        x: number; // grid x or exact x
        y: number; // grid y or exact y
        depth: number;
        data: any;
      }

      const renderables: Renderable[] = [];

      // Add cells & covers
      for (let x = 0; x < 7; x++) {
        for (let y = 0; y < 7; y++) {
          const cell = gameState.grid[x]?.[y];
          if (!cell) continue;

          const proj = project(x, y, cell.elevation);
          renderables.push({
            type: 'cell',
            x,
            y,
            depth: proj.depth,
            data: cell,
          });

          if (cell.coverType !== 'none') {
            // Place cover depth slightly in front of the cell center depending on its direction
            let dX = x;
            let dY = y;
            if (cell.coverDirection === 'N') dY -= 0.35;
            if (cell.coverDirection === 'S') dY += 0.35;
            if (cell.coverDirection === 'E') dX += 0.35;
            if (cell.coverDirection === 'W') dX -= 0.35;

            const covProj = project(dX, dY, cell.elevation);
            renderables.push({
              type: 'cover',
              x: dX,
              y: dY,
              depth: covProj.depth + 1, // Slightly higher depth so cover renders in front
              data: cell,
            });
          }
        }
      }

      // Add characters
      gameState.characters.forEach((char) => {
        if (char.isDead) return; // Don't draw live models for dead soldiers
        const proj = project(char.gridX, char.gridY, gameState.grid[char.gridX]?.[char.gridY]?.elevation || 0);
        renderables.push({
          type: 'character',
          x: char.gridX,
          y: char.gridY,
          depth: proj.depth + 5, // Characters stand above cells
          data: char,
        });
      });

      // Add 3D-space particles (bullets, smoke, beams)
      particles.forEach((part) => {
        if (part.type === 'floating_text') return; // Render UI text particles at the very end
        
        let pX = part.currentX;
        let pY = part.currentY;
        const proj = project(pX, pY, 0.3); // Slight elevation for bullets flying midair
        renderables.push({
          type: 'particle',
          x: pX,
          y: pY,
          depth: proj.depth + 2,
          data: part,
        });
      });

      // Sort by depth (lowest depth gets rendered first, which is background-most)
      renderables.sort((a, b) => a.depth - b.depth);

      // Helper: Draw 3D Iso Box
      const drawIsoBox = (
        gridX: number,
        gridY: number,
        elevation: number,
        height: number,
        topColor: string,
        leftColor: string,
        rightColor: string,
        isHighlighted: boolean = false,
        isPath: boolean = false,
        isTarget: boolean = false,
        isHealTarget: boolean = false
      ) => {
        const topProj = project(gridX, gridY, elevation);
        const pt1 = project(gridX - 0.5, gridY - 0.5, elevation);
        const pt2 = project(gridX + 0.5, gridY - 0.5, elevation);
        const pt3 = project(gridX + 0.5, gridY + 0.5, elevation);
        const pt4 = project(gridX - 0.5, gridY + 0.5, elevation);

        const b1 = project(gridX - 0.5, gridY - 0.5, elevation - height);
        const b2 = project(gridX + 0.5, gridY - 0.5, elevation - height);
        const b3 = project(gridX + 0.5, gridY + 0.5, elevation - height);
        const b4 = project(gridX - 0.5, gridY + 0.5, elevation - height);

        // Define stroke outline colors
        let outlineColor = 'rgba(255, 255, 255, 0.1)';
        let fillTop = topColor;

        if (isHighlighted) {
          outlineColor = '#38bdf8'; // Glowing light blue
          fillTop = 'rgba(56, 189, 248, 0.35)';
        } else if (isPath) {
          outlineColor = '#10b981'; // Green path glow
          fillTop = 'rgba(16, 185, 129, 0.25)';
        } else if (isTarget) {
          outlineColor = '#ef4444'; // Red target glow
          fillTop = 'rgba(239, 68, 68, 0.35)';
        } else if (isHealTarget) {
          outlineColor = '#10b981';
          fillTop = 'rgba(16, 185, 129, 0.35)';
        }

        // Top Face
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.lineTo(pt3.x, pt3.y);
        ctx.lineTo(pt4.x, pt4.y);
        ctx.closePath();
        ctx.fillStyle = fillTop;
        ctx.fill();
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = isHighlighted || isPath || isTarget ? 2 : 1;
        ctx.stroke();

        // If high ground or elevated block, draw side faces
        if (elevation > 0) {
          // Left Face
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt4.x, pt4.y);
          ctx.lineTo(b4.x, b4.y);
          ctx.lineTo(b1.x, b1.y);
          ctx.closePath();
          ctx.fillStyle = leftColor;
          ctx.fill();
          ctx.stroke();

          // Right Face
          ctx.beginPath();
          ctx.moveTo(pt4.x, pt4.y);
          ctx.lineTo(pt3.x, pt3.y);
          ctx.lineTo(b3.x, b3.y);
          ctx.lineTo(b4.x, b4.y);
          ctx.closePath();
          ctx.fillStyle = rightColor;
          ctx.fill();
          ctx.stroke();
        }
      };

      // Draw each renderable sorted
      renderables.forEach((item) => {
        if (item.type === 'cell') {
          const cell: GridCell = item.data;
          
          // Check visual state
          const isSelectedCharCell = gameState.activeCharacterId 
            ? gameState.characters.find(c => c.id === gameState.activeCharacterId)?.gridX === cell.x &&
              gameState.characters.find(c => c.id === gameState.activeCharacterId)?.gridY === cell.y
            : false;

          const isHovered = hoveredCell?.x === cell.x && hoveredCell?.y === cell.y;
          
          // Determine path reachability
          let isReachablePath = false;
          let isShootTarget = false;
          let isHealTarget = false;

          const activeChar = gameState.characters.find(c => c.id === gameState.activeCharacterId);

          if (activeChar && !activeChar.isDead && activeChar.ap > 0 && gameState.turnOwner === 'player') {
            if (gameState.selectedAction === 'move') {
              // Calculate if reachable
              const maxRange = activeChar.ap;
              const dist = getDistance(activeChar.gridX, activeChar.gridY, cell.x, cell.y);
              if (dist <= maxRange && dist > 0) {
                // Not occupied by someone alive
                const isOccupied = gameState.characters.some(c => !c.isDead && c.gridX === cell.x && c.gridY === cell.y);
                if (!isOccupied) isReachablePath = true;
              }
            } else if (gameState.selectedAction === 'shoot') {
              // Highlight cell of any alive enemy
              const targetChar = gameState.characters.find(c => !c.isDead && c.isEnemy && c.gridX === cell.x && c.gridY === cell.y);
              if (targetChar) isShootTarget = true;
            } else if (gameState.selectedAction === 'heal') {
              // Highlight cell of any player teammate (can be injured)
              const targetChar = gameState.characters.find(c => !c.isDead && !c.isEnemy && c.gridX === cell.x && c.gridY === cell.y);
              if (targetChar && getDistance(activeChar.gridX, activeChar.gridY, cell.x, cell.y) <= 3) isHealTarget = true;
            } else if (gameState.selectedAction === 'grenade') {
              // Highlight cells in splash radius around hovered cell
              if (hoveredCell) {
                const splashDist = getDistance(hoveredCell.x, hoveredCell.y, cell.x, cell.y);
                if (splashDist <= 1 && getDistance(activeChar.gridX, activeChar.gridY, hoveredCell.x, hoveredCell.y) <= 5) {
                  isShootTarget = true;
                }
              }
            }
          }

          // Elevation colors
          const bColor = cell.elevation > 0 ? '#1f2937' : '#111827';
          const lColor = '#1a2230';
          const rColor = '#141b25';

          drawIsoBox(
            cell.x,
            cell.y,
            cell.elevation,
            cell.elevation,
            bColor,
            lColor,
            rColor,
            isHovered || isSelectedCharCell,
            isReachablePath,
            isShootTarget,
            isHealTarget
          );

          // Draw coordinates text for debug/prototyping (humble tech overlay)
          if (cam.zoom > 1.2) {
            const labelProj = project(cell.x, cell.y, cell.elevation);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`${cell.x},${cell.y}`, labelProj.x, labelProj.y + 4);
          }
        }

        else if (item.type === 'cover') {
          // Render cover barrier as 3D block
          const cell: GridCell = item.data;
          const proj = project(item.x, item.y, cell.elevation);
          
          // Draw a small 3D wedge/brick representing a sandbag/wall
          const thickness = 0.12;
          const length = 0.6;
          const height = cell.coverType === 'full' ? 0.6 : 0.35;

          const color = cell.coverType === 'full' ? '#4b5563' : '#6b7280'; // Darker grey for heavy walls
          const outline = '#9ca3af';

          // sandbags/barrier vertices
          let offsetPt1, offsetPt2;
          if (cell.coverDirection === 'N' || cell.coverDirection === 'S') {
            offsetPt1 = project(item.x - length/2, item.y, cell.elevation + height);
            offsetPt2 = project(item.x + length/2, item.y, cell.elevation + height);
          } else {
            offsetPt1 = project(item.x, item.y - length/2, cell.elevation + height);
            offsetPt2 = project(item.x, item.y + length/2, cell.elevation + height);
          }

          ctx.beginPath();
          ctx.moveTo(offsetPt1.x, offsetPt1.y);
          ctx.lineTo(offsetPt2.x, offsetPt2.y);
          ctx.strokeStyle = outline;
          ctx.lineWidth = 4 * cam.zoom;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Fill simple solid color
          ctx.fillStyle = color;
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(cell.coverType === 'full' ? '▌██▌' : '▌█▌', proj.x, proj.y - 10 * cam.zoom);
        }

        else if (item.type === 'character') {
          const char: Character = item.data;
          const elevation = gameState.grid[char.gridX]?.[char.gridY]?.elevation || 0;
          const proj = project(char.gridX, char.gridY, elevation);

          const isCurrentActive = char.id === gameState.activeCharacterId;
          const radius = 13 * cam.zoom;

          // Animated hover bounce
          const bounce = isCurrentActive ? Math.sin(Date.now() * 0.005) * 4 : 0;

          // Draw Character Base Ring
          ctx.beginPath();
          ctx.ellipse(proj.x, proj.y, radius, radius * 0.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = char.isEnemy ? 'rgba(239, 68, 68, 0.15)' : 'rgba(14, 165, 233, 0.15)';
          ctx.fill();
          ctx.strokeStyle = char.isEnemy ? '#ef4444' : '#0ea5e9';
          ctx.lineWidth = isCurrentActive ? 2.5 : 1;
          ctx.stroke();

          // Draw facing indicator arrow
          let faceDx = 0;
          let faceDy = 0;
          if (char.facing === 'N') faceDy = -0.5;
          if (char.facing === 'S') faceDy = 0.5;
          if (char.facing === 'E') faceDx = 0.5;
          if (char.facing === 'W') faceDx = -0.5;

          const arrowProj = project(char.gridX + faceDx * 0.4, char.gridY + faceDy * 0.4, elevation);
          ctx.beginPath();
          ctx.moveTo(proj.x, proj.y);
          ctx.lineTo(arrowProj.x, arrowProj.y);
          ctx.strokeStyle = char.isEnemy ? '#f87171' : '#38bdf8';
          ctx.lineWidth = 2 * cam.zoom;
          ctx.stroke();

          // Draw Character 3D-Like Cylinder (representing military armor capsule)
          const charHeight = 26 * cam.zoom;
          const charY = proj.y + bounce - charHeight;

          // Base of cylinder
          ctx.beginPath();
          ctx.ellipse(proj.x, proj.y + bounce, radius * 0.8, radius * 0.4, 0, 0, Math.PI * 2);
          ctx.fillStyle = char.isEnemy ? '#7f1d1d' : '#0369a1';
          ctx.fill();

          // Body of cylinder
          ctx.beginPath();
          ctx.moveTo(proj.x - radius * 0.8, proj.y + bounce);
          ctx.lineTo(proj.x - radius * 0.8, charY);
          ctx.ellipse(proj.x, charY, radius * 0.8, radius * 0.4, 0, Math.PI, 0, false);
          ctx.lineTo(proj.x + radius * 0.8, proj.y + bounce);
          ctx.ellipse(proj.x, proj.y + bounce, radius * 0.8, radius * 0.4, 0, 0, Math.PI, false);
          ctx.closePath();

          const capGrad = ctx.createLinearGradient(proj.x - radius, proj.y, proj.x + radius, proj.y);
          if (char.isEnemy) {
            capGrad.addColorStop(0, '#ef4444');
            capGrad.addColorStop(0.5, '#b91c1c');
            capGrad.addColorStop(1, '#7f1d1d');
          } else {
            if (char.class === 'assault') {
              capGrad.addColorStop(0, '#38bdf8');
              capGrad.addColorStop(0.5, '#0284c7');
              capGrad.addColorStop(1, '#0c4a6e');
            } else if (char.class === 'snipers') {
              capGrad.addColorStop(0, '#10b981');
              capGrad.addColorStop(0.5, '#047857');
              capGrad.addColorStop(1, '#064e3b');
            } else { // medic
              capGrad.addColorStop(0, '#f43f5e');
              capGrad.addColorStop(0.5, '#e11d48');
              capGrad.addColorStop(1, '#881337');
            }
          }
          ctx.fillStyle = capGrad;
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.5;
          ctx.stroke();

          // Cylindrical Cap (top of the capsule)
          ctx.beginPath();
          ctx.ellipse(proj.x, charY, radius * 0.8, radius * 0.4, 0, 0, Math.PI * 2);
          ctx.fillStyle = char.isEnemy ? '#fca5a5' : '#bae6fd';
          ctx.fill();
          ctx.stroke();

          // Draw Soldier "Visor" / Eyes (Tech glow)
          ctx.beginPath();
          // Angle of visor depends on where they are looking
          let visorOffset = 0;
          if (char.facing === 'S') visorOffset = 1;
          if (char.facing === 'E') visorOffset = 4;
          if (char.facing === 'W') visorOffset = -4;
          if (char.facing === 'N') visorOffset = -1;

          ctx.ellipse(proj.x + visorOffset * cam.zoom, charY + 5 * cam.zoom, radius * 0.5, radius * 0.15, 0, 0, Math.PI * 2);
          ctx.fillStyle = char.isEnemy ? '#ef4444' : '#38bdf8';
          ctx.shadowColor = char.isEnemy ? '#ef4444' : '#38bdf8';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0; // reset

          // Draw Special Emblems
          if (char.class === 'medic') {
            // Draw a tiny white circle and red cross on top
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(proj.x, charY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(proj.x - 3, charY - 0.7, 6, 1.4);
            ctx.fillRect(proj.x - 0.7, charY - 3, 1.4, 6);
          } else if (char.class === 'snipers') {
            // Draw scope crosshair dots on cap
            ctx.fillStyle = '#059669';
            ctx.fillRect(proj.x - 3, charY - 0.5, 6, 1);
            ctx.fillRect(proj.x - 0.5, charY - 3, 1, 6);
          }

          // Draw HUD / Healthbar directly above character (Concept Art Inspired Nameplates)
          const hudY = charY - 14 * cam.zoom;
          const barWidth = 42 * cam.zoom;
          const barHeight = 4.0 * cam.zoom;

          // 1. Label Text (e.g. "ASALTO" or "ALIEN")
          ctx.fillStyle = char.isEnemy ? '#fca5a5' : '#bae6fd';
          ctx.font = `bold ${Math.round(8.5 * cam.zoom)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'left';
          
          let classNameLabel = 'ALIEN';
          if (!char.isEnemy) {
            classNameLabel = char.class === 'snipers' ? 'SNIPER' : char.class === 'assault' ? 'ASALTO' : 'MÉDICO';
          } else {
            classNameLabel = char.class === 'enemy_trooper' ? 'ALIEN' : char.class === 'enemy_ranger' ? 'PLASMA' : 'HEAVY';
          }
          ctx.fillText(classNameLabel, proj.x - barWidth / 2, hudY - 4 * cam.zoom);

          // 2. HP Values (e.g. "100/100" or "80/80") on the right side of the label
          ctx.fillStyle = '#94a3b8';
          ctx.font = `${Math.round(8 * cam.zoom)}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'right';
          ctx.fillText(`${char.hp}/${char.maxHp}`, proj.x + barWidth / 2, hudY - 4 * cam.zoom);

          // 3. HP Bar Background
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.fillRect(proj.x - barWidth / 2, hudY, barWidth, barHeight);
          
          // 4. HP Bar Fill (Vibrant green/red as in concept)
          const hpPercent = Math.max(0, Math.min(1, char.hp / char.maxHp));
          ctx.fillStyle = char.isEnemy ? '#ef4444' : '#22c55e';
          ctx.fillRect(proj.x - barWidth / 2, hudY, barWidth * hpPercent, barHeight);

          // 5. Shield Fill (if any, blue bar underneath)
          if (char.shield > 0) {
            const shieldPercent = char.shield / char.maxShield;
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(proj.x - barWidth / 2, hudY + barHeight + 1.5 * cam.zoom, barWidth * shieldPercent, 1.5 * cam.zoom);
          }

          // Ammo Dots (Pips) below
          if (char.maxAmmo > 0 && !char.isEnemy) {
            const pipSize = 1.8 * cam.zoom;
            const pipSpacing = 3 * cam.zoom;
            const totalWidth = (char.maxAmmo - 1) * pipSpacing;
            for (let a = 0; a < char.maxAmmo; a++) {
              const pipX = proj.x - totalWidth / 2 + a * pipSpacing;
              ctx.beginPath();
              ctx.arc(pipX, hudY + barHeight + (char.shield > 0 ? 5.5 : 3.5) * cam.zoom, pipSize * 0.8, 0, Math.PI * 2);
              if (a < char.ammo) {
                ctx.fillStyle = '#f59e0b';
                ctx.fill();
              } else {
                ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            }
          }
        }

        else if (item.type === 'particle') {
          // Render a single particle in 3D projection space
          const part: Particle = item.data;
          const proj = project(part.currentX, part.currentY, 0.3);

          ctx.beginPath();
          if (part.type === 'bullet') {
            ctx.arc(proj.x, proj.y, part.size * cam.zoom, 0, Math.PI * 2);
            ctx.fillStyle = part.color;
            ctx.shadowColor = part.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          } else if (part.type === 'laser') {
            // Draw glowing laser tracer from start to end
            const pStart = project(part.startX!, part.startY!, 0.45);
            const pEnd = project(part.endX!, part.endY!, 0.45);

            ctx.beginPath();
            ctx.moveTo(pStart.x, pStart.y);
            ctx.lineTo(pEnd.x, pEnd.y);
            ctx.strokeStyle = part.color;
            ctx.lineWidth = part.size * cam.zoom * part.life; // gets thinner over life
            ctx.shadowColor = part.color;
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.shadowBlur = 0;
          } else if (part.type === 'explosion') {
            // Radial expansion circle
            const pRadius = part.size * cam.zoom * (1 - part.life);
            ctx.ellipse(proj.x, proj.y, pRadius, pRadius * 0.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = part.color;
            ctx.fill();
          } else if (part.type === 'heal' || part.type === 'smoke' || part.type === 'debris') {
            ctx.arc(proj.x, proj.y, part.size * cam.zoom * part.life, 0, Math.PI * 2);
            ctx.fillStyle = part.color;
            ctx.fill();
          }
        }
      });

      // Render floating screen UI text particles (damage, misses, etc) at the absolute top layer
      particles.forEach((part) => {
        if (part.type !== 'floating_text') return;
        
        // Floating text takes currentX and currentY directly in grid coordinates
        const proj = project(part.currentX, part.currentY, 1.2); // Positioned high above cells
        ctx.fillStyle = part.color;
        ctx.font = `bold ${Math.round(part.size * cam.zoom)}px "JetBrains Mono", monospace`;
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.textAlign = 'center';
        
        // Animate floating text moving upwards on screen
        const screenY = proj.y - (1 - part.life) * 35; 
        ctx.fillText(part.text || '', proj.x, screenY);
        ctx.shadowBlur = 0;
      });

      // Draw standard tech frame overlays on the canvas edges (Aesthetic tactical overlays)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1.5;
      
      // Corners
      const gap = 15;
      // Top Left
      ctx.beginPath();
      ctx.moveTo(gap, gap + 20); ctx.lineTo(gap, gap); ctx.lineTo(gap + 20, gap);
      ctx.stroke();
      // Top Right
      ctx.beginPath();
      ctx.moveTo(dimensions.width - gap, gap + 20); ctx.lineTo(dimensions.width - gap, gap); ctx.lineTo(dimensions.width - gap - 20, gap);
      ctx.stroke();
      // Bottom Left
      ctx.beginPath();
      ctx.moveTo(gap, dimensions.height - gap - 20); ctx.lineTo(gap, dimensions.height - gap); ctx.lineTo(gap + 20, dimensions.height - gap);
      ctx.stroke();
      // Bottom Right
      ctx.beginPath();
      ctx.moveTo(dimensions.width - gap, dimensions.height - gap - 20); ctx.lineTo(dimensions.width - gap, dimensions.height - gap); ctx.lineTo(dimensions.width - gap - 20, dimensions.height - gap);
      ctx.stroke();

      // Top Header label
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`CAMARA_MODO: ${gameState.viewMode.toUpperCase()}`, gap + 25, gap + 10);
      
      // Zoom and rotation
      ctx.textAlign = 'right';
      ctx.fillText(`YAW: ${Math.round(cam.angle * 180 / Math.PI)}° | ZOOM: ${cam.zoom.toFixed(2)}x`, dimensions.width - gap - 25, gap + 10);

      // Handle Particle decay inside loop
      setParticles((prevParticles) => {
        return prevParticles
          .map((p) => {
            let nextX = p.currentX;
            let nextY = p.currentY;

            // Update positions
            if (p.velocity) {
              nextX += p.velocity.x;
              nextY += p.velocity.y;
            } else if (p.startX !== undefined && p.endX !== undefined) {
              // Interpolation for path particles
              const t = 1 - (p.life - (1 / p.maxLife));
              nextX = p.startX + (p.endX - p.startX) * t;
              nextY = p.startY! + (p.endY! - p.startY!) * t;
            }

            return {
              ...p,
              currentX: nextX,
              currentY: nextY,
              life: p.life - (1 / p.maxLife),
            };
          })
          .filter((p) => p.life > 0);
      });

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [cameraTarget, dimensions, gameState, particles, hoveredCell, setParticles]);

  // Click Handler with Grid coordinate detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Project all cells and find the closest one
    let closestCell: GridCell | null = null;
    let minDistance = 28; // Click tolerance radius in pixels

    const cellSize = 55;
    const cellHeightStep = 25;
    const cam = cameraRef.current;

    const project = (x: number, y: number, z: number) => {
      const x3d = (x - 3) * cellSize;
      const y3d = (y - 3) * cellSize;
      const z3d = z * cellHeightStep;
      const xRot = x3d * Math.cos(cam.angle) - y3d * Math.sin(cam.angle);
      const yRot = x3d * Math.sin(cam.angle) + y3d * Math.cos(cam.angle);
      const screenX = xRot * cam.zoom + cam.centerX;
      const screenY = (yRot * Math.cos(cam.pitch) - z3d) * cam.zoom + cam.centerY;
      return { x: screenX, y: screenY };
    };

    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 7; y++) {
        const cell = gameState.grid[x]?.[y];
        if (!cell) continue;

        const proj = project(x, y, cell.elevation);
        const dist = Math.hypot(mouseX - proj.x, mouseY - proj.y);

        if (dist < minDistance) {
          minDistance = dist;
          closestCell = cell;
        }
      }
    }

    if (closestCell) {
      onCellClick(closestCell.x, closestCell.y);
    }
  };

  // Mouse Move Handler for Hover state
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestCell: { x: number; y: number } | null = null;
    let minDistance = 32;

    const cellSize = 55;
    const cellHeightStep = 25;
    const cam = cameraRef.current;

    const project = (x: number, y: number, z: number) => {
      const x3d = (x - 3) * cellSize;
      const y3d = (y - 3) * cellSize;
      const z3d = z * cellHeightStep;
      const xRot = x3d * Math.cos(cam.angle) - y3d * Math.sin(cam.angle);
      const yRot = x3d * Math.sin(cam.angle) + y3d * Math.cos(cam.angle);
      const screenX = xRot * cam.zoom + cam.centerX;
      const screenY = (yRot * Math.cos(cam.pitch) - z3d) * cam.zoom + cam.centerY;
      return { x: screenX, y: screenY };
    };

    for (let x = 0; x < 7; x++) {
      for (let y = 0; y < 7; y++) {
        const cell = gameState.grid[x]?.[y];
        if (!cell) continue;

        const proj = project(x, y, cell.elevation);
        const dist = Math.hypot(mouseX - proj.x, mouseY - proj.y);

        if (dist < minDistance) {
          minDistance = dist;
          closestCell = { x: cell.x, y: cell.y };
        }
      }
    }

    if (closestCell) {
      if (!hoveredCell || hoveredCell.x !== closestCell.x || hoveredCell.y !== closestCell.y) {
        setHoveredCell(closestCell);
      }
    } else {
      if (hoveredCell !== null) {
        setHoveredCell(null);
      }
    }
  };

  const handleCanvasMouseLeave = () => {
    setHoveredCell(null);
  };

  // Quick Action / Class portraits calculations to show hover hit breakdown in upper right overlay
  const getHoverBreakdownText = () => {
    if (!hoveredCell) return null;
    const activeChar = gameState.characters.find(c => c.id === gameState.activeCharacterId);
    if (!activeChar || activeChar.isDead || gameState.selectedAction !== 'shoot') return null;

    const targetChar = gameState.characters.find(c => !c.isDead && c.isEnemy && c.gridX === hoveredCell.x && c.gridY === hoveredCell.y);
    if (!targetChar) return null;

    const shot = calculateShot(activeChar, targetChar, gameState.grid);

    return (
      <div className="absolute top-4 right-4 bg-slate-900/90 border border-sky-500/30 p-3 rounded-lg text-xs font-mono text-slate-300 w-52 shadow-xl backdrop-blur">
        <div className="text-sky-400 font-bold mb-1 border-b border-sky-500/20 pb-1">ANÁLISIS DE TIRO</div>
        <div>Objetivo: <span className="text-red-400 font-semibold">{targetChar.name.split(' ')[0]}</span></div>
        <div className="flex justify-between mt-1">
          <span>Precisión Base:</span>
          <span>{shot.baseAccuracy}%</span>
        </div>
        <div className={`flex justify-between ${shot.rangeModifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          <span>Mod. Distancia ({shot.distance}m):</span>
          <span>{shot.rangeModifier >= 0 ? `+${shot.rangeModifier}` : shot.rangeModifier}%</span>
        </div>
        <div className={`flex justify-between ${shot.coverModifier === 0 ? 'text-slate-400' : 'text-red-400'}`}>
          <span>Mod. Cobertura:</span>
          <span>{shot.coverModifier === 0 ? 'Ninguna' : `${shot.coverModifier}%`}</span>
        </div>
        <div className={`flex justify-between ${shot.elevationModifier >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          <span>Mod. Altura:</span>
          <span>{shot.elevationModifier >= 0 ? `+${shot.elevationModifier}` : shot.elevationModifier}%</span>
        </div>
        <div className="border-t border-slate-700 my-1 pt-1 flex justify-between text-white font-bold">
          <span>PROBABILIDAD:</span>
          <span className="text-sky-400 text-sm">{shot.finalAccuracy}%</span>
        </div>
        <div className="flex justify-between text-white">
          <span>DAÑO ESPERADO:</span>
          <span className="text-red-400">{shot.finalDamage} HP</span>
        </div>
        {shot.isCoverActive && (
          <div className="text-[10px] text-amber-400 mt-1 flex items-center justify-center bg-amber-500/10 p-1 rounded">
            🛡️ Cobertura Activa ({shot.coverType === 'full' ? 'Completa' : 'Parcial'})
          </div>
        )}
      </div>
    );
  };

  const activeChar = gameState.characters.find(c => c.id === gameState.activeCharacterId);
  const enemySquad = gameState.characters.filter(c => c.isEnemy);
  const enemiesAliveCount = enemySquad.filter(e => !e.isDead).length;

  return (
    <div ref={containerRef} className="relative w-full h-[520px] md:h-[650px] border border-slate-700 rounded-xl overflow-hidden bg-slate-950 shadow-2xl flex flex-col group select-none">
      
      {/* 1. TOP BAR HUD (Absolute Overlay - Concept Art Inspired) */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-slate-950/95 via-slate-950/85 to-transparent backdrop-blur-[1px] flex flex-col md:flex-row justify-between items-start md:items-center gap-3 z-10 font-mono select-none">
        {/* Left Side: Brand, Title, Ronda & Hostiles Pill badges */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="bg-sky-500/10 border border-sky-500/30 p-1.5 rounded-lg text-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.15)]">
              <Swords size={18} className="animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-[13px] md:text-[14px] text-white tracking-widest leading-none uppercase">
                TACTICAL SQUAD COMBAT MVP
              </h1>
              <p className="text-[8px] md:text-[9px] text-sky-500/80 font-bold tracking-wider mt-0.5">
                SISTEMA DE PRUEBA DE MECÁNICA – VERSIÓN MVP
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-0.5">
            <span className="bg-slate-950/95 border border-slate-800 text-slate-300 font-extrabold px-2.5 py-0.5 rounded text-[9px] uppercase tracking-wider shadow-sm">
              RONDA {gameState.stats.turns || 1}
            </span>
            <span className="bg-red-950/80 border border-red-500/40 text-red-400 font-extrabold px-2.5 py-0.5 rounded text-[9px] uppercase tracking-wider shadow-sm flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></span>
              HOSTILES ACTIVOS: {enemiesAliveCount}
            </span>
          </div>
        </div>

        {/* Right Side: High Fidelity 4-Panel Stats */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <div className="bg-slate-950/90 border border-slate-800/80 px-3 py-1.5 rounded-md flex flex-col min-w-[85px] md:min-w-[100px] text-left">
            <span className="text-[7px] text-slate-500 font-extrabold uppercase tracking-wider">DAÑO INFLIGIDO</span>
            <span className="text-[11px] md:text-xs font-black text-green-400 font-mono tracking-tight">
              {gameState.stats.damageDealt || 0} HP
            </span>
          </div>
          <div className="bg-slate-950/90 border border-slate-800/80 px-3 py-1.5 rounded-md flex flex-col min-w-[85px] md:min-w-[100px] text-left">
            <span className="text-[7px] text-slate-500 font-extrabold uppercase tracking-wider">DAÑO RECIBIDO</span>
            <span className="text-[11px] md:text-xs font-black text-red-400 font-mono tracking-tight">
              {gameState.stats.damageTaken || 0} HP
            </span>
          </div>
          <div className="bg-slate-950/90 border border-slate-800/80 px-3 py-1.5 rounded-md flex flex-col min-w-[85px] md:min-w-[100px] text-left">
            <span className="text-[7px] text-slate-500 font-extrabold uppercase tracking-wider">ALIENÍGENAS K.O.</span>
            <span className="text-[11px] md:text-xs font-black text-amber-500 font-mono tracking-tight">
              {gameState.stats.kills || 0}
            </span>
          </div>
          <div className="bg-slate-950/90 border border-slate-800/80 px-3 py-1.5 rounded-md flex flex-col min-w-[85px] md:min-w-[100px] text-left">
            <span className="text-[7px] text-slate-500 font-extrabold uppercase tracking-wider">PRECISIÓN MEDIA</span>
            <span className="text-[11px] md:text-xs font-black text-sky-400 font-mono tracking-tight">
              {gameState.stats.shotsFired > 0 
                ? `${Math.round((gameState.stats.shotsHit / gameState.stats.shotsFired) * 100)}%`
                : '100%'}
            </span>
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        onMouseLeave={handleCanvasMouseLeave}
        className="block w-full h-full cursor-crosshair"
      />
      
      {/* Target hit-breakdown overlay */}
      {getHoverBreakdownText()}

      {/* Left Side Floating HUD panels (Concept Art Inspired) */}
      <div className="absolute top-[105px] left-4 z-10 flex flex-col gap-3 max-w-[210px] hidden md:flex font-mono pointer-events-none select-none">
        {/* COMANDANTE Panel */}
        <div className="bg-slate-950/85 border border-slate-800/80 p-3 rounded-lg flex flex-col gap-1.5 backdrop-blur-md shadow-xl pointer-events-auto">
          <div className="flex items-center gap-1.5 text-sky-400 font-extrabold text-[10px] uppercase tracking-wider border-b border-sky-950/50 pb-1">
            <Shield size={11} className="text-sky-400" />
            <span>COMANDANTE</span>
          </div>
          <p className="text-[9.5px] text-slate-400 leading-relaxed font-sans font-medium">
            Planifica el avance táctico haciendo clic directamente en tu pelotón sobre la cuadrícula.
          </p>
        </div>

        {/* LEYENDA Panel */}
        <div className="bg-slate-950/85 border border-slate-800/80 p-3 rounded-lg flex flex-col gap-2 backdrop-blur-md shadow-xl pointer-events-auto">
          <div className="text-slate-300 font-extrabold text-[10px] uppercase tracking-wider border-b border-slate-800 pb-1 flex items-center gap-1">
            <Compass size={11} className="text-slate-400" />
            <span>LEYENDA</span>
          </div>
          <div className="flex flex-col gap-1.5 text-[9px] text-slate-400">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 border border-slate-700 bg-[#111827]"></span>
              <span>Terreno Estándar</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 border border-[#38bdf8] bg-[#1f2937]"></span>
              <span>Terreno Elevado (+15% Ac.)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-2.5 h-2.5 bg-slate-900 border border-slate-700 rounded-sm">
                <span className="w-1.5 h-[1px] bg-slate-400"></span>
              </div>
              <span>Muro / Trinchera (Parapeto)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 border border-[#ef4444] bg-[#ef4444]/20 animate-pulse"></span>
              <span>Zona de Ataque / Explosión</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GAME STATUS FULL SCREEN OVERLAY */}
      {gameState.gameStatus !== 'playing' && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-20 text-center p-6 animate-fade-in">
          <span className="text-5xl animate-bounce">
            {gameState.gameStatus === 'victory' ? '🏆' : '💀'}
          </span>
          <h4 className="font-bold font-mono text-xl md:text-2xl text-white tracking-tight">
            {gameState.gameStatus === 'victory' ? '¡VICTORIA DEL ESCUADRÓN!' : '¡ESCUPIDAS DE ALIEN, DERROTA!'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md font-mono leading-relaxed">
            {gameState.gameStatus === 'victory' 
              ? `Has aniquilado las fuerzas alienígenas en la oleada ${gameState.wave}. Tus tácticas han salvado al escuadrón.` 
              : 'Todos tus soldados han caído en combate. Rediseña tus tácticas de cobertura y vuelve a intentarlo.'}
          </p>
          <div className="flex gap-3 mt-2">
            <button 
              onClick={onResetGame}
              className="bg-sky-500 hover:bg-sky-600 font-mono text-xs font-bold text-slate-950 px-5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw size={14} />
              Jugar de Nuevo
            </button>
            {gameState.gameStatus === 'victory' && (
              <button 
                onClick={onNextWave}
                className="bg-green-500 hover:bg-green-600 font-mono text-xs font-bold text-slate-950 px-5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 transition-all cursor-pointer"
              >
                <Trophy size={14} />
                Siguiente Oleada
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. ENEMY TURN FLOATING BAR */}
      {gameState.gameStatus === 'playing' && gameState.turnOwner === 'enemy' && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-red-950/90 border-t border-red-800/80 backdrop-blur-md flex flex-col items-center justify-center gap-2 z-10 text-center animate-pulse">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
            <span className="text-xs font-bold font-mono text-red-400 uppercase tracking-widest">TURNO ENEMIGO EN CURSO...</span>
          </div>
          <span className="text-[10px] font-mono text-red-500">Los alienígenas se mueven y atacan. Prepárate.</span>
        </div>
      )}

      {/* VISTA ISOMÉTRICA card on the right, floating above bottom HUD */}
      <div className="absolute bottom-[135px] right-4 bg-slate-950/95 border border-slate-800/80 p-2.5 rounded-lg flex items-center justify-between gap-3 text-left shadow-xl font-mono select-none pointer-events-auto z-10 min-w-[130px]">
        <div>
          <div className="text-[7.5px] text-slate-500 font-extrabold tracking-widest uppercase">VISTA</div>
          <div className="text-[10px] font-extrabold text-sky-400 tracking-wider uppercase">ISOMÉTRICA</div>
        </div>
        <div className="text-sky-400 bg-sky-950/40 border border-sky-800/60 p-1.5 rounded">
          <Box size={14} className="animate-pulse" />
        </div>
      </div>

      {/* 4. ACTIVE CHARACTER CONTROL BAR (Concept Art Inspired Console) */}
      {gameState.gameStatus === 'playing' && gameState.turnOwner === 'player' && (
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-[#070b0e]/95 border-t border-slate-800/90 backdrop-blur-md z-10 select-none flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between font-mono">
          
          {/* A. LEFT PORTRAIT & STATS (Cols 1-4 concept) */}
          <div className="flex items-center gap-3 bg-[#0d131a] border border-slate-800/60 p-2.5 rounded-xl min-w-[280px] max-w-[340px] shadow-inner relative overflow-hidden shrink-0">
            {activeChar ? (
              <>
                {/* Custom Helmet Avatar */}
                {renderClassAvatar(activeChar.class)}

                {/* Right stats columns */}
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest bg-sky-950/50 border border-sky-900/60 px-1.5 py-0.5 rounded leading-none shrink-0">
                      {activeChar.class === 'snipers' ? 'FRANCO' : activeChar.class === 'assault' ? 'ASALTO' : 'MÉDICO'}
                    </span>
                    <span className="text-[9px] font-extrabold text-slate-500 ml-auto shrink-0 uppercase tracking-widest">NVL 1</span>
                  </div>
                  
                  <div className="text-[11px] font-black text-white truncate uppercase tracking-wider leading-tight" title={activeChar.name}>
                    {activeChar.name}
                  </div>

                  {/* XP Bar placeholder matching design */}
                  <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden mb-1 border border-slate-800/50">
                    <div className="bg-sky-400/70 h-full w-[15%]" />
                  </div>

                  {/* Heart / HP Progress block */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex justify-between items-center text-[8px] text-slate-400 font-bold">
                      <span className="flex items-center gap-0.5 text-red-400"><Heart size={8} fill="currentColor" /> HP</span>
                      <span className="text-red-300 font-mono">{activeChar.hp}/{activeChar.maxHp}</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2.5 rounded-md overflow-hidden p-[1px] border border-slate-900">
                      <div 
                        className="bg-gradient-to-r from-red-600 to-red-500 h-full rounded-sm transition-all duration-300"
                        style={{ width: `${(activeChar.hp / activeChar.maxHp) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Shield Progress block */}
                  {activeChar.maxShield > 0 && (
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      <div className="flex justify-between items-center text-[8px] text-slate-400 font-bold">
                        <span className="flex items-center gap-0.5 text-sky-400"><Shield size={8} /> ESCUDO</span>
                        <span className="text-sky-300 font-mono">{activeChar.shield}/{activeChar.maxShield}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-md overflow-hidden p-[1px] border border-slate-900">
                        <div 
                          className="bg-gradient-to-r from-sky-600 to-sky-400 h-full rounded-sm transition-all duration-300"
                          style={{ width: `${(activeChar.shield / activeChar.maxShield) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* AP Diamonds & Ammunition row */}
                  <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-800/40 text-[9px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[8px] font-bold tracking-widest">AP:</span>
                      {renderAPDiamonds(activeChar.ap, activeChar.maxAp)}
                    </div>
                    <div className="text-slate-400 font-bold flex items-center gap-1">
                      <span className="text-[7.5px] text-slate-500">MUNICIÓN:</span>
                      <span className="text-white font-black">{activeChar.ammo}/{activeChar.maxAmmo}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center py-4 text-slate-500 text-center text-xs">
                <span>⚠️ Selecciona un soldado para planificar acción</span>
              </div>
            )}
          </div>

          {/* B. CENTER ACTION HUD BUTTONS (Concept Art Square grid) */}
          {activeChar ? (
            <div className="flex-1 flex flex-col items-center gap-2 max-w-[550px] mx-auto w-full">
              <div className="flex items-center justify-center gap-2 w-full">
                
                {/* BUTTON 1: MOVER */}
                <button
                  onClick={() => onSelectAction(gameState.selectedAction === 'move' ? null : 'move')}
                  disabled={activeChar.ap <= 0}
                  className={`w-[85px] h-[75px] md:w-[95px] md:h-[85px] rounded-lg border flex flex-col items-center justify-between p-2 font-mono text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                    activeChar.ap <= 0
                      ? 'opacity-35 border-slate-900 text-slate-600 bg-slate-950/80 cursor-not-allowed'
                      : gameState.selectedAction === 'move'
                      ? 'bg-sky-950/70 border-sky-400 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.3)] cursor-pointer ring-1 ring-sky-400/30'
                      : 'bg-slate-950/90 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-900/80 cursor-pointer'
                  }`}
                >
                  <ChevronsRight size={18} className={`mx-auto ${gameState.selectedAction === 'move' ? 'text-sky-400 animate-pulse' : 'text-slate-500'}`} />
                  <span className="text-center w-full block font-bold leading-tight">Mover</span>
                  <span className="text-[7px] text-sky-500 font-bold">1 AP</span>
                </button>

                {/* BUTTON 2: DISPARAR */}
                <button
                  onClick={() => onSelectAction(gameState.selectedAction === 'shoot' ? null : 'shoot')}
                  disabled={activeChar.ap <= 0 || activeChar.ammo <= 0 || (activeChar.class === 'assault' && activeChar.ammo < 3)}
                  className={`w-[85px] h-[75px] md:w-[95px] md:h-[85px] rounded-lg border flex flex-col items-center justify-between p-2 font-mono text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                    activeChar.ap <= 0 || activeChar.ammo <= 0 || (activeChar.class === 'assault' && activeChar.ammo < 3)
                      ? 'opacity-35 border-slate-900 text-slate-600 bg-slate-950/80 cursor-not-allowed'
                      : gameState.selectedAction === 'shoot'
                      ? 'bg-red-950/70 border-red-500 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.3)] cursor-pointer ring-1 ring-red-500/30'
                      : 'bg-slate-950/90 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-900/80 cursor-pointer'
                  }`}
                >
                  <Crosshair size={18} className={`mx-auto ${gameState.selectedAction === 'shoot' ? 'text-red-500' : 'text-slate-500'}`} />
                  <span className="text-center w-full block font-bold leading-tight">Disparar</span>
                  <span className="text-[7px] text-red-500 font-bold">1 AP</span>
                </button>

                {/* BUTTON 3: RECARGAR / GRANADA FOR SNIPERS */}
                {activeChar.class !== 'snipers' ? (
                  <button
                    onClick={() => {
                      onSelectAction(null);
                      onSelectAction('reload_trigger');
                    }}
                    disabled={activeChar.ap <= 0 || activeChar.ammo === activeChar.maxAmmo}
                    className={`w-[85px] h-[75px] md:w-[95px] md:h-[85px] rounded-lg border flex flex-col items-center justify-between p-2 font-mono text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                      activeChar.ap <= 0 || activeChar.ammo === activeChar.maxAmmo
                        ? 'opacity-35 border-slate-900 text-slate-600 bg-slate-950/80 cursor-not-allowed'
                        : 'bg-slate-950/90 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-900/80 cursor-pointer'
                    }`}
                  >
                    <RotateCcw size={18} className="mx-auto text-slate-500" />
                    <span className="text-center w-full block font-bold leading-tight">Recargar</span>
                    <span className="text-[7px] text-slate-500 font-bold">1 AP</span>
                  </button>
                ) : (
                  /* Grenade for Sniper fits in slot 3 */
                  <button
                    onClick={() => onSelectAction(gameState.selectedAction === 'grenade' ? null : 'grenade')}
                    disabled={activeChar.ap <= 0 || (activeChar.cooldowns.grenade || 0) > 0}
                    className={`w-[85px] h-[75px] md:w-[95px] md:h-[85px] rounded-lg border flex flex-col items-center justify-between p-2 font-mono text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                      activeChar.ap <= 0 || (activeChar.cooldowns.grenade || 0) > 0
                        ? 'opacity-35 border-slate-900 text-slate-600 bg-slate-950/80 cursor-not-allowed'
                        : gameState.selectedAction === 'grenade'
                        ? 'bg-orange-950/70 border-orange-500 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.3)] cursor-pointer ring-1 ring-orange-500/30'
                        : 'bg-slate-950/90 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-900/80 cursor-pointer'
                    }`}
                  >
                    <Bomb size={18} className={`mx-auto ${gameState.selectedAction === 'grenade' ? 'text-orange-500' : 'text-slate-500'}`} />
                    <span className="text-center w-full block font-bold leading-tight">Granada</span>
                    <span className="text-[7px] text-orange-500 font-bold">
                      {(activeChar.cooldowns.grenade || 0) > 0 ? `CD: ${activeChar.cooldowns.grenade}` : '1 AP'}
                    </span>
                  </button>
                )}

                {/* BUTTON 4: SPECIAL (GRENADE FOR ASSAULT, HEAL FOR MEDIC) */}
                {activeChar.class === 'assault' && (
                  <button
                    onClick={() => onSelectAction(gameState.selectedAction === 'grenade' ? null : 'grenade')}
                    disabled={activeChar.ap <= 0 || (activeChar.cooldowns.grenade || 0) > 0}
                    className={`w-[85px] h-[75px] md:w-[95px] md:h-[85px] rounded-lg border flex flex-col items-center justify-between p-2 font-mono text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                      activeChar.ap <= 0 || (activeChar.cooldowns.grenade || 0) > 0
                        ? 'opacity-35 border-slate-900 text-slate-600 bg-slate-950/80 cursor-not-allowed'
                        : gameState.selectedAction === 'grenade'
                        ? 'bg-orange-950/70 border-orange-500 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.3)] cursor-pointer ring-1 ring-orange-500/30'
                        : 'bg-slate-950/90 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-900/80 cursor-pointer'
                    }`}
                  >
                    <Bomb size={18} className={`mx-auto ${gameState.selectedAction === 'grenade' ? 'text-orange-500 animate-bounce' : 'text-slate-500'}`} />
                    <span className="text-center w-full block font-bold leading-tight">Granada</span>
                    <span className="text-[7px] text-orange-500 font-bold">
                      {(activeChar.cooldowns.grenade || 0) > 0 ? `CD: ${activeChar.cooldowns.grenade}` : '1 AP'}
                    </span>
                  </button>
                )}

                {activeChar.class === 'medic' && (
                  <button
                    onClick={() => onSelectAction(gameState.selectedAction === 'heal' ? null : 'heal')}
                    disabled={activeChar.ap <= 0 || (activeChar.cooldowns.heal || 0) > 0}
                    className={`w-[85px] h-[75px] md:w-[95px] md:h-[85px] rounded-lg border flex flex-col items-center justify-between p-2 font-mono text-[9px] font-black uppercase tracking-wider transition-all duration-200 ${
                      activeChar.ap <= 0 || (activeChar.cooldowns.heal || 0) > 0
                        ? 'opacity-35 border-slate-900 text-slate-600 bg-slate-950/80 cursor-not-allowed'
                        : gameState.selectedAction === 'heal'
                        ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)] cursor-pointer ring-1 ring-rose-500/30'
                        : 'bg-slate-950/90 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-white hover:bg-slate-900/80 cursor-pointer'
                    }`}
                  >
                    <Activity size={18} className={`mx-auto ${gameState.selectedAction === 'heal' ? 'text-rose-500 animate-pulse' : 'text-slate-500'}`} />
                    <span className="text-center w-full block font-bold leading-tight">Curar</span>
                    <span className="text-[7px] text-rose-500 font-bold">
                      {(activeChar.cooldowns.heal || 0) > 0 ? `CD: ${activeChar.cooldowns.heal}` : '1 AP'}
                    </span>
                  </button>
                )}

                {/* BUTTON 5: TRINCHERA (Cover Bonus Guide Card matching layout exactly) */}
                <div className="w-[85px] h-[75px] md:w-[95px] md:h-[85px] rounded-lg border border-amber-900/40 bg-amber-950/20 text-amber-500 p-2 flex flex-col items-center justify-between font-mono text-[8.5px] font-extrabold uppercase tracking-tight select-none">
                  <Shield size={16} className="mx-auto text-amber-500/80" />
                  <span className="text-center w-full block tracking-widest text-[9px] font-bold">TRINCHERA</span>
                  <span className="text-[7.5px] text-amber-600 font-black">PASIVA</span>
                </div>
              </div>

              {/* ACTION DESCRIPTION MESSAGE FLOATED BELOW ACTIONS */}
              <div className="text-[9.5px] font-mono text-slate-500 tracking-wide text-center">
                {gameState.selectedAction === null ? (
                  <span>Selecciona una acción arriba y haz clic en la cuadrícula táctica.</span>
                ) : gameState.selectedAction === 'move' ? (
                  <span className="text-sky-400 font-extrabold">MOVIMIENTO: Clica en una celda verde del mapa. ¡Busca parapetos para cobertura!</span>
                ) : gameState.selectedAction === 'shoot' ? (
                  <span className="text-red-400 font-extrabold">FUEGO TÁCTICO: Clica sobre un alienígena hostil para disparar.</span>
                ) : gameState.selectedAction === 'grenade' ? (
                  <span className="text-orange-400 font-extrabold">GRANADA FRAG: Lanza explosivo con área de impacto. Rompe coberturas.</span>
                ) : gameState.selectedAction === 'heal' ? (
                  <span className="text-rose-400 font-extrabold font-bold">NANO-MEDICINA: Clica en un aliado herido para curarlo (+45 HP).</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* C. RIGHT: FINALIZAR TURNO Diagonal Cut-out button matching design */}
          <div className="min-w-[170px] flex justify-end shrink-0 pt-2 lg:pt-0">
            <button
              onClick={onEndPlayerTurn}
              className="w-full lg:w-auto bg-[#0d222b] hover:bg-[#123340] border border-cyan-500/30 hover:border-cyan-400/50 text-cyan-300 font-bold uppercase tracking-widest text-[11px] px-6 py-3.5 rounded-lg shadow-lg shadow-cyan-950/30 transition-all cursor-pointer flex items-center justify-center gap-2 transform active:scale-95 select-none"
              title="Termina el turno del pelotón para dar paso a la I.A. enemiga"
            >
              <Activity size={13} className="text-cyan-400 animate-pulse" />
              <span>FINALIZAR TURNO »</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
