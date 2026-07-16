import { Character, GridCell, GameState, GameLog, CharacterClass, Difficulty, CoverType } from '../types';

// Constants
export const GRID_SIZE = 7;
export const BASE_HP = {
  assault: 100,
  snipers: 80,
  medic: 110,
  enemy_trooper: 70,
  enemy_ranger: 60,
  enemy_heavy: 120,
};

export const BASE_SHIELD = {
  assault: 20,
  snipers: 0,
  medic: 10,
  enemy_trooper: 10,
  enemy_ranger: 0,
  enemy_heavy: 40,
};

export const MAX_AMMO = {
  assault: 6, // 3-bullet burst, so 2 bursts per reload
  snipers: 1, // Must reload after every shot
  medic: 2,   // 2 shots, then reload
  enemy_trooper: 3,
  enemy_ranger: 2,
  enemy_heavy: 4,
};

export const BASE_ACCURACY = {
  assault: 75,
  snipers: 90,
  medic: 70,
  enemy_trooper: 70,
  enemy_ranger: 75,
  enemy_heavy: 55,
};

// Log helper
export function addLog(logs: GameLog[], message: string, type: GameLog['type']): GameLog[] {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return [
    {
      id: Math.random().toString(36).substr(2, 9),
      timestamp,
      message,
      type,
    },
    ...logs,
  ].slice(0, 100); // Keep last 100 logs
}

// Generate the initial isometric grid
export function generateGrid(): GridCell[][] {
  const grid: GridCell[][] = [];
  
  // High-probability cover placement locations to ensure nice tactical play
  const coverMap: { [key: string]: { type: CoverType; dir: 'N' | 'S' | 'E' | 'W' } } = {
    '2,2': { type: 'full', dir: 'S' },
    '4,2': { type: 'full', dir: 'S' },
    '2,4': { type: 'full', dir: 'N' },
    '4,4': { type: 'full', dir: 'N' },
    '3,3': { type: 'half', dir: 'E' },
    '1,3': { type: 'half', dir: 'W' },
    '5,3': { type: 'half', dir: 'E' },
    '3,1': { type: 'half', dir: 'S' },
    '3,5': { type: 'half', dir: 'N' },
  };

  for (let x = 0; x < GRID_SIZE; x++) {
    grid[x] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      // Setup default elevation (hills or high ground in the corners / sides)
      let elevation = 0;
      if ((x === 0 && y === 0) || (x === GRID_SIZE - 1 && y === 0) || (x === 0 && y === GRID_SIZE - 1) || (x === GRID_SIZE - 1 && y === GRID_SIZE - 1)) {
        elevation = 1; // Elevated corners for tactical sniper spots
      } else if (x === 3 && (y === 0 || y === GRID_SIZE - 1)) {
        elevation = 1; // Guard towers/overlooks
      }

      const coord = `${x},${y}`;
      const cover = coverMap[coord];

      grid[x][y] = {
        x,
        y,
        elevation,
        coverType: cover ? cover.type : 'none',
        coverDirection: cover ? cover.dir : undefined,
        coverHealth: cover ? (cover.type === 'full' ? 50 : 30) : undefined,
      };
    }
  }
  return grid;
}

// Generate characters
export function generateCharacters(difficulty: Difficulty, wave: number): Character[] {
  const playerSquad: Character[] = [
    {
      id: 'p1',
      name: 'Asalto (Gunnar)',
      class: 'assault',
      isEnemy: false,
      gridX: 1,
      gridY: 5,
      hp: BASE_HP.assault,
      maxHp: BASE_HP.assault,
      shield: BASE_SHIELD.assault,
      maxShield: BASE_SHIELD.assault,
      ammo: MAX_AMMO.assault,
      maxAmmo: MAX_AMMO.assault,
      ap: 2,
      maxAp: 2,
      isDefending: false,
      cooldowns: {},
      facing: 'N',
      isDead: false,
    },
    {
      id: 'p2',
      name: 'Sniper (Keira)',
      class: 'snipers',
      isEnemy: false,
      gridX: 0,
      gridY: 6,
      hp: BASE_HP.snipers,
      maxHp: BASE_HP.snipers,
      shield: BASE_SHIELD.snipers,
      maxShield: BASE_SHIELD.snipers,
      ammo: MAX_AMMO.snipers,
      maxAmmo: MAX_AMMO.snipers,
      ap: 2,
      maxAp: 2,
      isDefending: false,
      cooldowns: { grenade: 0 },
      facing: 'N',
      isDead: false,
    },
    {
      id: 'p3',
      name: 'Médico (Dr. Aris)',
      class: 'medic',
      isEnemy: false,
      gridX: 2,
      gridY: 6,
      hp: BASE_HP.medic,
      maxHp: BASE_HP.medic,
      shield: BASE_SHIELD.medic,
      maxShield: BASE_SHIELD.medic,
      ammo: MAX_AMMO.medic,
      maxAmmo: MAX_AMMO.medic,
      ap: 2,
      maxAp: 2,
      isDefending: false,
      cooldowns: { heal: 0 },
      facing: 'N',
      isDead: false,
    }
  ];

  // Adjust enemy stats based on difficulty and wave
  const scale = 1 + (wave - 1) * 0.15; // 15% increase in stats per wave in endless mode
  const diffMultiplier = difficulty === 'easy' ? 0.8 : difficulty === 'hard' ? 1.25 : 1.0;

  const enemySquad: Character[] = [
    {
      id: 'e1',
      name: `Plasma Trooper (${wave > 1 ? 'V2' : 'Alpha'})`,
      class: 'enemy_trooper',
      isEnemy: true,
      gridX: 4,
      gridY: 1,
      hp: Math.round(BASE_HP.enemy_trooper * scale * diffMultiplier),
      maxHp: Math.round(BASE_HP.enemy_trooper * scale * diffMultiplier),
      shield: Math.round(BASE_SHIELD.enemy_trooper * scale * diffMultiplier),
      maxShield: Math.round(BASE_SHIELD.enemy_trooper * scale * diffMultiplier),
      ammo: MAX_AMMO.enemy_trooper,
      maxAmmo: MAX_AMMO.enemy_trooper,
      ap: 2,
      maxAp: 2,
      isDefending: false,
      cooldowns: {},
      facing: 'S',
      isDead: false,
    },
    {
      id: 'e2',
      name: `Alien Ranger (${wave > 1 ? 'Elite' : 'Beta'})`,
      class: 'enemy_ranger',
      isEnemy: true,
      gridX: 5,
      gridY: 0,
      hp: Math.round(BASE_HP.enemy_ranger * scale * diffMultiplier),
      maxHp: Math.round(BASE_HP.enemy_ranger * scale * diffMultiplier),
      shield: Math.round(BASE_SHIELD.enemy_ranger * scale * diffMultiplier),
      maxShield: Math.round(BASE_SHIELD.enemy_ranger * scale * diffMultiplier),
      ammo: MAX_AMMO.enemy_ranger,
      maxAmmo: MAX_AMMO.enemy_ranger,
      ap: 2,
      maxAp: 2,
      isDefending: false,
      cooldowns: {},
      facing: 'S',
      isDead: false,
    },
    {
      id: 'e3',
      name: `Alien Dreadnought`,
      class: 'enemy_heavy',
      isEnemy: true,
      gridX: 3,
      gridY: 0,
      hp: Math.round(BASE_HP.enemy_heavy * scale * diffMultiplier),
      maxHp: Math.round(BASE_HP.enemy_heavy * scale * diffMultiplier),
      shield: Math.round(BASE_SHIELD.enemy_heavy * scale * diffMultiplier),
      maxShield: Math.round(BASE_SHIELD.enemy_heavy * scale * diffMultiplier),
      ammo: MAX_AMMO.enemy_heavy,
      maxAmmo: MAX_AMMO.enemy_heavy,
      ap: 2,
      maxAp: 2,
      isDefending: false,
      cooldowns: {},
      facing: 'S',
      isDead: false,
    }
  ];

  // If wave 1, maybe make it slightly gentler or omit the heavy if easy
  if (difficulty === 'easy' && wave === 1) {
    enemySquad[2].hp = Math.round(enemySquad[2].hp * 0.7);
    enemySquad[2].shield = Math.round(enemySquad[2].shield * 0.5);
  }

  return [...playerSquad, ...enemySquad];
}

// Calculate the relative direction of defender to shooter
export function getRelativeDirection(shooterX: number, shooterY: number, defenderX: number, defenderY: number): 'N' | 'S' | 'E' | 'W' {
  const dx = shooterX - defenderX;
  const dy = shooterY - defenderY;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? 'E' : 'W'; // Shooter is to the East or West of defender
  } else {
    return dy < 0 ? 'S' : 'N'; // Shooter is to the South or North of defender
  }
}

// Check if cover blocks the shooter's line of fire
export function isCoverActive(
  shooterX: number,
  shooterY: number,
  defenderX: number,
  defenderY: number,
  grid: GridCell[][]
): { active: boolean; coverType: CoverType; dir: 'N' | 'S' | 'E' | 'W' | null } {
  const cell = grid[defenderX]?.[defenderY];
  if (!cell || cell.coverType === 'none') {
    return { active: false, coverType: 'none', dir: null };
  }

  const relativeDir = getRelativeDirection(shooterX, shooterY, defenderX, defenderY);
  
  // Cover is active if the cell has cover facing the direction of the shooter
  const isActive = cell.coverDirection === relativeDir;

  return {
    active: isActive,
    coverType: isActive ? cell.coverType : 'none',
    dir: cell.coverDirection || null,
  };
}

// Calculate Manhattan distance between two cells
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// Interface for tactical breakdown of a shot
export interface ShotBreakdown {
  baseAccuracy: number;
  rangeModifier: number;
  coverModifier: number;
  elevationModifier: number;
  finalAccuracy: number;
  baseDamage: number;
  coverDamageReduction: number;
  finalDamage: number;
  isCoverActive: boolean;
  coverType: CoverType;
  distance: number;
}

// Calculate tactical details of a potential action
export function calculateShot(
  shooter: Character,
  defender: Character,
  grid: GridCell[][]
): ShotBreakdown {
  const dist = getDistance(shooter.gridX, shooter.gridY, defender.gridX, defender.gridY);
  const baseAcc = BASE_ACCURACY[shooter.class] || 70;
  
  // 1. Range Modifiers
  let rangeMod = 0;
  let baseDamage = 25;

  if (shooter.class === 'assault') {
    baseDamage = 15; // Fires 3 bullets!
    if (dist <= 2) {
      rangeMod = -10; // Assault rifle a bit long for close range
    } else if (dist === 3 || dist === 4) {
      rangeMod = 15; // Optimal range
    } else if (dist >= 5) {
      rangeMod = -15 * (dist - 4); // Falls off rapidly
    }
  } else if (shooter.class === 'snipers') {
    baseDamage = 60; // Huge heavy single shot
    if (dist <= 2) {
      rangeMod = -45; // Sniper scope is terrible at melee range!
    } else if (dist === 3 || dist === 4) {
      rangeMod = 0; // Standard accuracy
    } else if (dist >= 5) {
      rangeMod = 20; // Sniper gets accuracy bonus at long distance!
    }
  } else if (shooter.class === 'medic') {
    baseDamage = 45; // Shotgun burst
    if (dist <= 2) {
      rangeMod = 25; // Shotgun is devastating close up!
    } else if (dist === 3) {
      rangeMod = -20; // Rapid spread falloff
    } else if (dist >= 4) {
      rangeMod = -60; // Ineffective at distance
    }
  } else if (shooter.class === 'enemy_trooper') {
    baseDamage = 20;
    if (dist >= 5) rangeMod = -15 * (dist - 4);
  } else if (shooter.class === 'enemy_ranger') {
    baseDamage = 35; // Close-range shotgun style
    if (dist <= 2) rangeMod = 20;
    else rangeMod = -25 * (dist - 2);
  } else if (shooter.class === 'enemy_heavy') {
    baseDamage = 40;
    if (dist <= 2) rangeMod = -15;
    else if (dist >= 5) rangeMod = -30;
  }

  // 2. Cover Modifiers
  const coverCheck = isCoverActive(shooter.gridX, shooter.gridY, defender.gridX, defender.gridY, grid);
  let coverAccMod = 0;
  let coverDmgMod = 0;

  if (coverCheck.active) {
    if (coverCheck.coverType === 'full') {
      coverAccMod = -45; // Hard to hit behind full wall
      coverDmgMod = 0.50; // 50% damage reduction
    } else if (coverCheck.coverType === 'half') {
      coverAccMod = -25; // Harder to hit behind half wall
      coverDmgMod = 0.25; // 25% damage reduction
    }
  }

  // 3. Elevation Modifiers
  const shooterCell = grid[shooter.gridX]?.[shooter.gridY];
  const defenderCell = grid[defender.gridX]?.[defender.gridY];
  let elevMod = 0;

  if (shooterCell && defenderCell) {
    if (shooterCell.elevation > defenderCell.elevation) {
      elevMod = 15; // High ground advantage (+15% accuracy)
    } else if (shooterCell.elevation < defenderCell.elevation) {
      elevMod = -15; // Shooting uphill penalty (-15% accuracy)
    }
  }

  // 4. Defender Hunker Down modifier
  if (defender.isDefending) {
    coverAccMod -= 15; // Hunkered down gets extra defensive bonus
    coverDmgMod = Math.min(0.75, coverDmgMod + 0.15); // Extra 15% damage reduction
  }

  // Combine
  const finalAcc = Math.max(10, Math.min(95, baseAcc + rangeMod + coverAccMod + elevMod));
  const finalDmg = Math.round(baseDamage * (1 - coverDmgMod));

  return {
    baseAccuracy: baseAcc,
    rangeModifier: rangeMod,
    coverModifier: coverAccMod,
    elevationModifier: elevMod,
    finalAccuracy: finalAcc,
    baseDamage,
    coverDamageReduction: Math.round(baseDamage * coverDmgMod),
    finalDamage: finalDmg,
    isCoverActive: coverCheck.active,
    coverType: coverCheck.coverType,
    distance: dist,
  };
}

// Generate valid movement path cells (1 cell distance costs 1 AP, max range depends on character/AP)
export function getReachableCells(character: Character, grid: GridCell[][], characters: Character[]): { x: number; y: number; cost: number }[] {
  if (character.ap <= 0 || character.isDead) return [];
  
  const reachable: { x: number; y: number; cost: number }[] = [];
  const maxRange = character.ap; // 1 AP = 1 tile movement max, 2 AP = 2 tiles movement

  for (let dx = -maxRange; dx <= maxRange; dx++) {
    for (let dy = -maxRange; dy <= maxRange; dy++) {
      if (dx === 0 && dy === 0) continue;
      
      const targetX = character.gridX + dx;
      const targetY = character.gridY + dy;
      const cost = Math.abs(dx) + Math.abs(dy); // Manhattan move distance

      // Bounds checking
      if (targetX < 0 || targetX >= GRID_SIZE || targetY < 0 || targetY >= GRID_SIZE) continue;
      if (cost > maxRange) continue; // Can't move diagonally unless we count it as 2 steps

      // Check if another alive character is already occupying that cell
      const isOccupied = characters.some(c => !c.isDead && c.gridX === targetX && c.gridY === targetY);
      if (isOccupied) continue;

      reachable.push({ x: targetX, y: targetY, cost });
    }
  }

  return reachable;
}

// Run Enemy AI for a single character
export function executeEnemyAI(
  enemy: Character,
  state: GameState,
  onActionComplete: (updatedState: GameState, description: string) => void
) {
  if (enemy.isDead || enemy.ap <= 0) {
    onActionComplete(state, `${enemy.name} no tiene puntos de acción o está derrotado.`);
    return;
  }

  let updatedState = { ...state };
  const players = updatedState.characters.filter(c => !c.isEnemy && !c.isDead);
  
  if (players.length === 0) {
    onActionComplete(updatedState, "Todos los soldados de la resistencia han sido derrotados.");
    return;
  }

  // AI Decision Tree
  // 1. Is ammo empty? If yes, and has AP, must reload!
  if (enemy.ammo === 0) {
    const updatedChars = updatedState.characters.map(c => {
      if (c.id === enemy.id) {
        return {
          ...c,
          ammo: c.maxAmmo,
          ap: c.ap - 1,
          isDefending: false,
        };
      }
      return c;
    });
    
    updatedState = {
      ...updatedState,
      characters: updatedChars,
      logs: addLog(updatedState.logs, `🤖 ${enemy.name} recarga su arma. (Munición llena)`, 'info'),
    };
    onActionComplete(updatedState, `${enemy.name} recargó su arma.`);
    return;
  }

  // Find closest player soldier
  let closestPlayer = players[0];
  let minDist = getDistance(enemy.gridX, enemy.gridY, closestPlayer.gridX, closestPlayer.gridY);
  
  for (let i = 1; i < players.length; i++) {
    const d = getDistance(enemy.gridX, enemy.gridY, players[i].gridX, players[i].gridY);
    if (d < minDist) {
      minDist = d;
      closestPlayer = players[i];
    }
  }

  // 2. Tactical Movement Decision:
  // If the enemy is in the open (no cover against closest player) OR if closest player is out of effective range, and has 2 AP.
  const coverCheck = isCoverActive(closestPlayer.gridX, closestPlayer.gridY, enemy.gridX, enemy.gridY, updatedState.grid);
  const isOutOfRange = minDist > 4 && enemy.class === 'enemy_ranger'; // Ranger wants close range

  if ((!coverCheck.active || isOutOfRange) && enemy.ap >= 2) {
    // Try to find a cell to move to that is closer or has active cover
    const reachable = getReachableCells(enemy, updatedState.grid, updatedState.characters);
    
    if (reachable.length > 0) {
      let bestCell = reachable[0];
      let bestScore = -9999;

      for (const cell of reachable) {
        let score = 0;
        const distToPlayer = getDistance(cell.x, cell.y, closestPlayer.gridX, closestPlayer.gridY);
        
        // Ranger scores closer cells higher
        if (enemy.class === 'enemy_ranger') {
          score += (10 - distToPlayer) * 5; 
        } else {
          // Others prefer comfortable medium range of 3-4
          if (distToPlayer === 3 || distToPlayer === 4) score += 20;
          else if (distToPlayer > 4) score -= (distToPlayer - 4) * 3;
          else score -= (3 - distToPlayer) * 3;
        }

        // Is there cover here facing the player?
        const cellCoverCheck = isCoverActive(closestPlayer.gridX, closestPlayer.gridY, cell.x, cell.y, updatedState.grid);
        if (cellCoverCheck.active) {
          score += cellCoverCheck.coverType === 'full' ? 50 : 30;
        }

        // Avoid elevated spaces unless sniper (none of the current enemies are snipers, but good general rule)
        if (updatedState.grid[cell.x][cell.y].elevation > 0) {
          score += 5;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCell = cell;
        }
      }

      // Move there! (Costs 1 AP)
      const oldX = enemy.gridX;
      const oldY = enemy.gridY;
      
      const relativeMoveDir = getRelativeDirection(oldX, oldY, bestCell.x, bestCell.y);

      const updatedChars = updatedState.characters.map(c => {
        if (c.id === enemy.id) {
          return {
            ...c,
            gridX: bestCell.x,
            gridY: bestCell.y,
            ap: c.ap - 1,
            facing: relativeMoveDir,
            isDefending: false,
          };
        }
        return c;
      });

      updatedState = {
        ...updatedState,
        characters: updatedChars,
        logs: addLog(updatedState.logs, `🤖 ${enemy.name} se posiciona en (${bestCell.x}, ${bestCell.y}).`, 'info'),
      };
      
      onActionComplete(updatedState, `${enemy.name} se movió a una mejor posición táctica.`);
      return;
    }
  }

  // 3. Combat Action:
  // Shoot the closest player!
  const shotDetails = calculateShot(enemy, closestPlayer, updatedState.grid);
  const roll = Math.random() * 100;
  const isHit = roll <= shotDetails.finalAccuracy;

  let combatMessage = '';
  let updatedChars = [...updatedState.characters];

  // Consume ammo & 1 AP
  updatedChars = updatedChars.map(c => {
    if (c.id === enemy.id) {
      return {
        ...c,
        ammo: c.ammo - 1,
        ap: c.ap - 1,
        isDefending: false,
      };
    }
    return c;
  });

  if (isHit) {
    const damage = shotDetails.finalDamage;
    let currentDmgRemaining = damage;
    let shieldDmg = 0;
    let hpDmg = 0;

    updatedChars = updatedChars.map(c => {
      if (c.id === closestPlayer.id) {
        if (c.shield > 0) {
          shieldDmg = Math.min(c.shield, currentDmgRemaining);
          currentDmgRemaining -= shieldDmg;
        }
        hpDmg = Math.min(c.hp, currentDmgRemaining);
        const newHp = Math.max(0, c.hp - hpDmg);
        const isDead = newHp <= 0;

        return {
          ...c,
          shield: c.shield - shieldDmg,
          hp: newHp,
          isDead,
        };
      }
      return c;
    });

    combatMessage = `🎯 ¡Impacto! ${enemy.name} dispara a ${closestPlayer.name} con un ${shotDetails.finalAccuracy}% de acierto. Daño: ${damage} (${shieldDmg > 0 ? `${shieldDmg} escudo, ` : ''}${hpDmg} vitalidad).`;
    
    // Check death log
    const updatedTarget = updatedChars.find(c => c.id === closestPlayer.id);
    if (updatedTarget?.isDead) {
      combatMessage += ` 💀 ${closestPlayer.name} ha sido incapacitado.`;
    }

    updatedState = {
      ...updatedState,
      characters: updatedChars,
      logs: addLog(updatedState.logs, combatMessage, 'enemy_attack'),
      stats: {
        ...updatedState.stats,
        damageTaken: updatedState.stats.damageTaken + damage,
      },
    };
  } else {
    combatMessage = `❌ ¡Fallo! ${enemy.name} dispara a ${closestPlayer.name} (Precisión del ${shotDetails.finalAccuracy}%) pero el tiro se desvía.`;
    updatedState = {
      ...updatedState,
      characters: updatedChars,
      logs: addLog(updatedState.logs, combatMessage, 'info'),
    };
  }

  onActionComplete(updatedState, combatMessage);
}
