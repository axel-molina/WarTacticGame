import React from 'react';
import { Difficulty, GameState } from '../types';
import { Sliders, RefreshCw, Sparkles, Swords, Zap } from 'lucide-react';

interface SkirmishConfigProps {
  gameState: GameState;
  onUpdateDifficulty: (diff: Difficulty) => void;
  onToggleEndless: () => void;
  onModifyStat: (charId: string, stat: 'hp' | 'shield' | 'ap' | 'ammo', value: number) => void;
  onResetGame: () => void;
  onTriggerAI: () => void;
}

export const SkirmishConfig: React.FC<SkirmishConfigProps> = ({
  gameState,
  onUpdateDifficulty,
  onToggleEndless,
  onModifyStat,
  onResetGame,
  onTriggerAI,
}) => {
  return (
    <div className="font-mono text-xs text-slate-300 flex flex-col justify-between h-full select-none">
      <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-800 pb-2">
        <Sliders size={14} />
        Consola de Balance y Sandbox (MVP Tool)
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Game Mode & Difficulty Settings */}
        <div className="flex flex-col gap-3">
          <div className="text-slate-400 font-bold uppercase tracking-wide text-[10px] flex items-center gap-1">
            <Swords size={12} className="text-amber-500" /> Dificultad y Reglas
          </div>
          
          {/* Difficulty Button group */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">NIVEL DE AMENAZA:</span>
            <div className="grid grid-cols-3 gap-1">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map((diff) => (
                <button
                  key={diff}
                  onClick={() => onUpdateDifficulty(diff)}
                  className={`py-1.5 rounded font-bold text-[10px] capitalize border transition ${
                    gameState.difficulty === diff
                      ? 'bg-sky-500/10 border-sky-400 text-sky-400'
                      : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                  }`}
                >
                  {diff === 'easy' ? 'Fácil' : diff === 'normal' ? 'Normal' : 'Pesadilla'}
                </button>
              ))}
            </div>
          </div>

          {/* Endless Mode Toggle */}
          <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded border border-slate-800/40">
            <div>
              <span className="text-[10px] text-slate-300 block font-bold">Modo Infinito / Oleadas</span>
              <span className="text-[9px] text-slate-500 block">Siguiente oleada escala +15% vitalidad</span>
            </div>
            <button
              onClick={onToggleEndless}
              className={`px-2.5 py-1 rounded font-bold text-[9px] border transition ${
                gameState.isEndless
                  ? 'bg-green-500/10 border-green-400 text-green-400'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {gameState.isEndless ? 'ACTIVO' : 'DESACTIVADO'}
            </button>
          </div>
        </div>

        {/* 2. Real-Time Adjuster for Testing */}
        <div className="flex flex-col gap-2 md:col-span-2">
          <div className="text-slate-400 font-bold uppercase tracking-wide text-[10px] flex items-center gap-1">
            <Zap size={12} className="text-amber-500" />
            Ajustar Soldados de la Resistencia en Caliente (¡Experimenta!)
          </div>
          <span className="text-[9px] text-slate-500 -mt-1 block">Modifica los atributos para encontrar el ritmo perfecto:</span>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
            {gameState.characters.filter(c => !c.isEnemy && !c.isDead).map((char) => (
              <div key={char.id} className="bg-slate-950/50 border border-slate-800/60 p-2.5 rounded-lg flex flex-col gap-2">
                <span className="font-bold text-white text-[10px] truncate border-b border-slate-800 pb-1">{char.name.split(' ')[0]}</span>
                
                <div className="flex flex-col gap-1 text-[9px]">
                  {/* HP Adjuster */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Vida ({char.hp}):</span>
                    <div className="flex gap-1">
                      <button onClick={() => onModifyStat(char.id, 'hp', -15)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-red-400">-15</button>
                      <button onClick={() => onModifyStat(char.id, 'hp', 25)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-green-400">+25</button>
                    </div>
                  </div>

                  {/* Shield Adjuster */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Escudo ({char.shield}):</span>
                    <div className="flex gap-1">
                      <button onClick={() => onModifyStat(char.id, 'shield', -10)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-red-400">-10</button>
                      <button onClick={() => onModifyStat(char.id, 'shield', 15)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-green-400">+15</button>
                    </div>
                  </div>

                  {/* AP Adjuster */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">AP actual ({char.ap}):</span>
                    <div className="flex gap-1">
                      <button onClick={() => onModifyStat(char.id, 'ap', -1)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-red-400">-1</button>
                      <button onClick={() => onModifyStat(char.id, 'ap', 1)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-green-400">+1</button>
                    </div>
                  </div>

                  {/* Ammo Adjuster */}
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Balas ({char.ammo}):</span>
                    <div className="flex gap-1">
                      <button onClick={() => onModifyStat(char.id, 'ammo', -1)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-red-400">-1</button>
                      <button onClick={() => onModifyStat(char.id, 'ammo', 1)} className="bg-slate-800 hover:bg-slate-700 px-1 py-0.2 rounded font-bold text-green-400">+1</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-2 border-t border-slate-800/80 mt-3 pt-3 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={onResetGame}
            className="bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 py-1.5 px-3 rounded font-bold text-[10px] flex items-center gap-1 text-slate-300 transition"
          >
            <RefreshCw size={12} className="text-sky-400" />
            Reiniciar Campo de Batalla
          </button>
          
          <button
            onClick={onTriggerAI}
            disabled={gameState.turnOwner !== 'enemy' || gameState.gameStatus !== 'playing'}
            className="bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 py-1.5 px-3 rounded font-bold text-[10px] flex items-center gap-1 text-red-400 transition disabled:opacity-40"
          >
            <Sparkles size={12} />
            Forzar Turno IA Enemiga
          </button>
        </div>
        <div className="text-[9px] text-slate-500 flex items-center italic">
          * Herramienta del Diseñador: usa este sandbox para equilibrar las clases y evaluar la diversión.
        </div>
      </div>
    </div>
  );
};
