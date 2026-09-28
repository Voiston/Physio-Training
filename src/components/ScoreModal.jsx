import { useState } from 'react';
import { Heart, Dumbbell, Zap, Flame, ShieldAlert } from 'lucide-react';

export default function ScoreModal({ info, qualities, onClose, onSave }) {
  const existing = info.currentData || { rpeMusc: '', rpeCardio: '', fatigue: '', duration: '', isEccentric: false };
  
  const [rpeMusc, setRpeMusc] = useState(existing.rpeMusc || '');
  const [rpeCardio, setRpeCardio] = useState(existing.rpeCardio || '');
  const [fatigue, setFatigue] = useState(existing.fatigue || '');
  const [duration, setDuration] = useState(existing.duration || '');
  const [isEccentric, setIsEccentric] = useState(
    existing.isEccentric !== undefined 
      ? existing.isEccentric 
      : (info.qId === 'descente' || info.qId === 'plyo')
  );
  const [applyImpacts, setApplyImpacts] = useState(true);

  // Derive impacts for display
  const qDef = qualities.find(q => q.id === info.qId);
  const hasImpacts = qDef && qDef.impacts && qDef.impacts.length > 0;

  // Calcul Multi-Facteurs (Cardio vs Musculaire vs Excentrique)
  const numDur = Number(duration) || 0;
  const numCardio = Number(rpeCardio) || 0;
  const numMusc = Number(rpeMusc) || 0;

  const eccentricMultiplier = isEccentric ? 1.35 : 1.0;
  const loadCardio = Math.round(numDur * numCardio);
  const loadMusc = Math.round(numDur * numMusc * eccentricMultiplier);
  
  // Charge globale équilibrée
  const load = numDur && numCardio && numMusc
    ? Math.round((loadCardio + loadMusc) / 2)
    : 0;

  // Dominance métabolique
  const totalFactor = (loadCardio + loadMusc) || 1;
  const cardioPercent = Math.round((loadCardio / totalFactor) * 100);
  const muscPercent = 100 - cardioPercent;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (rpeMusc && rpeCardio && fatigue && duration) {
      onSave({ 
        rpeMusc: Number(rpeMusc), 
        rpeCardio: Number(rpeCardio), 
        fatigue: Number(fatigue), 
        duration: Number(duration), 
        load,
        loadCardio,
        loadMusc,
        isEccentric: Boolean(isEccentric)
      }, applyImpacts);
    } else {
      onSave(null, applyImpacts);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content !max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-100 tracking-tight m-0">{info.qName}</h3>
            <p className="text-xs font-semibold text-blue-400 mt-0.5 mb-4">Séance du {info.dateStr}</p>
          </div>
          {isEccentric && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
              <Zap size={11} className="text-amber-400" /> Excentrique (+35%)
            </span>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="input-group">
            <label className="text-xs font-medium text-slate-300">Durée effective (min)</label>
            <input type="number" min="1" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} autoFocus placeholder="Ex: 45" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="input-group !mb-0 p-2.5 rounded-xl bg-red-950/20 border border-red-500/20">
              <label className="text-xs font-semibold text-red-300 flex items-center gap-1">
                <Dumbbell size={13} className="text-red-400" /> RPE Musculaire
              </label>
              <input type="number" min="1" max="10" placeholder="1-10" value={rpeMusc} onChange={(e) => setRpeMusc(e.target.value)} />
              <span className="text-[10px] text-slate-400 mt-1 block">Tension, fibres, cuisses</span>
            </div>

            <div className="input-group !mb-0 p-2.5 rounded-xl bg-sky-950/20 border border-sky-500/20">
              <label className="text-xs font-semibold text-sky-300 flex items-center gap-1">
                <Heart size={13} className="text-sky-400" /> RPE Cardio
              </label>
              <input type="number" min="1" max="10" placeholder="1-10" value={rpeCardio} onChange={(e) => setRpeCardio(e.target.value)} />
              <span className="text-[10px] text-slate-400 mt-1 block">Souffle, FC, ventilation</span>
            </div>
          </div>

          {/* Option Excentrique & Chocs structurels */}
          <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input 
                type="checkbox" 
                checked={isEccentric} 
                onChange={e => setIsEccentric(e.target.checked)} 
                className="mt-0.5 rounded accent-amber-500" 
              />
              <div className="text-left">
                <span className="text-xs font-semibold text-amber-300 block flex items-center gap-1">
                  <Flame size={12} className="text-amber-400" /> Stress Excentrique & Impacts Musculaires Élevés
                </span>
                <span className="text-[10px] text-slate-400 block leading-tight mt-0.5">
                  Descente trail, pliométrie, charges lourdes. Multiplie la contrainte structurelle (+35% créatine-kinase, 72h de régénération).
                </span>
              </div>
            </label>
          </div>

          <div className="input-group">
            <label className="text-xs font-medium text-slate-300">Fatigue Perçue Globale Post-Séance (1-10)</label>
            <input type="number" min="1" max="10" value={fatigue} onChange={(e) => setFatigue(e.target.value)} placeholder="Niveau d'épuisement général" />
          </div>

          {/* Décomposition TRIMP Multi-Facteurs */}
          <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-semibold">Charge Globale Totale :</span>
              <strong className="text-lg font-mono font-bold text-white">
                {load > 0 ? load : '-'}
              </strong>
            </div>

            {load > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20">
                    <span className="text-[10px] text-sky-300 block flex items-center justify-center gap-1">
                      <Heart size={10} /> Charge Cardio
                    </span>
                    <span className="font-bold font-mono text-sky-200">{loadCardio}</span>
                    <span className="text-[9px] text-slate-400 block">{cardioPercent}%</span>
                  </div>

                  <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <span className="text-[10px] text-red-300 block flex items-center justify-center gap-1">
                      <Dumbbell size={10} /> Charge Musculaire
                    </span>
                    <span className="font-bold font-mono text-red-200">
                      {loadMusc} {isEccentric && <span className="text-[9px] text-amber-400 font-normal">x1.35</span>}
                    </span>
                    <span className="text-[9px] text-slate-400 block">{muscPercent}%</span>
                  </div>
                </div>

                {/* Barre de répartition */}
                <div className="w-full h-1.5 rounded-full overflow-hidden flex bg-white/10">
                  <div className="bg-sky-400 h-full transition-all" style={{ width: `${cardioPercent}%` }} />
                  <div className="bg-red-400 h-full transition-all" style={{ width: `${muscPercent}%` }} />
                </div>
              </>
            )}

            {hasImpacts && (
              <div className="pt-2 border-t border-white/10">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-blue-300 hover:text-blue-200 transition-colors">
                  <input type="checkbox" checked={applyImpacts} onChange={e => setApplyImpacts(e.target.checked)} className="rounded border-none accent-blue-500" />
                  <span>
                    Appliquer impacts secondaires ({qDef.impacts.map(i => {
                      const targetName = qualities.find(q => q.id === i.id)?.name || i.id;
                      return `${targetName} ${i.ratio * 100}%`;
                    }).join(', ')})
                  </span>
                </label>
              </div>
            )}
            {existing?.isSecondary && (
              <div className="text-[11px] text-amber-400 flex items-center gap-1">
                <ShieldAlert size={12} /> Séance calculée automatiquement comme impact secondaire.
              </div>
            )}
          </div>

          <div className="modal-actions pt-2">
            <button type="button" className="btn-delete" onClick={() => { onSave(null); onClose(); }}>Supprimer</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-save">Valider</button>
          </div>
        </form>
      </div>
    </div>
  );
}

