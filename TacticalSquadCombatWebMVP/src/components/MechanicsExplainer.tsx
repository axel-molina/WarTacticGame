import React from 'react';
import { HelpCircle, Shield, Target, Award, Heart, ShieldAlert, Zap } from 'lucide-react';

export const MechanicsExplainer: React.FC = () => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mt-4 font-sans">
      <h3 className="text-sm font-bold font-mono text-sky-400 uppercase tracking-wider mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-2">
        <HelpCircle size={16} />
        Análisis del Loop de Juego y Propuesta de Diseño MVP
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-300 leading-relaxed">
        {/* Column 1: Core Mechanics implemented */}
        <div>
          <h4 className="font-bold font-mono text-white mb-2 flex items-center gap-1">
            <Award size={14} className="text-amber-400" />
            Mecánicas del MVP y Fórmulas del Combate
          </h4>
          <p className="mb-3 text-slate-400">
            Hemos diseñado este prototipo para probar la viabilidad del combate táctico por turnos de soldados, enriquecido con la especialización característica de los juegos de criaturas coleccionables (estilo Pokémon).
          </p>
          <ul className="flex flex-col gap-2.5">
            <li className="bg-slate-950/40 p-2.5 rounded border border-slate-800/40">
              <strong className="text-sky-400 block font-mono">🌐 Sistema de Coberturas (Fórmula Activa)</strong>
              La cobertura es direccional y se calcula según el ángulo de ataque del agresor. 
              <ul className="list-disc pl-4 mt-1 text-slate-400 text-[11px] flex flex-col gap-0.5">
                <li><b className="text-white">Parapeto Alto (Cobertura Total):</b> Reduce un <b className="text-white">45%</b> la probabilidad de acierto del enemigo y absorbe el <b className="text-white">50%</b> del daño recibido.</li>
                <li><b className="text-white">Parapeto Medio (Cobertura Parcial):</b> Reduce un <b className="text-white">25%</b> el acierto y absorbe el <b className="text-white">25%</b> de daño.</li>
                <li><b className="text-white">Trinchera (Hunker Down):</b> Pasar el turno añade un <b className="text-white">+15% de defensa</b> extra y <b className="text-white">15% de reducción de daño</b> hasta el siguiente turno.</li>
              </ul>
            </li>
            
            <li className="bg-slate-950/40 p-2.5 rounded border border-slate-800/40">
              <strong className="text-emerald-400 block font-mono">📐 Dulce de Distancia (Efecto de Armas)</strong>
              Cada clase tiene una distancia óptima que penaliza drásticamente el error de colocación:
              <ul className="list-disc pl-4 mt-1 text-slate-400 text-[11px] flex flex-col gap-0.5">
                <li><b>Asalto (Ametralladora):</b> Máximo rendimiento a media distancia (3-4 casillas, +15% acierto).</li>
                <li><b>Sniper (Fusil Pesado):</b> Brutal a larga distancia (5+ casillas, +20% acierto), pero penalización masiva a corta distancia (-45% acierto).</li>
                <li><b>Médico (Escopeta):</b> Letal en distancias cortas (1-2 casillas, +25% acierto), pero ineficaz a larga distancia.</li>
              </ul>
            </li>

            <li className="bg-slate-950/40 p-2.5 rounded border border-slate-800/40">
              <strong className="text-amber-400 block font-mono">⚡ Economía de Acción (Estilo XCOM)</strong>
              Cada soldado cuenta con <b>2 Puntos de Acción (AP)</b>. Moverte cuesta 1 AP. Atacar, curar o recargar consume 1 AP. Puedes moverte y atacar en la misma ronda, o moverte dos veces.
            </li>
          </ul>
        </div>

        {/* Column 2: Creative feedback on "How to make it more fun" */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800">
            <h4 className="font-bold font-mono text-white mb-2 flex items-center gap-1">
              <Target size={14} className="text-red-400" />
              ¿Cómo Combinar Pokémon y Soldados? (Dirección de Juego)
            </h4>
            <p className="text-slate-400 text-[11px] mb-2">
              Para lograr que este híbrido sea adictivo, sugerimos incorporar estas mecánicas en futuras iteraciones de tu diseño:
            </p>
            <div className="flex flex-col gap-2 text-[11px]">
              <div className="border-l-2 border-sky-400 pl-2">
                <b className="text-sky-300">1. Reclutamiento y Evolución (Coleccionismo):</b>
                <span className="text-slate-400 block">En lugar de criaturas, reclutas reclutas genéricos. Con experiencia, &quot;evolucionan&quot; en ramificaciones únicas: Asalto Ligero, Comando de Fuego, Médico de Campo Químico o Francotirador Invisible.</span>
              </div>
              <div className="border-l-2 border-emerald-400 pl-2">
                <b className="text-emerald-300">2. Sistema Elemental de Munición:</b>
                <span className="text-slate-400 block">Equipar balas de fuego (quema armaduras de hoja), balas criogénicas (ralentiza e impide el movimiento de alienígenas veloces) o munición EMP (desactiva escudos tecnológicos). ¡El círculo de debilidades de Pokémon llevado a la balística militar!</span>
              </div>
              <div className="border-l-2 border-rose-400 pl-2">
                <b className="text-rose-300">3. Captura de Enemigos (&quot;Pokébolas&quot; de Estasis):</b>
                <span className="text-slate-400 block">Desarrollar granadas de estasis para capturar alienígenas cuando les quede poca vida, pudiendo domesticarlos e incorporarlos en tu escuadrón militar como vanguardia biológica.</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 flex-1">
            <h4 className="font-bold font-mono text-white mb-2 flex items-center gap-1">
              <Heart size={14} className="text-rose-500" />
              Reglas de Oro del Balance Táctico
            </h4>
            <div className="text-[11px] text-slate-400 flex flex-col gap-2">
              <p>
                <b>El Sniper:</b> Al tener solo 1 bala en la recámara, su loop exige un ciclo riguroso de: <span className="text-white">Disparar ➔ Recargar (gastar turno/AP) ➔ Buscar Cobertura</span>. Su granada permite limpiar el parapeto del enemigo para que el Asalto remate al objetivo descubierto.
              </p>
              <p>
                <b>El Médico:</b> La escopeta te fuerza a jugar ofensivo y cercano, pero su rol primordial es mantener vivo al equipo. ¿Sanas al Sniper para que mantenga la posición alta o avanzas a disparar la escopeta arriesgando tu salud? Esa disyuntiva es lo que genera tensión y diversión.
              </p>
              <p>
                <b>El Asalto:</b> Al realizar ráfagas de 3 disparos, tiene mayor probabilidad de asestar daño parcial (incluso si la probabilidad de acierto es del 60%, estadísticamente alguna bala suele impactar). Es ideal para desgastar escudos.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
