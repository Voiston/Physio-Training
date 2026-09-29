import { useState } from 'react';
import { 
  Sparkles, AlertTriangle, Clock, Zap, CheckCircle2, 
  ArrowUp, ArrowDown, ChevronRight, Play, Flame, ShieldAlert,
  ArrowUpDown, Dumbbell, Info
} from 'lucide-react';
import { Quality, TrainingRecommendation, TrainingBlock } from '../hooks/useData';

interface SmartSuggestionsProps {
  recommendations: TrainingRecommendation[];
  activeBlock: TrainingBlock | null;
  onOpenSessionModal: (q: Quality) => void;
  onReorderByUrgency: () => void;
  onReorderByBlock: () => void;
  onResetOrder: () => void;
}

export default function SmartSuggestions({
  recommendations,
  activeBlock,
  onOpenSessionModal,
  onReorderByUrgency,
  onReorderByBlock,
  onResetOrder
}: SmartSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!recommendations || recommendations.length === 0) return null;

  // Filter urgent / to-work qualities (critical, high, medium)
  const urgentCount = recommendations.filter(
    r => r.urgencyLevel === 'CRITICAL' || r.urgencyLevel === 'HIGH'
  ).length;

  const displayList = isExpanded ? recommendations : recommendations.slice(0, 3);

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case 'REST':
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
      case 'CRITICAL':
        return <Flame className="w-4 h-4 text-red-400 animate-pulse" />;
      case 'HIGH':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'MEDIUM':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'LOW':
        return <Info className="w-4 h-4 text-blue-400" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    }
  };

  const getBadgeStyle = (level: string) => {
    switch (level) {
      case 'REST':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'CRITICAL':
        return 'bg-red-500/20 text-red-300 border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'LOW':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-950/30 via-slate-900/60 to-purple-950/20 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-xl text-slate-100">
      
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Suggestions & Priorités d'Entraînement
              </h3>
              {urgentCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-300 border border-red-500/30">
                  {urgentCount} séance{urgentCount > 1 ? 's' : ''} prioritaire{urgentCount > 1 ? 's' : ''}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Condition optimale
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Recommandations calculées selon l'ordre de priorité de vos lignes, l'état physiologique et votre bloc actif.
            </p>
          </div>
        </div>

        {/* Quick Sorting Actions */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={onReorderByUrgency}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer text-[11px]"
            title="Place les qualités les plus désentraînées et urgentes en haut du tableau"
          >
            <ArrowUpDown size={12} className="text-amber-400" />
            <span>Trier par urgence</span>
          </button>

          {activeBlock && (
            <button
              onClick={onReorderByBlock}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg transition-colors cursor-pointer text-[11px]"
              title={`Place les qualités ciblées par le bloc ${activeBlock.name} en haut du tableau`}
            >
              <Dumbbell size={12} className="text-blue-400" />
              <span>Priorité bloc {activeBlock.name}</span>
            </button>
          )}

          <button
            onClick={onResetOrder}
            className="px-2 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="Rétablir l'ordre d'origine"
          >
            Rétablir
          </button>
        </div>
      </div>

      {/* Recommendations Cards Grid avec Priorisation Dégradée (#1 Rouge, #2 Orange, #3 Bleu/Gris) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {displayList.map((item, index) => {
          // Hiérarchie visuelle dégradée pour éviter le syndrome "tout est rouge/prioritaire"
          const isRank1 = index === 0;
          const isRank2 = index === 1;
          const isRank3 = index >= 2;

          let cardStyle = 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700';
          let priorityLabel = `Priorité ${index + 1} · En Maintien`;
          let priorityBadgeClass = 'bg-slate-800/80 text-slate-300 border-slate-700';
          let PriorityIcon = CheckCircle2;
          let btnStyle = 'bg-white/10 hover:bg-white/20 text-slate-200 border-white/10';

          if (isRank1) {
            cardStyle = 'border-rose-500/40 bg-gradient-to-b from-rose-950/20 via-slate-900/60 to-slate-900/90 shadow-[0_4px_20px_rgba(244,63,94,0.08)] hover:border-rose-400/60';
            priorityLabel = 'Priorité 1 · Séance Clé';
            priorityBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold';
            PriorityIcon = Flame;
            btnStyle = 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30';
          } else if (isRank2) {
            cardStyle = 'border-amber-500/30 bg-gradient-to-b from-amber-950/15 via-slate-900/60 to-slate-900/90 hover:border-amber-400/50';
            priorityLabel = 'Priorité 2 · À Programmer';
            priorityBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold';
            PriorityIcon = Clock;
            btnStyle = 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/25';
          } else {
            cardStyle = 'border-slate-700/60 bg-gradient-to-b from-slate-900/70 to-slate-950/80 hover:border-blue-500/40';
            priorityLabel = `Priorité ${index + 1} · Régularité`;
            priorityBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
            PriorityIcon = Zap;
            btnStyle = 'bg-blue-600/80 hover:bg-blue-600 text-white shadow-md shadow-blue-600/20';
          }
          
          return (
            <div 
              key={item.quality.id}
              onClick={() => onOpenSessionModal(item.quality)}
              className={`p-4 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer group hover:scale-[1.01] ${cardStyle}`}
              title={`Cliquer pour enregistrer une séance pour ${item.quality.name}`}
            >
              <div>
                {/* Header row with quality name & nuanced priority badge */}
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                      #{item.rank}
                    </span>
                    <span className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors truncate">
                      {item.quality.name}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg text-[10px] border flex items-center gap-1 shrink-0 ${priorityBadgeClass}`}>
                    <PriorityIcon className="w-3.5 h-3.5" />
                    <span>{priorityLabel}</span>
                  </span>
                </div>

                {/* Block focus indicator if applicable */}
                {item.isBlockFocus && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold mb-2">
                    <Zap size={11} className="text-amber-400 shrink-0" />
                    <span>Focus du cycle actif : répétition fréquente requise</span>
                  </div>
                )}

                {/* Reason description */}
                <p className="text-xs text-slate-300 leading-relaxed mb-3 font-sans">
                  {item.reason}
                </p>
              </div>

              {/* Action and Tip footer */}
              <div className="pt-2.5 border-t border-white/5 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="italic truncate pr-2">
                    {item.actionTip}
                  </span>
                </div>

                {/* Valorisation du bouton d'action principal */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSessionModal(item.quality);
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${btnStyle}`}
                >
                  <Play size={13} className="fill-current" />
                  <span>Saisir la séance ({item.quality.name})</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expand/Collapse Button if more than 3 */}
      {recommendations.length > 3 && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="text-xs text-slate-400 hover:text-white transition-colors underline cursor-pointer"
          >
            {isExpanded 
              ? 'Réduire la liste aux 3 priorités majeures' 
              : `Voir l'analyse des ${recommendations.length} qualités physiques →`}
          </button>
        </div>
      )}

    </div>
  );
}
