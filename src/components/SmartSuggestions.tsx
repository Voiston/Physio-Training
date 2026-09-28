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

      {/* Recommendations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayList.map(item => {
          const isCritical = item.urgencyLevel === 'CRITICAL';
          const isHigh = item.urgencyLevel === 'HIGH';
          
          return (
            <div 
              key={item.quality.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                isCritical 
                  ? 'bg-red-950/20 border-red-500/40 hover:border-red-500/60 shadow-[0_4px_15px_rgba(239,68,68,0.08)]' 
                  : isHigh 
                  ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50' 
                  : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
              }`}
            >
              <div>
                {/* Header row with quality name & rank */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                      #{item.rank}
                    </span>
                    <span className="font-bold text-sm text-white truncate">
                      {item.quality.name}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 shrink-0 ${getBadgeStyle(item.urgencyLevel)}`}>
                    {getUrgencyIcon(item.urgencyLevel)}
                    <span>{item.urgencyBadge}</span>
                  </span>
                </div>

                {/* Block focus indicator if applicable */}
                {item.isBlockFocus && (
                  <div className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold mb-1">
                    <Zap size={11} className="text-amber-400" />
                    <span>Focus du cycle actif : répétition fréquente requise</span>
                  </div>
                )}

                {/* Reason description */}
                <p className="text-[11px] text-slate-300 leading-snug mb-2 font-sans">
                  {item.reason}
                </p>
              </div>

              {/* Bottom action bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-1 text-[11px]">
                <span className="text-[10px] text-slate-400 italic">
                  {item.actionTip}
                </span>

                <button
                  onClick={() => onOpenSessionModal(item.quality)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs shadow-md transition-colors cursor-pointer shrink-0 ml-2"
                >
                  <Play size={11} className="fill-white" />
                  <span>Saisir</span>
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
