import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Quality, TrainingBlock, TargetCompetition } from '../hooks/useData';
import { extractSessionLoad } from '../utils/physiology';
import { isPrimary } from '../utils/loadHelpers';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { 
  Printer, X, FileText, Activity, 
  Award, Sparkles, Heart,
  Copy, Check 
} from 'lucide-react';

interface TrainingReportModalProps {
  events: Record<string, Record<string, any>>;
  qualities: Quality[];
  dailyMetrics: Record<string, any>;
  qualitiesEMA: any;
  activeBlock: TrainingBlock | null;
  targetCompetition: TargetCompetition | null;
  fosterMetrics: any;
  banisterPerformance: any;
  cardioMuscularBalance?: any;
  onClose: () => void;
}

export const TrainingReportModal: React.FC<TrainingReportModalProps> = ({
  events,
  qualities,
  qualitiesEMA,
  activeBlock,
  targetCompetition,
  fosterMetrics,
  banisterPerformance,
  cardioMuscularBalance,
  onClose
}) => {
  const [periodDays, setPeriodDays] = useState<7 | 30>(7);
  const [coachNotes, setCoachNotes] = useState(
    "Excellente régularité sur les qualités prioritaires du bloc. Maintenir la polarisation des séances pour garder la monotonie sous le seuil de 1.5."
  );
  const [copied, setCopied] = useState(false);

  // Fermeture accessible sur touche Escape et classe pour isolation d'impression
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.body.classList.add('has-print-modal');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('has-print-modal');
    };
  }, [onClose]);

  const today = useMemo(() => new Date(), []);

  const reportDates = useMemo(() => {
    const dates: string[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dates.push(getLocalYYYYMMDD(d));
    }
    return dates;
  }, [today, periodDays]);

  const startDateStr = reportDates[0];
  const endDateStr = reportDates[reportDates.length - 1];

  // Analyse des séances sur la période
  const periodStats = useMemo(() => {
    let totalLoad = 0;
    let totalDuration = 0;
    let totalSessions = 0;
    const qualitySummary: Record<string, { count: number; duration: number; load: number }> = {};

    qualities.forEach(q => {
      qualitySummary[q.id] = { count: 0, duration: 0, load: 0 };
    });

    reportDates.forEach(dateStr => {
      Object.entries(events).forEach(([qId, dates]) => {
        const item = dates?.[dateStr];
        if (item) {
          const load = extractSessionLoad(item);
          const dur = Number(item.duration) || 0;
          const isPrimarySession = isPrimary(item);

          // Seules les séances principales comptent pour le volume de l'athlète
          if (isPrimarySession) {
            totalLoad += load;
            totalDuration += dur;
            totalSessions += 1;
          }

          if (qualitySummary[qId]) {
            if (isPrimarySession) {
              qualitySummary[qId].count += 1;
              qualitySummary[qId].duration += dur;
            }
            qualitySummary[qId].load += load;
          }
        }
      });
    });

    const avgDailyLoad = Math.round(totalLoad / periodDays);
    const avgDurationHours = Math.round((totalDuration / 60) * 10) / 10;

    return {
      totalLoad,
      totalDuration,
      totalSessions,
      avgDailyLoad,
      avgDurationHours,
      qualitySummary
    };
  }, [events, qualities, reportDates, periodDays]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    const summaryText = `📊 Bilan d'Entraînement PhysioTracker (${startDateStr} au ${endDateStr})
- Période : ${periodDays} jours (${periodStats.totalSessions} séances principales)
- Volume Total : ${periodStats.avgDurationHours}h (${periodStats.totalDuration} min)
- Charge Cumulée : ${periodStats.totalLoad} (Moyenne ${periodStats.avgDailyLoad} / jour)
- Forme TSB : ${(banisterPerformance?.current?.tsb ?? 0) >= 0 ? `+${banisterPerformance?.current?.tsb ?? 0}` : banisterPerformance?.current?.tsb} (CTL ${banisterPerformance?.current?.ctl} | ATL ${banisterPerformance?.current?.atl})
- Monotonie Foster : ${fosterMetrics?.monotony ?? 1.0} (Strain : ${fosterMetrics?.strain ?? 0})
${activeBlock ? `- Bloc actif : ${activeBlock.name}\n` : ''}${targetCompetition ? `- Objectif : ${targetCompetition.name} (${targetCompetition.date})\n` : ''}
Observations Coach :
${coachNotes}`;

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy to clipboard', e);
    }
  };

  return createPortal(
    <div 
      className="report-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto print:p-0 print:static print:bg-white print:overflow-visible print:inset-auto print:z-auto print:block print:w-full print:h-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      aria-describedby="report-modal-desc"
    >
      <div 
        className="report-modal-container w-full max-w-4xl bg-[#0d0d12] border border-white/20 rounded-2xl shadow-2xl text-slate-100 my-auto flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black print:rounded-none print:w-full print:max-w-none print:m-0 print:p-0"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Barre d'outils supérieure (masquée à l'impression) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 p-4 border-b border-white/10 bg-white/5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <FileText size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 id="report-modal-title" className="text-base font-bold text-white">Bilan & Rapport d'Entraînement</h2>
              <p id="report-modal-desc" className="text-xs text-slate-400">Synthèse scientifique prête pour export PDF / entraîneur</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div 
              className="flex items-center bg-black/60 p-1 rounded-xl border border-white/15 text-xs"
              role="group"
              aria-label="Sélection de la période d'analyse"
            >
              <button
                type="button"
                onClick={() => setPeriodDays(7)}
                aria-pressed={periodDays === 7}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  periodDays === 7 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                7 Jours (Hebdo)
              </button>
              <button
                type="button"
                onClick={() => setPeriodDays(30)}
                aria-pressed={periodDays === 30}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  periodDays === 30 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                30 Jours (Mensuel)
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopySummary}
              aria-label="Copier la synthèse du rapport dans le presse-papier"
              className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white font-semibold text-xs border border-white/15 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
              title="Copier la synthèse"
            >
              {copied ? (
                <>
                  <Check size={16} className="text-emerald-400 stroke-[3]" aria-hidden="true" />
                  <span className="text-emerald-400">Copié !</span>
                </>
              ) : (
                <>
                  <Copy size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">Copier</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              aria-label="Générer un PDF ou imprimer le bilan d'entraînement"
              className="min-h-[44px] flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all cursor-pointer border border-blue-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
              title="Générer un PDF ou imprimer le bilan"
            >
              <Printer size={16} aria-hidden="true" />
              <span>Imprimer / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer le bilan d'entraînement"
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-colors cursor-pointer"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* CONTENU IMPRIMABLE (Zone blanche / propre pour PDF) */}
        <div className="printable-report p-6 overflow-y-auto space-y-6 text-slate-100 bg-[#0d0d12] print:bg-white print:text-black print:p-8">
          
          {/* En-tête du document */}
          <div className="flex flex-wrap items-start justify-between pb-4 border-b border-white/15 print:border-black/20 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-black tracking-tight text-white print:text-black">PhysioTracker</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-600 text-white">PRO</span>
                <span className="text-xs uppercase tracking-widest text-slate-400 print:text-gray-600 font-semibold ml-2">
                  Rapport Athlétique & Physiologique
                </span>
              </div>
              <p className="text-xs text-slate-400 print:text-gray-600">
                Période : <strong className="text-white print:text-black">{startDateStr}</strong> au <strong className="text-white print:text-black">{endDateStr}</strong> ({periodDays} jours)
              </p>
            </div>

            <div className="text-right text-xs space-y-1">
              {activeBlock && (
                <div className="inline-block px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 print:bg-gray-100 print:text-black print:border-gray-300 font-semibold">
                  Bloc : {activeBlock.name} ({activeBlock.durationWeeks} sem.)
                </div>
              )}
              {targetCompetition && (
                <div className="text-[11px] text-amber-400 print:text-amber-800 font-mono">
                  🎯 {targetCompetition.name} ({targetCompetition.date})
                </div>
              )}
            </div>
          </div>

          {/* Grille des chiffres clés */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] uppercase font-bold text-slate-400 print:text-gray-600 block">Volume Total</span>
              <span className="text-lg font-black font-mono text-white print:text-black">{periodStats.avgDurationHours}h</span>
              <span className="text-[10px] text-slate-400 print:text-gray-500 block">{periodStats.totalDuration} minutes</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] uppercase font-bold text-slate-400 print:text-gray-600 block">Charge Cumulée</span>
              <span className="text-lg font-black font-mono text-blue-400 print:text-blue-700">{periodStats.totalLoad}</span>
              <span className="text-[10px] text-slate-400 print:text-gray-500 block">Moy: {periodStats.avgDailyLoad} / jour</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] uppercase font-bold text-slate-400 print:text-gray-600 block">Forme TSB Actuelle</span>
              <span className={`text-lg font-black font-mono ${
                (banisterPerformance?.current?.tsb ?? 0) >= 0 ? 'text-emerald-400 print:text-emerald-700' : 'text-amber-400 print:text-amber-700'
              }`}>
                {(banisterPerformance?.current?.tsb ?? 0) >= 0 ? `+${banisterPerformance?.current?.tsb ?? 0}` : banisterPerformance?.current?.tsb}
              </span>
              <span className="text-[10px] text-slate-400 print:text-gray-500 block">CTL {banisterPerformance?.current?.ctl} | ATL {banisterPerformance?.current?.atl}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 print:border-gray-300 print:bg-gray-50">
              <span className="text-[10px] uppercase font-bold text-slate-400 print:text-gray-600 block">Monotonie Foster</span>
              <span className={`text-lg font-black font-mono ${
                fosterMetrics?.monotony > 2.0 ? 'text-red-400 print:text-red-700' : fosterMetrics?.monotony > 1.5 ? 'text-amber-400 print:text-amber-700' : 'text-emerald-400 print:text-emerald-700'
              }`}>
                {fosterMetrics?.monotony ?? 1.0}
              </span>
              <span className="text-[10px] text-slate-400 print:text-gray-500 block">Strain: {fosterMetrics?.strain ?? 0}</span>
            </div>
          </div>

          {/* Synthèse Banister & Sécurité ACWR */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 print:border-gray-300 print:bg-white text-xs space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-slate-300 print:text-black flex items-center gap-2">
              <Activity size={14} className="text-blue-400" /> Modèle Banister & Assimilation de la Fatigue
              <span className="text-[10px] font-mono font-normal text-slate-400 print:text-gray-600 ml-auto">
                Calibrage personnalisé : &tau;₁ (Fatigue) = {banisterPerformance?.tauFatigue || 7}j, &tau;₂ (Condition) = {banisterPerformance?.tauFitness || 28}j
              </span>
            </h3>
            <p className="text-slate-300 print:text-gray-800 leading-relaxed">
              La charge chronique (CTL / Fitness sur {banisterPerformance?.tauFitness || 28}j) s'établit à <strong>{banisterPerformance?.current?.ctl}</strong> et la fatigue aiguë récente (ATL sur {banisterPerformance?.tauFatigue || 7}j) à <strong>{banisterPerformance?.current?.atl}</strong>.
              Le ratio ACWR moyen est de <strong>{banisterPerformance?.current?.acwr ?? 1}</strong>
              {(banisterPerformance?.current?.acwr ?? 1) > 1.5 ? (
                <span className="text-red-400 print:text-red-700 font-bold"> (Zone critique de surmenage, veillez à alléger la fin de cycle).</span>
              ) : (banisterPerformance?.current?.acwr ?? 1) >= 0.8 ? (
                <span className="text-emerald-400 print:text-emerald-700 font-bold"> (Zone de stimulus et développement optimal).</span>
              ) : (
                <span className="text-blue-400 print:text-blue-700 font-bold"> (Zone de récupération / affûtage).</span>
              )}
            </p>
          </div>

          {/* Balance Cardio vs Musculaire & Excentrique (RPE Différentiel) */}
          {cardioMuscularBalance && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 print:border-gray-300 print:bg-white text-xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-wider text-slate-300 print:text-black flex items-center gap-2">
                  <Heart size={14} className="text-sky-400" /> RPE Différentiel & Balance Charge (Cardio vs Musculaire)
                </h3>
                <span className="font-bold font-mono text-[11px] text-sky-400 print:text-sky-800">
                  {cardioMuscularBalance.badge}
                </span>
              </div>
              <p className="text-slate-300 print:text-gray-800 leading-relaxed">
                Répartition des contraintes sur 7 jours : <strong>{cardioMuscularBalance.cardioPercent}% Cardiorespiratoire</strong> ({cardioMuscularBalance.totalCardioLoad} pts) vs <strong>{cardioMuscularBalance.muscPercent}% Musculo-Squelettique</strong> ({cardioMuscularBalance.totalMuscLoad} pts) avec <strong>{cardioMuscularBalance.totalEccentricSessions} séance(s) à fort impact excentrique</strong>.
              </p>
              <p className="text-slate-400 print:text-gray-600 text-[11px] italic">
                {cardioMuscularBalance.recommendation}
              </p>
            </div>
          )}

          {/* Tableau détaillé des qualités athlétiques stimulées */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 print:text-black mb-2.5 flex items-center gap-2">
              <Award size={14} className="text-amber-400" /> Répartition des Qualités & Tendances EMA
            </h3>
            <div className="border border-white/10 print:border-gray-300 rounded-xl overflow-hidden">
              <table 
                className="w-full text-xs text-left" 
                aria-label="Répartition des Qualités et Tendances de charge EMA"
              >
                <caption className="sr-only">
                  Synthèse des qualités athlétiques stimulées sur la période, nombre de séances, durées cumulées, charges et tendances exponentielles EMA
                </caption>
                <thead className="bg-white/5 print:bg-gray-100 text-slate-300 print:text-gray-800 font-semibold border-b border-white/10 print:border-gray-300">
                  <tr>
                    <th scope="col" className="p-2.5 pl-3">Qualité</th>
                    <th scope="col" className="p-2.5 text-center">Séances</th>
                    <th scope="col" className="p-2.5 text-center">Durée Totale</th>
                    <th scope="col" className="p-2.5 text-center">Charge</th>
                    <th scope="col" className="p-2.5 text-center">EMA 3j</th>
                    <th scope="col" className="p-2.5 text-center">EMA 7j</th>
                    <th scope="col" className="p-2.5 text-center">EMA 21j</th>
                    <th scope="col" className="p-2.5 pr-3 text-right">Tendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 print:divide-gray-200">
                  {qualities.map((q, idx) => {
                    const stats = periodStats.qualitySummary[q.id] || { count: 0, duration: 0, load: 0 };
                    const emaInfo = qualitiesEMA[q.id]?.current;
                    const delta3 = emaInfo?.delta3 ?? 0;

                    const trendLabel = delta3 > 0.05 
                      ? `Tendance en progression de +${delta3}` 
                      : delta3 < -0.05 
                      ? `Tendance en diminution de ${delta3}` 
                      : 'Tendance stable à 0.0';

                    return (
                      <tr key={q.id} className={idx % 2 === 1 ? 'bg-white/[0.01] print:bg-gray-50' : ''}>
                        <th scope="row" className="p-2.5 pl-3 font-semibold text-white print:text-black text-left">
                          {q.name}
                        </th>
                        <td className="p-2.5 text-center font-mono">
                          {stats.count > 0 ? (
                            <span className="font-bold text-white print:text-black">{stats.count}</span>
                          ) : (
                            <span className="text-slate-400 print:text-gray-500 font-medium">0</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-800">
                          {stats.duration > 0 ? `${stats.duration} min` : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-800">
                          {stats.load > 0 ? stats.load : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-white print:text-black">
                          {emaInfo?.ema3 ?? 0}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-800">
                          {emaInfo?.ema7 ?? 0}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-800">
                          {emaInfo?.ema21 ?? 0}
                        </td>
                        <td className="p-2.5 pr-3 text-right font-mono font-semibold" aria-label={trendLabel}>
                          {delta3 > 0.05 ? (
                            <span className="text-emerald-400 print:text-emerald-700">▲ +{delta3}</span>
                          ) : delta3 < -0.05 ? (
                            <span className="text-red-400 print:text-red-700">▼ {delta3}</span>
                          ) : (
                            <span className="text-slate-400 print:text-gray-500 font-medium">≈ 0.0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarques & Recommandations Coach */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 print:border-gray-300 print:bg-white text-xs space-y-2">
            <label 
              htmlFor="coach-notes-textarea"
              className="font-bold uppercase tracking-wider text-slate-200 print:text-black flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={14} className="text-amber-400" aria-hidden="true" /> Recommandations & Observations Coach
            </label>
            <textarea
              id="coach-notes-textarea"
              rows={3}
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              aria-label="Observations et recommandations de l'entraîneur"
              placeholder="Saisissez vos observations et consignes pour l'athlète..."
              className="w-full p-2.5 bg-black/40 print:bg-transparent border border-white/15 print:border-none rounded-lg text-xs text-slate-200 print:text-black focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none transition-colors"
            />
          </div>

          {/* Pied de page du rapport */}
          <div className="pt-4 border-t border-white/10 print:border-gray-300 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 print:text-gray-600">
            <span>PhysioTracker PRO • Édité le {new Date().toLocaleDateString('fr-FR')}</span>
            <span>Bilan d'entraînement • Modélisation de cinétique de charge EWMA (descripteur indicatif)</span>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
};
