import { useState } from 'react';
import { 
  Sparkles, AlertTriangle, Clock, Zap, CheckCircle2, 
  ArrowUp, ArrowDown, ChevronRight, ChevronDown, ChevronUp, Play, Flame, ShieldAlert,
  ArrowUpDown, Dumbbell, Info
} from 'lucide-react';
import { Quality, TrainingRecommendation, TrainingBlock } from '../hooks/useData';
import { MuscularAlert } from '../utils/muscleHelpers';

interface SmartSuggestionsProps {
  recommendations: TrainingRecommendation[];
  activeBlock: TrainingBlock | null;
  muscularAlerts?: MuscularAlert[];
  onOpenSessionModal: (q: Quality) => void;
  onReorderByUrgency: () => void;
  onReorderByBlock: () => void;
  onResetOrder: () => void;
  onNavigateToMuscles?: () => void;
}

export default function SmartSuggestions({
  recommendations,
  activeBlock,
  muscularAlerts = [],
  onOpenSessionModal,
  onReorderByUrgency,
  onReorderByBlock,
  onResetOrder,
  onNavigateToMuscles
}: SmartSuggestionsProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [showMoreOnMobile, setShowMoreOnMobile] = useState<boolean>(false);

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
            <p className="text-[11px] text-slate-400 mt-0.5 hidden sm:block">
              Recommandations calculées selon l'ordre de priorité de vos lignes, l'état physiologique et votre bloc actif.
            </p>
          </div>
        </div>

        {/* Quick Sorting Actions */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={onReorderByUrgency}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer text-[10px] sm:text-[11px]"
            title="Place les qualités les plus désentraînées et urgentes en haut du tableau"
          >
            <ArrowUpDown size={11} className="text-amber-400" />
            <span>Urgence</span>
          </button>

          {activeBlock && (
            <button
              onClick={onReorderByBlock}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg transition-colors cursor-pointer text-[10px] sm:text-[11px]"
              title={`Place les qualités ciblées par le bloc ${activeBlock.name} en haut du tableau`}
            >
              <Dumbbell size={11} className="text-blue-400" />
              <span className="hidden sm:inline">Priorité bloc</span>
              <span className="sm:hidden">Bloc</span>
            </button>
          )}

          <button
            onClick={onResetOrder}
            className="px-1.5 sm:px-2 py-1.5 text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="Rétablir l'ordre d'origine"
          >
            Rétablir
          </button>
        </div>
      </div>

      {/* ALERTES DE DÉSÉQUILIBRES MUSCULAIRES & PRÉVENTION DES BLESSURES (FEATURE 4) */}
      {muscularAlerts.filter(a => a.type === 'danger' || a.type === 'warning').length > 0 && (
        <div className="mb-4 space-y-2">
          {muscularAlerts.filter(a => a.type === 'danger' || a.type === 'warning').map(alert => (
            <div 
              key={alert.id}
              className={`p-3 rounded-xl border backdrop-blur-md flex items-start justify-between gap-3 ${
                alert.type === 'danger'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  : 'bg-amber-950/30 border-amber-500/35 text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  alert.type === 'danger' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  <ShieldAlert size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-white">
                      {alert.title}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-slate-300 border border-white/10">
                      {alert.metric}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 mb-1.5 leading-relaxed">
                    {alert.message}
                  </p>
                  {alert.recommendations.length > 0 && (
                    <div className="text-[11px] text-blue-300 font-medium">
                      💡 Conseil coach : {alert.recommendations.join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              {onNavigateToMuscles && (
                <button
                  type="button"
                  onClick={onNavigateToMuscles}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/10 hover:bg-white/20 text-white shrink-0 border border-white/10 transition-colors cursor-pointer"
                >
                  Voir bilan →
                </button>
              )}
            </div>
          ))}
        </div>
      )}

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
            // Bouton action n°1 : fond plein vif très visible (Priorité 1 urgente)
            btnStyle = 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/35 border border-rose-400/50 font-bold';
          } else if (isRank2) {
            cardStyle = 'border-amber-500/30 bg-gradient-to-b from-amber-950/15 via-slate-900/60 to-slate-900/90 hover:border-amber-400/50';
            priorityLabel = 'Priorité 2 · À Programmer';
            priorityBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30 font-semibold';
            PriorityIcon = Clock;
            // Bouton priorité 2 : style secondaire (fond sombre avec bordure colorée) pour canaliser l'attention sur le #1
            btnStyle = 'bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 border border-amber-500/40 hover:border-amber-400 shadow-sm';
          } else {
            cardStyle = 'border-slate-700/60 bg-gradient-to-b from-slate-900/70 to-slate-950/80 hover:border-blue-500/40';
            priorityLabel = `Priorité ${index + 1} · Régularité`;
            priorityBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
            PriorityIcon = Zap;
            // Bouton priorité 3+ : style secondaire discret (fond sombre subtil avec bordure)
            btnStyle = 'bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 border border-slate-700/80 hover:border-slate-500 shadow-sm';
          }
          
          // Sur smartphone, si l'utilisateur n'a pas développé, masquer les priorités 2 et 3 pour garder l'écran aéré
          const hideOnMobile = index > 0 && !showMoreOnMobile;
          
          return (
            <div 
              key={item.quality.id}
              onClick={() => onOpenSessionModal(item.quality)}
              className={`p-3.5 sm:p-4 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer group hover:scale-[1.01] ${cardStyle} ${hideOnMobile ? 'hidden md:flex' : 'flex'}`}
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
                  <div className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold mb-1.5">
                    <Zap size={11} className="text-amber-400 shrink-0" />
                    <span>Focus du cycle actif</span>
                  </div>
                )}

                {/* Reason description - condensé sur mobile */}
                <p className="text-xs text-slate-300 leading-relaxed mb-2.5 sm:mb-3 font-sans line-clamp-2 sm:line-clamp-none">
                  {item.reason}
                </p>
              </div>

              {/* Action and Tip footer */}
              <div className="pt-2 sm:pt-2.5 border-t border-white/5 space-y-2">
                <div className="hidden sm:flex items-center justify-between text-[11px] text-slate-400">
                  <span className="italic truncate pr-2">
                    {item.actionTip}
                  </span>
                </div>

                {/* Bouton d'action épuré sur smartphone */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSessionModal(item.quality);
                  }}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${btnStyle}`}
                >
                  <Play size={12} className="fill-current" />
                  <span className="sm:hidden">Saisir la séance</span>
                  <span className="hidden sm:inline">Saisir la séance ({item.quality.name})</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bouton mobile : Dérouler/Réduire les priorités secondaires (#2, #3) */}
      {displayList.length > 1 && !isExpanded && (
        <div className="md:hidden mt-2">
          {!showMoreOnMobile ? (
            <button
              type="button"
              onClick={() => setShowMoreOnMobile(true)}
              className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 font-medium flex items-center justify-center gap-1.5 active:bg-white/15 transition-all cursor-pointer"
            >
              <span>Voir les 2 autres priorités suggérées</span>
              <ChevronDown size={14} className="text-blue-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowMoreOnMobile(false)}
              className="w-full py-1.5 px-3 text-[11px] text-slate-400 font-medium flex items-center justify-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              <span>Réduire à la priorité clé</span>
              <ChevronUp size={13} />
            </button>
          )}
        </div>
      )}

      {/* Expand/Collapse Button if more than 3 (Desktop & mode étendu) */}
      {recommendations.length > 3 && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className="text-xs text-slate-400 hover:text-white transition-colors underline cursor-pointer"
          >
            {isExpanded 
              ? 'Réduire la liste aux priorités majeures' 
              : `Voir l'analyse des ${recommendations.length} qualités physiques →`}
          </button>
        </div>
      )}

    </div>
  );
}
