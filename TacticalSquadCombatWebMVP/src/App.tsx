import { useState, useEffect } from 'react';
import { Character, GridCell, GameState, Particle, ViewMode, Difficulty } from './types';
import {
  generateGrid,
  generateCharacters,
  calculateShot,
  getDistance,
  getReachableCells,
  executeEnemyAI,
  addLog,
  MAX_AMMO,
} from './utils/gameEngine';
import { BattleCanvas } from './components/BattleCanvas';
import { SkirmishConfig } from './components/SkirmishConfig';
import { MechanicsExplainer } from './components/MechanicsExplainer';
import { Swords, Brain, Shield, Info, Sparkles, RefreshCw, Trophy, Crosshair } from 'lucide-react';

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<GameState>(() => {
    const initialGrid = generateGrid();
    const initialChars = generateCharacters('normal', 1);
    const activePlayer = initialChars.find(c => !c.isEnemy && !c.isDead)?.id || null;

    return {
      grid: initialGrid,
      characters: initialChars,
      activeCharacterId: activePlayer,
      turnOwner: 'player',
      selectedAction: null,
      selectedTargetId: null,
      selectedGridCell: null,
      viewMode: 'isometric', // Only isometric view is used
      gameStatus: 'playing',
      logs: [
        {
          id: 'init-1',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: '⚔️ Operación Táctica iniciada. Combate contra escuadrón invasor.',
          type: 'system',
        },
        {
          id: 'init-2',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          message: '💡 Sugerencia: Selecciona un soldado haciendo clic directamente en él, luego elige una habilidad de la consola de abajo.',
          type: 'info',
        }
      ],
      stats: {
        turns: 1,
        damageDealt: 0,
        damageTaken: 0,
        healingDone: 0,
        enemiesKilled: 0,
        shotsFired: 0,
        shotsHit: 0,
      },
      wave: 1,
      isEndless: true,
      difficulty: 'normal',
    };
  });

  // Canvas particle list
  const [particles, setParticles] = useState<Particle[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);

  // Helper to spawn floating text particles (damage, heal, miss numbers)
  const spawnFloatingText = (x: number, y: number, text: string, color: string, size: number = 16) => {
    const newText: Particle = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'floating_text',
      currentX: x,
      currentY: y,
      color,
      size,
      life: 1.0,
      maxLife: 45, // frames
      text,
      velocity: { x: (Math.random() - 0.5) * 0.01, y: -0.01 },
    };
    setParticles((prev) => [...prev, newText]);
  };

  // Helper to spawn healing particles
  const spawnHealingParticles = (x: number, y: number) => {
    const counts = 12;
    const newParticles: Particle[] = [];
    for (let i = 0; i < counts; i++) {
      newParticles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: 'heal',
        currentX: x + (Math.random() - 0.5) * 0.4,
        currentY: y + (Math.random() - 0.5) * 0.4,
        color: '#f43f5e',
        size: 2 + Math.random() * 3,
        life: 1.0,
        maxLife: 30 + Math.random() * 20,
        velocity: { x: (Math.random() - 0.5) * 0.015, y: -0.02 - Math.random() * 0.02 },
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
  };

  // Helper to spawn explosion particles
  const spawnExplosionParticles = (x: number, y: number) => {
    const counts = 25;
    const newParticles: Particle[] = [];
    
    // Core expansion ring
    newParticles.push({
      id: Math.random().toString(36).substr(2, 9),
      type: 'explosion',
      currentX: x,
      currentY: y,
      color: 'rgba(249, 115, 22, 0.4)',
      size: 40,
      life: 1.0,
      maxLife: 15,
    });

    // Scattered fiery debris and smoke
    for (let i = 0; i < counts; i++) {
      const isSmoke = Math.random() > 0.4;
      newParticles.push({
        id: Math.random().toString(36).substr(2, 9),
        type: isSmoke ? 'smoke' : 'debris',
        currentX: x,
        currentY: y,
        color: isSmoke ? 'rgba(156, 163, 175, 0.5)' : (Math.random() > 0.5 ? '#f97316' : '#ef4444'),
        size: isSmoke ? 6 + Math.random() * 10 : 2 + Math.random() * 4,
        life: 1.0,
        maxLife: 20 + Math.random() * 20,
        velocity: { 
          x: (Math.random() - 0.5) * 0.08, 
          y: (Math.random() - 0.5) * 0.08 - (isSmoke ? 0.01 : 0) 
        },
      });
    }
    setParticles((prev) => [...prev, ...newParticles]);
  };

  // Handle combat turn transition to enemy
  const triggerEnemyAISequence = (currentState: GameState) => {
    const aliveEnemies = currentState.characters.filter(c => c.isEnemy && !c.isDead);
    
    if (aliveEnemies.length === 0) {
      // Victory checks are already performed, but safeguard
      return;
    }

    // Process enemies one-by-one with a cinematic delay
    let currentEnemyIndex = 0;
    
    const processNextEnemy = (tempState: GameState) => {
      // Find the next enemy who has AP left
      const activeEnemy = aliveEnemies[currentEnemyIndex];

      if (!activeEnemy || activeEnemy.isDead || tempState.gameStatus !== 'playing') {
        // No more enemies or game ended, return turn to player
        endEnemyTurnSequence(tempState);
        return;
      }

      // Focus camera on this enemy
      setGameState((prev) => ({
        ...prev,
        activeCharacterId: activeEnemy.id,
        viewMode: 'isometric',
      }));

      // Small delay for the camera to slide over
      setTimeout(() => {
        executeEnemyAI(activeEnemy, tempState, (nextState, combatDescription) => {
          // If a shooting action took place, draw shooting tracer lines
          const enemyInState = nextState.characters.find(c => c.id === activeEnemy.id);
          const oldEnemyInState = tempState.characters.find(c => c.id === activeEnemy.id);

          // Did they shoot? (Check if ammo went down and they didn't reload)
          if (oldEnemyInState && enemyInState && enemyInState.ammo < oldEnemyInState.ammo) {
            // Find who they shot (the closest player)
            const targetPlayer = nextState.characters.find(c => !c.isEnemy && !c.isDead); // approximate target for particles
            
            if (targetPlayer) {
              // Zoom out to isometric during combat execution!
              setGameState((prev) => ({ ...prev, viewMode: 'isometric' }));

              const tracer: Particle = {
                id: Math.random().toString(36).substr(2, 9),
                type: 'laser',
                startX: enemyInState.gridX,
                startY: enemyInState.gridY,
                endX: targetPlayer.gridX,
                endY: targetPlayer.gridY,
                currentX: enemyInState.gridX,
                currentY: enemyInState.gridY,
                color: '#ef4444', // Red plasma tracer for aliens
                size: 3,
                life: 1.0,
                maxLife: 15,
              };
              setParticles((prev) => [...prev, tracer]);

              // Did it hit or miss?
              const hpChanged = nextState.characters.find(c => c.id === targetPlayer.id)!.hp < tempState.characters.find(c => c.id === targetPlayer.id)!.hp;
              const shieldChanged = nextState.characters.find(c => c.id === targetPlayer.id)!.shield < tempState.characters.find(c => c.id === targetPlayer.id)!.shield;
              
              setTimeout(() => {
                if (hpChanged || shieldChanged) {
                  const preChar = tempState.characters.find(c => c.id === targetPlayer.id)!;
                  const postChar = nextState.characters.find(c => c.id === targetPlayer.id)!;
                  const totalDmg = (preChar.hp - postChar.hp) + (preChar.shield - postChar.shield);
                  spawnFloatingText(targetPlayer.gridX, targetPlayer.gridY, `-${totalDmg}`, '#ef4444', 18);
                  
                  // Spawn tiny blood/shield particles
                  for (let p = 0; p < 8; p++) {
                    setParticles((prev) => [...prev, {
                      id: Math.random().toString(36).substr(2, 9),
                      type: 'debris',
                      currentX: targetPlayer.gridX,
                      currentY: targetPlayer.gridY,
                      color: shieldChanged ? '#38bdf8' : '#ef4444',
                      size: 2 + Math.random() * 2,
                      life: 1.0,
                      maxLife: 15,
                      velocity: { x: (Math.random() - 0.5) * 0.05, y: (Math.random() - 0.5) * 0.05 },
                    }]);
                  }
                } else {
                  spawnFloatingText(targetPlayer.gridX, targetPlayer.gridY, '¡FALLO!', '#9ca3af', 14);
                }
              }, 200);
            }
          }

          // Commit state
          setGameState(nextState);

          // Check if game over (Defeat)
          const playerSquadAlive = nextState.characters.filter(c => !c.isEnemy && !c.isDead);
          if (playerSquadAlive.length === 0) {
            setGameState((prev) => ({
              ...prev,
              gameStatus: 'defeat',
              logs: addLog(prev.logs, '💀 ¡Operación Fallida! Todo tu escuadrón ha sido aniquilado.', 'death'),
            }));
            return;
          }

          // Advance to next enemy
          currentEnemyIndex++;
          // Delay before next enemy takes their turn
          setTimeout(() => {
            processNextEnemy(nextState);
          }, 1400);
        });
      }, 500);
    };

    // Begin AI processing
    processNextEnemy(currentState);
  };

  // Turn ending sequence: resets player AP and handles status decrements
  const endEnemyTurnSequence = (currentState: GameState) => {
    // Reset player AP, decrease cooldowns
    const updatedChars = currentState.characters.map((char) => {
      if (!char.isEnemy) {
        // Decrease cooldowns
        const nextCooldowns = { ...char.cooldowns };
        Object.keys(nextCooldowns).forEach((key) => {
          if (nextCooldowns[key] > 0) nextCooldowns[key] -= 1;
        });

        return {
          ...char,
          ap: char.maxAp, // refill action points
          isDefending: false, // clear Hunker Down
          cooldowns: nextCooldowns,
        };
      } else {
        // Refill enemy AP for next round
        return {
          ...char,
          ap: char.maxAp,
          isDefending: false,
        };
      }
    });

    const activePlayer = updatedChars.find(c => !c.isEnemy && !c.isDead)?.id || null;

    setGameState((prev) => ({
      ...prev,
      characters: updatedChars,
      activeCharacterId: activePlayer,
      turnOwner: 'player',
      viewMode: 'isometric', // Return to planning view
      stats: {
        ...prev.stats,
        turns: prev.stats.turns + 1,
      },
      logs: addLog(prev.logs, `📋 Turno de la Resistencia (Ronda ${prev.stats.turns + 1}). Planea tus movimientos.`, 'system'),
    }));
  };

  // Modify stats in sandbox panel
  const handleModifyStat = (charId: string, stat: 'hp' | 'shield' | 'ap' | 'ammo', value: number) => {
    setGameState((prev) => {
      const chars = prev.characters.map((char) => {
        if (char.id === charId) {
          if (stat === 'hp') {
            const nextHp = Math.max(0, Math.min(char.maxHp, char.hp + value));
            return { ...char, hp: nextHp, isDead: nextHp <= 0 };
          } else if (stat === 'shield') {
            return { ...char, shield: Math.max(0, Math.min(char.maxShield, char.shield + value)) };
          } else if (stat === 'ap') {
            return { ...char, ap: Math.max(0, Math.min(char.maxAp, char.ap + value)) };
          } else if (stat === 'ammo') {
            return { ...char, ammo: Math.max(0, Math.min(char.maxAmmo, char.ammo + value)) };
          }
        }
        return char;
      });

      return {
        ...prev,
        characters: chars,
        logs: addLog(prev.logs, `🛠️ Ajuste Sandbox en caliente en ${chars.find(c => c.id === charId)?.name}.`, 'info'),
      };
    });
  };

  // Toggle ViewMode (No longer changes viewMode, locked to isometric)
  const handleToggleViewMode = () => {
    setGameState((prev) => ({
      ...prev,
      viewMode: 'isometric',
    }));
  };

  // Reset Game
  const handleResetGame = () => {
    const initialGrid = generateGrid();
    const initialChars = generateCharacters(gameState.difficulty, 1);
    const activePlayer = initialChars.find(c => !c.isEnemy && !c.isDead)?.id || null;

    setGameState((prev) => ({
      ...prev,
      grid: initialGrid,
      characters: initialChars,
      activeCharacterId: activePlayer,
      turnOwner: 'player',
      selectedAction: null,
      selectedTargetId: null,
      selectedGridCell: null,
      viewMode: 'isometric',
      gameStatus: 'playing',
      wave: 1,
      logs: addLog([], '⚔️ El simulador de combate se ha reiniciado. ¡Buena suerte, Comandante!', 'system'),
      stats: {
        turns: 1,
        damageDealt: 0,
        damageTaken: 0,
        healingDone: 0,
        enemiesKilled: 0,
        shotsFired: 0,
        shotsHit: 0,
      }
    }));
    setParticles([]);
  };

  // Start next wave (Endless mode)
  const handleNextWave = () => {
    const nextWave = gameState.wave + 1;
    const freshEnemies = generateCharacters(gameState.difficulty, nextWave).filter(c => c.isEnemy);
    
    // Partially heal and restore player squad, and reset positions
    const playerStartingGrid = [
      { x: 1, y: 5 },
      { x: 0, y: 6 },
      { x: 2, y: 6 }
    ];

    const refreshedPlayers = gameState.characters
      .filter(c => !c.isEnemy)
      .map((char, index) => {
        const startPos = playerStartingGrid[index];
        const healedHp = char.isDead ? Math.round(char.maxHp * 0.4) : Math.min(char.maxHp, char.hp + Math.round((char.maxHp - char.hp) * 0.5));
        
        return {
          ...char,
          gridX: startPos.x,
          gridY: startPos.y,
          hp: healedHp,
          shield: char.maxShield,
          ammo: char.maxAmmo,
          ap: char.maxAp,
          isDead: false,
          isDefending: false,
        };
      });

    setGameState((prev) => ({
      ...prev,
      characters: [...refreshedPlayers, ...freshEnemies],
      activeCharacterId: refreshedPlayers[0].id,
      turnOwner: 'player',
      selectedAction: null,
      viewMode: 'isometric',
      gameStatus: 'playing',
      wave: nextWave,
      grid: generateGrid(), // fresh cover
      logs: addLog(prev.logs, `🛸 ¡ALERTA! Oleada ${nextWave} detectada. Refuerzos alienígenas entrando en órbita.`, 'system'),
    }));
    setParticles([]);
  };

  // Change Difficulty
  const handleUpdateDifficulty = (diff: Difficulty) => {
    setGameState((prev) => ({
      ...prev,
      difficulty: diff,
      logs: addLog(prev.logs, `⚙️ Nivel de amenaza ajustado a: ${diff.toUpperCase()}`, 'info'),
    }));
  };

  // End Player Turn
  const handleEndPlayerTurn = () => {
    if (gameState.turnOwner !== 'player' || gameState.gameStatus !== 'playing') return;

    // Any character with AP left gets hunkered down defensive bonus
    const updatedChars = gameState.characters.map((c) => {
      if (!c.isEnemy && !c.isDead && c.ap > 0) {
        return {
          ...c,
          ap: 0,
          isDefending: true,
        };
      }
      return c;
    });

    const nextState = {
      ...gameState,
      characters: updatedChars,
      turnOwner: 'enemy' as const,
      selectedAction: null,
      selectedTargetId: null,
      logs: addLog(gameState.logs, '🚨 Turno de la Inteligencia Alienígena comenzó.', 'info'),
    };

    setGameState(nextState);
    triggerEnemyAISequence(nextState);
  };

  // Action Select
  const handleSelectAction = (action: string | null) => {
    const activeChar = gameState.characters.find(c => c.id === gameState.activeCharacterId);
    if (!activeChar) return;

    // If reload triggered instantly
    if (action === 'reload_trigger') {
      const updatedChars = gameState.characters.map((c) => {
        if (c.id === activeChar.id) {
          return {
            ...c,
            ammo: c.maxAmmo,
            ap: c.ap - 1,
          };
        }
        return c;
      });

      setGameState((prev) => ({
        ...prev,
        characters: updatedChars,
        selectedAction: null,
        logs: addLog(prev.logs, `🔄 ${activeChar.name} recarga su arma. (Munición llena)`, 'info'),
      }));
      return;
    }

    setGameState((prev) => ({
      ...prev,
      selectedAction: action,
    }));
  };

  // Select Active Character
  const handleSelectCharacter = (id: string) => {
    if (gameState.turnOwner === 'enemy' || gameState.gameStatus !== 'playing') return;
    setGameState((prev) => ({
      ...prev,
      activeCharacterId: id,
      selectedAction: null, // clear previous action to prevent targeting confusion
    }));
  };

  // Handle Board Cell Clicks (Core Move, Shoot, Grenade, Heal Interaction)
  const handleCellClick = (x: number, y: number) => {
    if (gameState.turnOwner !== 'player' || gameState.gameStatus !== 'playing') return;

    // Check if clicked cell contains a friendly character to select
    const clickedFriendly = gameState.characters.find(c => !c.isEnemy && !c.isDead && c.gridX === x && c.gridY === y);
    if (clickedFriendly && gameState.selectedAction !== 'heal') {
      handleSelectCharacter(clickedFriendly.id);
      return;
    }

    const activeChar = gameState.characters.find(c => c.id === gameState.activeCharacterId);
    if (!activeChar || activeChar.isDead || activeChar.ap <= 0) return;

    // 1. MOVE ACTION
    if (gameState.selectedAction === 'move') {
      const reachable = getReachableCells(activeChar, gameState.grid, gameState.characters);
      const isReachable = reachable.some(cell => cell.x === x && cell.y === y);

      if (!isReachable) {
        spawnFloatingText(x, y, 'FUEGO FUERA', '#ef4444', 12);
        return;
      }

      // Perform Move
      const oldX = activeChar.gridX;
      const oldY = activeChar.gridY;
      const moveFacing = (x - oldX > 0) ? 'E' : (x - oldX < 0) ? 'W' : (y - oldY > 0) ? 'S' : 'N';

      const updatedChars = gameState.characters.map((c) => {
        if (c.id === activeChar.id) {
          return {
            ...c,
            gridX: x,
            gridY: y,
            ap: c.ap - 1,
            facing: moveFacing,
          };
        }
        return c;
      });

      // Spawn movement dust trails
      for (let d = 0; d < 6; d++) {
        setParticles((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substr(2, 9),
            type: 'smoke',
            currentX: oldX + (x - oldX) * (d / 6) + (Math.random() - 0.5) * 0.2,
            currentY: oldY + (y - oldY) * (d / 6) + (Math.random() - 0.5) * 0.2,
            color: 'rgba(255, 255, 255, 0.25)',
            size: 3 + Math.random() * 5,
            life: 1.0,
            maxLife: 20 + Math.random() * 15,
            velocity: { x: (Math.random() - 0.5) * 0.01, y: -0.01 },
          }
        ]);
      }

      setGameState((prev) => ({
        ...prev,
        characters: updatedChars,
        selectedAction: null,
        logs: addLog(prev.logs, `🏃 ${activeChar.name} se desplaza a la posición (${x}, ${y}).`, 'info'),
      }));
    }

    // 2. PRIMARY ATTACK ACTION
    else if (gameState.selectedAction === 'shoot') {
      const targetChar = gameState.characters.find(c => !c.isDead && c.isEnemy && c.gridX === x && c.gridY === y);
      if (!targetChar) return;

      // Zoom out to isometric during combat execution!
      setGameState((prev) => ({ ...prev, viewMode: 'isometric' }));

      // Weapon specs
      const isAssault = activeChar.class === 'assault';
      const shotsCount = isAssault ? 3 : 1;
      let bulletSpeed = 250;

      // Shooting Tracers and visual feedback
      const spawnShots = async () => {
        let bulletsFired = 0;
        let bulletsHit = 0;
        let totalDamage = 0;

        let nextChars = [...gameState.characters];

        // Shoot bullets sequentially with delays
        for (let i = 0; i < shotsCount; i++) {
          await new Promise((resolve) => setTimeout(resolve, i * 150));

          // Re-calculate details on fresh state
          const currentTarget = nextChars.find(c => c.id === targetChar.id);
          if (!currentTarget || currentTarget.isDead) break;

          const shotDetails = calculateShot(activeChar, currentTarget, gameState.grid);
          const isHit = Math.random() * 100 <= shotDetails.finalAccuracy;

          bulletsFired++;

          // Tracer particle
          const tracer: Particle = {
            id: Math.random().toString(36).substr(2, 9),
            type: activeChar.class === 'snipers' ? 'laser' : 'bullet',
            startX: activeChar.gridX,
            startY: activeChar.gridY,
            endX: targetChar.gridX,
            endY: targetChar.gridY,
            currentX: activeChar.gridX,
            currentY: activeChar.gridY,
            color: activeChar.class === 'medic' ? '#fb7185' : activeChar.class === 'snipers' ? '#38bdf8' : '#f59e0b',
            size: activeChar.class === 'snipers' ? 4 : 2,
            life: 1.0,
            maxLife: 10,
          };
          setParticles((prev) => [...prev, tracer]);

          if (isHit) {
            bulletsHit++;
            const dmg = shotDetails.finalDamage;
            totalDamage += dmg;

            let dmgRemaining = dmg;
            let sDmg = 0;
            let hDmg = 0;

            nextChars = nextChars.map((c) => {
              if (c.id === targetChar.id) {
                if (c.shield > 0) {
                  sDmg = Math.min(c.shield, dmgRemaining);
                  dmgRemaining -= sDmg;
                }
                hDmg = Math.min(c.hp, dmgRemaining);
                const nextHp = Math.max(0, c.hp - hDmg);
                return {
                  ...c,
                  shield: c.shield - sDmg,
                  hp: nextHp,
                  isDead: nextHp <= 0,
                };
              }
              return c;
            });

            // Spark impact debris on targets
            setTimeout(() => {
              spawnFloatingText(targetChar.gridX, targetChar.gridY, `-${dmg}`, '#22c55e', isAssault ? 14 : 22);
              
              // Spark effects
              for (let spark = 0; spark < 6; spark++) {
                setParticles((prev) => [...prev, {
                  id: Math.random().toString(36).substr(2, 9),
                  type: 'debris',
                  currentX: targetChar.gridX,
                  currentY: targetChar.gridY,
                  color: sDmg > 0 ? '#38bdf8' : '#ef4444',
                  size: 1.5 + Math.random() * 2,
                  life: 1.0,
                  maxLife: 12,
                  velocity: { x: (Math.random() - 0.5) * 0.04, y: (Math.random() - 0.5) * 0.04 },
                }]);
              }
            }, 100);
          } else {
            setTimeout(() => {
              spawnFloatingText(targetChar.gridX, targetChar.gridY, '¡FALLÓ!', '#9ca3af', 13);
            }, 100);
          }
        }

        // Apply Ammo depletion and AP depletion
        const ammoUsed = isAssault ? 3 : 1;
        const targetStateChar = nextChars.find(c => c.id === targetChar.id);
        const isDeadNow = targetStateChar?.isDead || false;

        nextChars = nextChars.map((c) => {
          if (c.id === activeChar.id) {
            return {
              ...c,
              ammo: Math.max(0, c.ammo - ammoUsed),
              ap: c.ap - 1,
            };
          }
          return c;
        });

        // Compute result and log
        let resultMsg = `🔫 ${activeChar.name} atacó a ${targetChar.name}. `;
        if (bulletsHit > 0) {
          resultMsg += `¡IMPACTO! Realizó ${bulletsHit}/${bulletsFired} disparos exitosos, causando un total de ${totalDamage} de daño físico.`;
          if (isDeadNow) {
            resultMsg += ` 💀 ${targetChar.name} ha sido pulverizado.`;
          }
        } else {
          resultMsg += '❌ Todos los disparos fallaron o fueron evadidos por la cobertura enemiga.';
        }

        setGameState((prev) => {
          // Check if all enemies are dead (Victory)
          const enemiesLeft = nextChars.filter(c => c.isEnemy && !c.isDead).length;
          const isVictory = enemiesLeft === 0;

          return {
            ...prev,
            characters: nextChars,
            selectedAction: null,
            viewMode: 'isometric', // Return to planning unless victory
            gameStatus: isVictory ? 'victory' : 'playing',
            logs: addLog(prev.logs, resultMsg, 'player_attack'),
            stats: {
              ...prev.stats,
              damageDealt: prev.stats.damageDealt + totalDamage,
              shotsFired: prev.stats.shotsFired + bulletsFired,
              shotsHit: prev.stats.shotsHit + bulletsHit,
              enemiesKilled: prev.stats.enemiesKilled + (isDeadNow ? 1 : 0),
            },
          };
        });
      };

      spawnShots();
    }

    // 3. GRENADE EXPLOSION (AoE)
    else if (gameState.selectedAction === 'grenade') {
      const activeChar = gameState.characters.find(c => c.id === gameState.activeCharacterId);
      if (!activeChar || (activeChar.class !== 'snipers' && activeChar.class !== 'assault')) return;

      const dist = getDistance(activeChar.gridX, activeChar.gridY, x, y);
      if (dist > 5) {
        spawnFloatingText(x, y, 'FUERA DE RANGO', '#ef4444', 12);
        return;
      }

      // Zoom out to see arc and blast
      setGameState((prev) => ({ ...prev, viewMode: 'isometric' }));

      // Simulate grenade flight path with smoke trail, then detonate
      const tracer: Particle = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'bullet', // slow grenade dot
        startX: activeChar.gridX,
        startY: activeChar.gridY,
        endX: x,
        endY: y,
        currentX: activeChar.gridX,
        currentY: activeChar.gridY,
        color: '#f97316',
        size: 5,
        life: 1.0,
        maxLife: 25, // takes 25 frames
      };
      setParticles((prev) => [...prev, tracer]);

      setTimeout(() => {
        // Explosion effects!
        spawnExplosionParticles(x, y);

        // Calculate damage to characters in 1-cell radius
        let nextChars = [...gameState.characters];
        let dmgDealtTotal = 0;
        let victims: string[] = [];

        // Cover check can also be destroyed in grid!
        let nextGrid = [...gameState.grid];

        // Break cover in the center and adjacent
        for (let gx = -1; gx <= 1; gx++) {
          for (let gy = -1; gy <= 1; gy++) {
            const tx = x + gx;
            const ty = y + gy;
            if (tx >= 0 && tx < 7 && ty >= 0 && ty < 7) {
              const cell = nextGrid[tx]?.[ty];
              if (cell && cell.coverType !== 'none') {
                // Destroy cover!
                nextGrid[tx] = [
                  ...nextGrid[tx],
                ];
                nextGrid[tx][ty] = {
                  ...cell,
                  coverType: 'none',
                  coverDirection: undefined,
                  coverHealth: 0,
                };
              }
            }
          }
        }

        nextChars = nextChars.map((char) => {
          if (char.isDead) return char;

          const distanceToBlast = getDistance(char.gridX, char.gridY, x, y);
          if (distanceToBlast <= 1) {
            // Splash damage 35 guaranteed
            const dmg = 35;
            dmgDealtTotal += dmg;
            victims.push(char.name.split(' ')[0]);

            let currentHp = char.hp;
            let currentShield = char.shield;

            if (currentShield > 0) {
              const sDmg = Math.min(currentShield, dmg);
              currentShield -= sDmg;
              currentHp -= Math.max(0, dmg - sDmg);
            } else {
              currentHp -= dmg;
            }

            const nextHp = Math.max(0, currentHp);
            
            spawnFloatingText(char.gridX, char.gridY, '-35💣', '#f97316', 18);

            return {
              ...char,
              hp: nextHp,
              shield: currentShield,
              isDead: nextHp <= 0,
            };
          }
          return char;
        });

        // Sniper CD set and subtract AP
        nextChars = nextChars.map((c) => {
          if (c.id === activeChar.id) {
            return {
              ...c,
              ap: c.ap - 1,
              cooldowns: {
                ...c.cooldowns,
                grenade: 2, // 2 turn cooldown
              }
            };
          }
          return c;
        });

        const charType = activeChar.class === 'snipers' ? 'Sniper' : 'Asalto';
        const logMsg = `💣 ¡BOOM! ${charType} lanzó una granada frag en (${x}, ${y}). Causó 35 de daño explosivo a: ${victims.join(', ')}. Las coberturas del área han sido destruidas.`;

        setGameState((prev) => {
          const enemiesLeft = nextChars.filter(c => c.isEnemy && !c.isDead).length;
          const isVictory = enemiesLeft === 0;

          return {
            ...prev,
            characters: nextChars,
            grid: nextGrid,
            selectedAction: null,
            viewMode: 'isometric',
            gameStatus: isVictory ? 'victory' : 'playing',
            logs: addLog(prev.logs, logMsg, 'player_attack'),
            stats: {
              ...prev.stats,
              damageDealt: prev.stats.damageDealt + dmgDealtTotal,
            },
          };
        });
      }, 500);
    }

    // 4. MEDIC HEAL
    else if (gameState.selectedAction === 'heal') {
      const activeChar = gameState.characters.find(c => c.id === gameState.activeCharacterId);
      if (!activeChar || activeChar.class !== 'medic') return;

      const targetChar = gameState.characters.find(c => !c.isDead && !c.isEnemy && c.gridX === x && c.gridY === y);
      if (!targetChar) return;

      const dist = getDistance(activeChar.gridX, activeChar.gridY, targetChar.gridX, targetChar.gridY);
      if (dist > 3) {
        spawnFloatingText(x, y, 'FUERA DE RANGO', '#ef4444', 12);
        return;
      }

      setGameState((prev) => ({ ...prev, viewMode: 'isometric' }));

      // Green healing particles
      spawnHealingParticles(targetChar.gridX, targetChar.gridY);
      spawnFloatingText(targetChar.gridX, targetChar.gridY, '+45 HP', '#f43f5e', 18);

      const updatedChars = gameState.characters.map((c) => {
        if (c.id === targetChar.id) {
          return {
            ...c,
            hp: Math.min(c.maxHp, c.hp + 45),
          };
        }
        if (c.id === activeChar.id) {
          return {
            ...c,
            ap: c.ap - 1,
            cooldowns: {
              ...c.cooldowns,
              heal: 1, // 1 turn cooldown
            }
          };
        }
        return c;
      });

      setGameState((prev) => ({
        ...prev,
        characters: updatedChars,
        selectedAction: null,
        viewMode: 'isometric',
        logs: addLog(prev.logs, `💉 ${activeChar.name} inyectó nano-medicina a ${targetChar.name}. (+45 HP sanitarios)`, 'heal'),
        stats: {
          ...prev.stats,
          healingDone: prev.stats.healingDone + 45,
        }
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 flex flex-col items-center">
      {/* 1. Header with Stats Banner */}
      <header className="w-full max-w-7xl flex flex-col md:flex-row justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-4 gap-4 shadow-xl select-none relative overflow-hidden">
        {/* Decorative ambient background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 blur-3xl rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full"></div>

        <div className="flex items-center gap-3">
          <div className="bg-sky-500/10 p-2.5 border border-sky-400/20 rounded-xl">
            <Swords size={24} className="text-sky-400 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-sky-400 font-bold uppercase flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
              SISTEMA DE PRUEBA DE MECANICA - VERSIÓN MVP
            </div>
            <h1 className="text-lg md:text-xl font-bold font-mono tracking-tight text-white flex items-center gap-2">
              Tactical Squad Combat MVP
            </h1>
          </div>
        </div>

        {/* Tactical Mission Stats */}
        <div className="flex gap-4 md:gap-6 flex-wrap font-mono text-[10px] text-slate-400">
          <div className="bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/60 flex flex-col">
            <span className="text-slate-500 font-bold">DAÑO INFLIGIDO</span>
            <span className="text-green-400 font-bold text-sm">{gameState.stats.damageDealt} HP</span>
          </div>
          <div className="bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/60 flex flex-col">
            <span className="text-slate-500 font-bold">DAÑO RECIBIDO</span>
            <span className="text-red-400 font-bold text-sm">{gameState.stats.damageTaken} HP</span>
          </div>
          <div className="bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/60 flex flex-col">
            <span className="text-slate-500 font-bold">ALIENÍGENAS K.O.</span>
            <span className="text-amber-500 font-bold text-sm">{gameState.stats.enemiesKilled}</span>
          </div>
          <div className="bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/60 flex flex-col">
            <span className="text-slate-500 font-bold">PRECISIÓN MEDIA</span>
            <span className="text-sky-400 font-bold text-sm">
              {gameState.stats.shotsFired > 0 
                ? `${Math.round((gameState.stats.shotsHit / gameState.stats.shotsFired) * 100)}%`
                : '100%'}
            </span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl flex flex-col gap-4">
        {/* 1. Main Unified Screen: 100% width, taller, containing BattleCanvas with built-in top/bottom HUDs */}
        <div className="w-full flex flex-col gap-2">
          <div className="flex justify-between items-center font-mono text-xs text-slate-400 bg-slate-900/40 border border-slate-800/50 px-4 py-2.5 rounded-xl">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Brain size={14} className="text-sky-400" />
              <b>Comandante</b>, planifica el avance táctico haciendo clic directamente en tu pelotón sobre la cuadrícula.
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-slate-500">RESISTENCIA COMBATIVA:</span>
              <span className="bg-slate-950 px-2 py-0.5 rounded text-slate-300 font-bold border border-slate-800">
                {gameState.difficulty.toUpperCase()}
              </span>
            </div>
          </div>

          <BattleCanvas
            gameState={gameState}
            particles={particles}
            setParticles={setParticles}
            hoveredCell={hoveredCell}
            setHoveredCell={setHoveredCell}
            onCellClick={handleCellClick}
            onSelectAction={handleSelectAction}
            onEndPlayerTurn={handleEndPlayerTurn}
            onToggleViewMode={handleToggleViewMode}
            onResetGame={handleResetGame}
            onNextWave={handleNextWave}
          />
        </div>

        {/* 2. Secondary Info Panels Grid (Directly Under the Game Screen) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Panel 1: Detector de Hostiles y Logs */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between h-[300px] shadow-lg">
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-800/60 flex items-center gap-1.5">
                <Crosshair size={13} />
                Detector de Hostiles ({gameState.characters.filter(c => c.isEnemy && !c.isDead).length} vivos)
              </h3>
              
              {/* List of enemies */}
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[85px] mb-2 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {gameState.characters.filter(c => c.isEnemy).map((enemy) => (
                  <div 
                    key={enemy.id} 
                    className={`p-1.5 rounded border text-[10px] font-mono flex flex-col gap-0.5 ${
                      enemy.isDead ? 'bg-slate-950/20 border-slate-950 text-slate-600 line-through' : 'bg-slate-950/50 border-red-950/20 text-slate-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={enemy.isDead ? 'text-slate-600' : 'text-red-400 font-bold'}>{enemy.name}</span>
                      <span className="text-[8px] bg-red-950 text-red-400 px-1 py-0.1 rounded uppercase font-semibold">
                        {enemy.class === 'enemy_trooper' ? 'Trooper' : enemy.class === 'enemy_ranger' ? 'Ranger' : 'Heavy'}
                      </span>
                    </div>
                    {!enemy.isDead && (
                      <div className="w-full bg-slate-900 h-1 rounded overflow-hidden mt-0.5">
                        <div className="bg-red-500 h-full" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Combat Logs */}
              <div className="flex-1 flex flex-col min-h-0 border-t border-slate-800/60 pt-2">
                <div className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Historial de Operaciones
                </div>
                <div className="flex-1 overflow-y-auto text-[10px] font-mono flex flex-col gap-1 scrollbar-thin scrollbar-thumb-slate-800 pr-1">
                  {gameState.logs.length === 0 ? (
                    <span className="text-slate-600 italic">Esperando órdenes de combate...</span>
                  ) : (
                    gameState.logs.slice(-20).reverse().map((log) => {
                      let textClass = 'text-slate-400';
                      if (log.type === 'player_attack') textClass = 'text-green-400 font-semibold';
                      if (log.type === 'enemy_attack') textClass = 'text-red-400';
                      if (log.type === 'heal') textClass = 'text-rose-400 font-medium';
                      if (log.type === 'death') textClass = 'text-amber-500 font-bold';
                      if (log.type === 'system') textClass = 'text-sky-400 font-bold';

                      return (
                        <div key={log.id} className="border-b border-slate-800/20 pb-0.5">
                          <span className="text-slate-600 mr-1">[{log.timestamp}]</span>
                          <span className={textClass}>{log.message}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Guía Rápida de Juego (moved here, under the screen!) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between h-[300px] shadow-lg select-none">
            <div>
              <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-2 pb-1.5 border-b border-slate-800 flex items-center gap-1">
                <Info size={13} className="text-sky-400" /> Guía Rápida de Juego
              </h3>
              <p className="text-slate-400 text-[10px] leading-relaxed mb-2.5">
                Haz clic directamente en un personaje en el mapa para seleccionarlo. Elige una habilidad y un objetivo:
              </p>
              
              <div className="flex flex-col gap-2 font-mono text-[9px]">
                <div className="bg-slate-950/50 border border-slate-800/60 p-2 rounded">
                  <div className="font-bold text-sky-400">1. SELECCIONAR / MOVER:</div>
                  <div className="text-slate-400 mt-0.5">Haz clic sobre un soldado aliado. Selecciona "Mover" y haz clic sobre las celdas verdes.</div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800/60 p-2 rounded">
                  <div className="font-bold text-red-400">2. APUNTAR / DISPARAR:</div>
                  <div className="text-slate-400 mt-0.5">Selecciona "Disparar" y haz clic sobre un enemigo alienígena en el mapa para dispararle.</div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800/60 p-2 rounded">
                  <div className="font-bold text-amber-400">3. RECARGAR / TRINCHERA:</div>
                  <div className="text-slate-400 mt-0.5">Recarga consume 1 AP. Trinchera pasa el turno y otorga defensa.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Sandbox / balance configurations in full width */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg select-none">
          <SkirmishConfig
            gameState={gameState}
            onUpdateDifficulty={handleUpdateDifficulty}
            onToggleEndless={() => setGameState((prev) => ({ ...prev, isEndless: !prev.isEndless }))}
            onModifyStat={handleModifyStat}
            onResetGame={handleResetGame}
            onTriggerAI={() => triggerEnemyAISequence(gameState)}
          />
        </div>

        {/* 3. Mechanics Breakdown (bottom) */}
        <MechanicsExplainer />
      </main>

      <footer className="w-full max-w-7xl text-center text-slate-600 font-mono text-[10px] mt-8 pb-8 select-none">
        Tactical Squad Combat MVP Prototype • Diseñado en React para probar mecánicas divertidas • 2026
      </footer>
    </div>
  );
}
