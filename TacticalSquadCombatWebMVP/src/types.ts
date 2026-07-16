/**
 * Types for the Tactical Squad Combat MVP.
 */

export type CharacterClass = 'assault' | 'snipers' | 'medic' | 'enemy_trooper' | 'enemy_ranger' | 'enemy_heavy';

export interface Character {
  id: string;
  name: string;
  class: CharacterClass;
  isEnemy: boolean;
  gridX: number;
  gridY: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  ammo: number;
  maxAmmo: number;
  ap: number;
  maxAp: number;
  isDefending: boolean;
  cooldowns: { [abilityName: string]: number };
  facing: 'N' | 'S' | 'E' | 'W';
  isDead: boolean;
}

export type CoverType = 'none' | 'half' | 'full';

export interface GridCell {
  x: number;
  y: number;
  elevation: number; // Height offset for verticality
  coverType: CoverType;
  coverDirection?: 'N' | 'S' | 'E' | 'W';
  coverHealth?: number; // Cover can be damaged or destroyed
}

export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'player_attack' | 'enemy_attack' | 'heal' | 'system' | 'death';
}

export interface Particle {
  id: string;
  type: 'bullet' | 'laser' | 'heal' | 'explosion' | 'smoke' | 'debris' | 'floating_text';
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  currentX: number;
  currentY: number;
  speed?: number;
  color: string;
  size: number;
  life: number; // 0 to 1
  maxLife: number; // in frames or ms
  text?: string;
  velocity?: { x: number; y: number };
}

export type ViewMode = 'isometric' | 'third_person';

export interface GameStats {
  turns: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  enemiesKilled: number;
  shotsFired: number;
  shotsHit: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GameState {
  grid: GridCell[][];
  characters: Character[];
  activeCharacterId: string | null;
  turnOwner: 'player' | 'enemy';
  selectedAction: string | null; // e.g. 'move' | 'shoot' | 'grenade' | 'heal'
  selectedTargetId: string | null;
  selectedGridCell: { x: number; y: number } | null;
  viewMode: ViewMode;
  gameStatus: 'setup' | 'playing' | 'victory' | 'defeat';
  logs: GameLog[];
  stats: GameStats;
  wave: number;
  isEndless: boolean;
  difficulty: Difficulty;
}
