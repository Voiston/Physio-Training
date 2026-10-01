import React, { useState, useMemo } from 'react';
import { Quality, TrainingBlock, TargetCompetition } from '../hooks/useData';
import { extractSessionLoad } from '../utils/physiology';
import { isPrimary } from '../utils/loadHelpers';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { 
  Printer, X, FileText, Download, Calendar, Activity, 
  TrendingUp, Award, ShieldAlert, Sparkles, CheckCircle, Heart, Dumbbell 
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
  dailyMetrics,
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

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => getLocalYYYYMMDD(today), [today]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0d0d12] border border-white/20 rounded-2xl shadow-2xl text-slate-100 my-auto flex flex-col max-h-[92vh]">
        
        {/* Barre d'outils supérieure (masquée à l'impression) */}
        <div className="no-print flex items-center justify-between p-4 border-b border-white/10 bg-white/5 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Bilan & Rapport d'Entraînement</h2>
              <p className="text-xs text-slate-400">Synthèse scientifique prête pour export PDF / entraîneur</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/50 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => setPeriodDays(7)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodDays === 7 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Jours (Hebdo)
              </button>
              <button
                onClick={() => setPeriodDays(30)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  periodDays === 30 ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                30 Jours (Mensuel)
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition-all cursor-pointer border border-blue-400/30"
              title="Générer un PDF ou imprimer le bilan"
            >
              <Printer size={15} />
              <span>Imprimer / PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
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
                <span className="text-emerald-400 print:text-emerald-700 font-bold"> (Parfaitement dans la zone optimale 0.8 - 1.3 de sweet-spot).</span>
              ) : (
                <span className="text-blue-400 print:text-blue-700 font-bold"> (Zone de récupération / affûtage).</span>
              )}
            </p>
          </div>

          {/* TRIMP Multi-Facteurs : Balance Cardio vs Musculaire & Excentrique */}
          {cardioMuscularBalance && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 print:border-gray-300 print:bg-white text-xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold uppercase tracking-wider text-slate-300 print:text-black flex items-center gap-2">
                  <Heart size={14} className="text-sky-400" /> TRIMP Multi-Facteurs (Cardio vs Musculaire)
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
              <table className="w-full text-xs text-left">
                <thead className="bg-white/5 print:bg-gray-100 text-slate-400 print:text-gray-700 font-semibold border-b border-white/10 print:border-gray-300">
                  <tr>
                    <th className="p-2.5 pl-3">Qualité</th>
                    <th className="p-2.5 text-center">Séances</th>
                    <th className="p-2.5 text-center">Durée Totale</th>
                    <th className="p-2.5 text-center">Charge</th>
                    <th className="p-2.5 text-center">EMA 3j</th>
                    <th className="p-2.5 text-center">EMA 7j</th>
                    <th className="p-2.5 text-center">EMA 21j</th>
                    <th className="p-2.5 pr-3 text-right">Tendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 print:divide-gray-200">
                  {qualities.map((q, idx) => {
                    const stats = periodStats.qualitySummary[q.id] || { count: 0, duration: 0, load: 0 };
                    const emaInfo = qualitiesEMA[q.id]?.current;
                    const isStimulated = stats.count > 0;
                    const delta3 = emaInfo?.delta3 ?? 0;

                    return (
                      <tr key={q.id} className={idx % 2 === 1 ? 'bg-white/[0.01] print:bg-gray-50' : ''}>
                        <td className="p-2.5 pl-3 font-semibold text-white print:text-black">
                          {q.name}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {stats.count > 0 ? (
                            <span className="font-bold text-white print:text-black">{stats.count}</span>
                          ) : (
                            <span className="text-slate-500 print:text-gray-400">0</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-700">
                          {stats.duration > 0 ? `${stats.duration} min` : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-700">
                          {stats.load > 0 ? stats.load : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-white print:text-black">
                          {emaInfo?.ema3 ?? 0}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-700">
                          {emaInfo?.ema7 ?? 0}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-300 print:text-gray-700">
                          {emaInfo?.ema21 ?? 0}
                        </td>
                        <td className="p-2.5 pr-3 text-right font-mono font-semibold">
                          {delta3 > 0.05 ? (
                            <span className="text-emerald-400 print:text-emerald-700">▲ +{delta3}</span>
                          ) : delta3 < -0.05 ? (
                            <span className="text-red-400 print:text-red-700">▼ {delta3}</span>
                          ) : (
                            <span className="text-slate-500 print:text-gray-400">≈ 0.0</span>
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
            <h4 className="font-bold uppercase tracking-wider text-slate-300 print:text-black flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400" /> Recommandations & Observations Coach
            </h4>
            <textarea
              rows={3}
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              className="w-full p-2.5 bg-black/40 print:bg-transparent border border-white/15 print:border-none rounded-lg text-xs text-slate-200 print:text-black focus:outline-none resize-none"
            />
          </div>

          {/* Pied de page du rapport */}
          <div className="pt-4 border-t border-white/10 print:border-gray-300 flex items-center justify-between text-[10px] text-slate-500 print:text-gray-500">
            <span>PhysioTracker PRO • Édité le {new Date().toLocaleDateString('fr-FR')}</span>
            <span>Document certifié - Modélisation physiologique EWMA & Banister</span>
          </div>

        </div>

      </div>
    </div>
  );
};
