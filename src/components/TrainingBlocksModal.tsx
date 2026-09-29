import React, { useState } from 'react';
import { 
  X, Calendar, Zap, Shield, Flame, Activity, Sparkles, 
  Trash2, Plus, Check, Clock, AlertCircle, Dumbbell, Settings,
  RotateCcw, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  computeBlockEndDate, 
  getBlockProgress 
} from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';
import { Quality, TrainingBlock, BlockTemplate } from '../hooks/useData';

interface TrainingBlocksModalProps {
  qualities: Quality[];
  blocks: TrainingBlock[];
  templates: BlockTemplate[];
  onClose: () => void;
  onSaveBlock: (block: TrainingBlock, autoReorder?: boolean) => void;
  onDeleteBlock: (blockId: string) => void;
  onSaveTemplate: (template: BlockTemplate) => void;
  onResetTemplates: () => void;
  onReorderByBlock?: (block: TrainingBlock) => void;
}

export default function TrainingBlocksModal({
  qualities,
  blocks,
  templates,
  onClose,
  onSaveBlock,
  onDeleteBlock,
  onSaveTemplate,
  onResetTemplates,
  onReorderByBlock
}: TrainingBlocksModalProps) {
  const todayStr = getLocalYYYYMMDD(new Date());

  // Modal navigation tab: 'blocks' or 'templates'
  const [activeTab, setActiveTab] = useState<'blocks' | 'templates'>('blocks');

  // Form state for creating/editing a block
  const [selectedPreset, setSelectedPreset] = useState<string>('force_max');
  const [blockName, setBlockName] = useState<string>('Force max');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [durationWeeks, setDurationWeeks] = useState<number>(4);
  const [focusQualities, setFocusQualities] = useState<string[]>([
    'pull', 'push', 'leg', 'abdos', 'descente'
  ]);
  const [targetMultiplier, setTargetMultiplier] = useState<number>(0.45);
  const [maintenanceMultiplier, setMaintenanceMultiplier] = useState<number>(1.0);
  const [notes, setNotes] = useState<string>('');
  const [autoReorder, setAutoReorder] = useState<boolean>(true);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(blocks.length === 0);

  // Template editing state
  const [editingTemplateId, setEditingTemplateId] = useState<string>(templates[0]?.id || 'force_max');
  const [templateForm, setTemplateForm] = useState<BlockTemplate>(() => {
    return templates[0] || {
      id: 'custom_1',
      name: 'Nouveau Template',
      durationWeeks: 4,
      focusQualities: ['leg', 'pull'],
      description: 'Description du template',
      targetMultiplier: 0.45,
      maintenanceMultiplier: 1.0
    };
  });
  const [templateSavedMsg, setTemplateSavedMsg] = useState<string>('');

  // Compute end date reactively
  const computedEndDate = computeBlockEndDate(startDate, durationWeeks);

  // Apply a preset to the block form
  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId === 'custom') {
      setBlockName('Bloc Personnalisé');
      return;
    }
    const preset = templates.find(p => p.id === presetId);
    if (preset) {
      setBlockName(preset.name);
      setDurationWeeks(preset.durationWeeks);
      setFocusQualities([...preset.focusQualities]);
      setTargetMultiplier(preset.targetMultiplier);
      setMaintenanceMultiplier(preset.maintenanceMultiplier);
    }
  };

  // Toggle quality focus in block form
  const toggleQualityFocus = (qId: string) => {
    setFocusQualities(prev => {
      if (prev.includes(qId)) {
        return prev.filter(id => id !== qId);
      } else {
        return [...prev, qId];
      }
    });
  };

  // Start editing existing block
  const handleEditBlock = (b: TrainingBlock) => {
    setEditingBlockId(b.id);
    setBlockName(b.name);
    setSelectedPreset(b.type || 'custom');
    setStartDate(b.startDate);
    setDurationWeeks(b.durationWeeks);
    setFocusQualities([...b.focusQualities]);
    setTargetMultiplier(b.targetMultiplier);
    setMaintenanceMultiplier(b.maintenanceMultiplier);
    setNotes(b.notes || '');
    setShowForm(true);
  };

  // Save block handler
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockName.trim() || !startDate) return;

    const blockToSave: TrainingBlock = {
      id: editingBlockId || `block_${Date.now()}`,
      name: blockName.trim(),
      type: selectedPreset,
      startDate,
      endDate: computedEndDate,
      durationWeeks: Number(durationWeeks),
      focusQualities,
      targetMultiplier: Number(targetMultiplier),
      maintenanceMultiplier: Number(maintenanceMultiplier),
      notes: notes.trim()
    };

    onSaveBlock(blockToSave, autoReorder);
    setEditingBlockId(null);
    setShowForm(false);
  };

  // Switch edited template
  const handleSelectTemplateToEdit = (tId: string) => {
    setEditingTemplateId(tId);
    const found = templates.find(t => t.id === tId);
    if (found) {
      setTemplateForm({ ...found, focusQualities: [...found.focusQualities] });
    }
    setTemplateSavedMsg('');
  };

  // Toggle focus quality in template editor
  const toggleTemplateQuality = (qId: string) => {
    setTemplateForm(prev => {
      const next = prev.focusQualities.includes(qId)
        ? prev.focusQualities.filter(id => id !== qId)
        : [...prev.focusQualities, qId];
      return { ...prev, focusQualities: next };
    });
  };

  // Save modified template
  const handleSaveTemplateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTemplate(templateForm);
    setTemplateSavedMsg('Template enregistré avec succès !');
    setTimeout(() => setTemplateSavedMsg(''), 3000);
  };

  const getPresetIcon = (type: string) => {
    switch (type) {
      case 'force_max': return <Dumbbell className="w-4 h-4 text-red-400" />;
      case 'endurance_force': return <Zap className="w-4 h-4 text-orange-400" />;
      case 'aerobie': return <Activity className="w-4 h-4 text-cyan-400" />;
      case 'seuil_vma': return <Flame className="w-4 h-4 text-purple-400" />;
      case 'explosivite_plyo': return <Sparkles className="w-4 h-4 text-pink-400" />;
      default: return <Calendar className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-auto text-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Périodisation & Blocs d'Entraînement
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cycles spécifiques (3, 4, 6 semaines). Répétition accrue des qualités ciblées et délais allongés en maintien.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-white/10 bg-black/20 px-4 sm:px-6">
          <button
            onClick={() => setActiveTab('blocks')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'blocks'
                ? 'border-blue-500 text-white font-bold bg-white/[0.03]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar size={14} />
            <span>Cycles Planifiés & Déclaration ({blocks.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`py-3 px-4 font-semibold text-xs border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'templates'
                ? 'border-blue-500 text-white font-bold bg-white/[0.03]'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings size={14} />
            <span>Personnaliser les Templates ({templates.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">

          {/* TAB 1 : BLOCS & CYCLES PLANIFIÉS */}
          {activeTab === 'blocks' && (
            <>
              {/* Active / Configured Blocks List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    Cycles d'entraînement ({blocks.length})
                  </h3>
                  {!showForm && (
                    <button
                      onClick={() => {
                        setEditingBlockId(null);
                        handleSelectPreset('force_max');
                        setStartDate(todayStr);
                        setShowForm(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-lg transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Déclarer un nouveau bloc
                    </button>
                  )}
                </div>

                {blocks.length === 0 ? (
                  <div className="bg-white/[0.02] border border-dashed border-white/15 rounded-xl p-5 text-center text-slate-400 text-xs">
                    <p className="mb-2">Aucun bloc de préparation déclaré pour le moment.</p>
                    <p className="text-[11px] text-slate-500">
                      Déclarez un bloc (ex: Force max sur 4 semaines) pour adapter la fréquence de vos séances.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {blocks.map(b => {
                      const progress = getBlockProgress(b, todayStr);
                      const isCurrent = progress?.isActive;
                      return (
                        <div 
                          key={b.id} 
                          className={`p-4 rounded-xl border transition-all ${
                            isCurrent 
                              ? 'bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-transparent border-blue-500/40 shadow-lg' 
                              : 'bg-white/[0.02] border-white/10'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
                                {getPresetIcon(b.type)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-white">{b.name}</span>
                                  {isCurrent ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                      ● En cours (Sem. {progress?.currentWeek}/{b.durationWeeks})
                                    </span>
                                  ) : progress?.isUpcoming ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      À venir
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30">
                                      Terminé
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                                  Du {b.startDate} au {b.endDate} ({b.durationWeeks} semaines • {progress?.totalDays} jours)
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {onReorderByBlock && (
                                <button
                                  onClick={() => onReorderByBlock(b)}
                                  className="px-2.5 py-1 text-xs text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-500/20 rounded border border-blue-500/20 transition-colors flex items-center gap-1"
                                  title="Place les qualités ciblées par ce bloc en haut du tableau"
                                >
                                  <ArrowUpDown size={11} />
                                  <span>Trier tableau</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleEditBlock(b)}
                                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded border border-white/10 transition-colors"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => onDeleteBlock(b.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded border border-white/10 hover:border-red-500/20 transition-colors"
                                title="Supprimer ce bloc"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Progress Bar if active */}
                          {isCurrent && progress && (
                            <div className="mt-3 mb-2">
                              <div className="flex justify-between text-[10px] text-slate-400 mb-1 font-mono">
                                <span>Progression : {progress.percent}%</span>
                                <span>{progress.remainingDays} jours restants</span>
                              </div>
                              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500" 
                                  style={{ width: `${progress.percent}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Targeted vs Maintenance badges */}
                          <div className="mt-3 pt-2.5 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div>
                              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                <Zap size={11} /> Fréquence de dév. (x0.45 · 2-3x/sem) :
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {b.focusQualities.map(qId => {
                                  const q = qualities.find(item => item.id === qId);
                                  return (
                                    <span key={qId} className="px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20 text-[10px]">
                                      {q?.name || qId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1 mb-1">
                                <Shield size={11} /> Maintien (x1.0 · Rémanence nominale) :
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {qualities
                                  .filter(q => !b.focusQualities.includes(q.id))
                                  .slice(0, 4)
                                  .map(q => (
                                    <span key={q.id} className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px]">
                                      {q.name}
                                    </span>
                                  ))}
                                {qualities.filter(q => !b.focusQualities.includes(q.id)).length > 4 && (
                                  <span className="px-1.5 py-0.5 text-[10px] text-slate-500">
                                    +{qualities.filter(q => !b.focusQualities.includes(q.id)).length - 4} autres
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Form to declare or edit a block */}
              {showForm && (
                <form onSubmit={handleSave} className="bg-white/[0.03] border border-blue-500/30 rounded-2xl p-4 sm:p-5 space-y-5 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-400" />
                      {editingBlockId ? 'Modifier le bloc' : 'Configurer un bloc de préparation'}
                    </h3>
                    {blocks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setEditingBlockId(null); }}
                        className="text-xs text-slate-400 hover:text-white"
                      >
                        Annuler
                      </button>
                    )}
                  </div>

                  {/* Presets selector based on templates */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      Sélectionnez un modèle de bloc (Template) :
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {templates.map(p => {
                        const isSelected = selectedPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPreset(p.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600/20 border-blue-500 text-white shadow-md ring-1 ring-blue-500'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                {getPresetIcon(p.id)} {p.name}
                              </span>
                              {isSelected && <Check size={12} className="text-blue-400" />}
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                              {p.description}
                            </p>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => handleSelectPreset('custom')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          selectedPreset === 'custom'
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md ring-1 ring-blue-500'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Sparkles size={13} className="text-yellow-400" /> Personnalisé
                          </span>
                          {selectedPreset === 'custom' && <Check size={12} className="text-blue-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          Sélection manuelle libre des qualités et des paramètres.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Block Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nom du bloc :
                    </label>
                    <input 
                      type="text" 
                      value={blockName}
                      onChange={(e) => setBlockName(e.target.value)}
                      placeholder="Ex: Force max, Seuil / VMA, etc."
                      required
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Duration and Date Range */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Duration options: 3, 4, 6 weeks or custom */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Durée du cycle :
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        {[3, 4, 6].map(weeks => (
                          <button
                            key={weeks}
                            type="button"
                            onClick={() => setDurationWeeks(weeks)}
                            className={`py-2 px-1 text-center rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                              durationWeeks === weeks
                                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {weeks} Semaines
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Ou personnalisé :</span>
                        <input 
                          type="number"
                          min={1}
                          max={16}
                          value={durationWeeks}
                          onChange={(e) => setDurationWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded text-center text-white text-xs"
                        />
                        <span>semaines ({durationWeeks * 7} jours)</span>
                      </div>
                    </div>

                    {/* Start Date & End Date */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Date de début du bloc :
                      </label>
                      <input 
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1 font-mono">
                        <Check size={12} className="text-emerald-400" />
                        Fin automatique le : <strong className="text-white">{computedEndDate}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Qualities Selection Matrix */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-300">
                        Sélection des qualités ciblées (Répétées plus souvent) :
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {focusQualities.length} ciblées / {qualities.length - focusQualities.length} en maintien
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {qualities.map(q => {
                        const isFocus = focusQualities.includes(q.id);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            onClick={() => toggleQualityFocus(q.id)}
                            className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                              isFocus
                                ? 'bg-red-500/15 border-red-500/50 text-white'
                                : 'bg-sky-500/5 border-sky-500/20 text-slate-400 hover:bg-sky-500/10'
                            }`}
                          >
                            <div className="min-w-0 pr-1">
                              <span className={`text-xs font-bold block truncate ${isFocus ? 'text-red-200' : 'text-slate-300'}`}>
                                {q.name}
                              </span>
                              <span className="text-[9px] uppercase tracking-wider block">
                                {isFocus ? (
                                  <span className="text-red-400 font-semibold flex items-center gap-1">
                                    <Zap size={9} /> Dév. (x0.45)
                                  </span>
                                ) : (
                                  <span className="text-sky-400 font-semibold flex items-center gap-1">
                                    <Shield size={9} /> Maintien (x1.0)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isFocus ? 'bg-red-500 text-white' : 'bg-white/10 text-transparent'}`}>
                              <Check size={10} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Option: Auto-reorder qualities on activation */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                    <input 
                      type="checkbox" 
                      id="autoReorderCheck"
                      checked={autoReorder}
                      onChange={(e) => setAutoReorder(e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded bg-white/10 border-white/20 cursor-pointer"
                    />
                    <label htmlFor="autoReorderCheck" className="text-slate-200 cursor-pointer">
                      <strong>Réorganiser automatiquement le tableau :</strong> placer les qualités ciblées par ce cycle en tête de liste (Lignes #1, #2, #3...).
                    </label>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {blocks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setEditingBlockId(null); }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                    >
                      <Check size={15} />
                      {editingBlockId ? 'Mettre à jour le cycle' : 'Activer ce bloc de préparation'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* TAB 2 : PERSONNALISATION DES TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-blue-400" />
                    Modification des Templates de Cycles
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Modifiez la composition des blocs (ex: quelles qualités sont ciblées par défaut dans Force max, Aérobie, etc.).
                  </p>
                </div>
                <button
                  onClick={onResetTemplates}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg border border-white/10 text-xs transition-colors cursor-pointer"
                  title="Rétablir les templates par défaut d'origine"
                >
                  <RotateCcw size={13} />
                  <span>Rétablir les originaux</span>
                </button>
              </div>

              {/* Template selector pills */}
              <div className="flex flex-wrap gap-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTemplateToEdit(t.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                      editingTemplateId === t.id
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {getPresetIcon(t.id)}
                    <span>{t.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">({t.durationWeeks}s)</span>
                  </button>
                ))}
              </div>

              {/* Template Edit Form */}
              <form onSubmit={handleSaveTemplateSubmit} className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nom du Template :
                    </label>
                    <input 
                      type="text" 
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Durée par défaut (semaines) :
                    </label>
                    <input 
                      type="number" 
                      min={1} 
                      max={16}
                      value={templateForm.durationWeeks}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, durationWeeks: Number(e.target.value) || 1 }))}
                      required
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Description & Objectif :
                  </label>
                  <input 
                    type="text" 
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Qualities for this template */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-slate-300">
                      Qualités prioritaires incluses dans ce template ({templateForm.focusQualities.length}) :
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Cochez pour inclure dans la fréquence accrue
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {qualities.map(q => {
                      const isIncluded = templateForm.focusQualities.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => toggleTemplateQuality(q.id)}
                          className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                            isIncluded
                              ? 'bg-red-500/20 border-red-500/50 text-white'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <span className="text-xs font-semibold truncate">{q.name}</span>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${isIncluded ? 'bg-red-500 text-white' : 'bg-white/10 text-transparent'}`}>
                            <Check size={10} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {templateSavedMsg && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2">
                    <Check size={14} />
                    <span>{templateSavedMsg}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer"
                  >
                    <Check size={15} />
                    <span>Enregistrer les modifications du template</span>
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
