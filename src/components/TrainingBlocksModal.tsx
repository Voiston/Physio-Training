import React, { useState, useRef, useEffect } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';
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
  initialTemplate?: BlockTemplate | null;
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
  initialTemplate,
  onClose,
  onSaveBlock,
  onDeleteBlock,
  onSaveTemplate,
  onResetTemplates,
  onReorderByBlock
}: TrainingBlocksModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
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

  // Pre-fill block form when an initial template is requested
  useEffect(() => {
    if (initialTemplate) {
      setActiveTab('blocks');
      setShowForm(true);
      setEditingBlockId(null);
      setSelectedPreset(initialTemplate.id);
      setBlockName(initialTemplate.name);
      setDurationWeeks(initialTemplate.durationWeeks);
      setFocusQualities([...initialTemplate.focusQualities]);
      setTargetMultiplier(initialTemplate.targetMultiplier);
      setMaintenanceMultiplier(initialTemplate.maintenanceMultiplier);
    }
  }, [initialTemplate]);

  // Keyboard navigation on tablist (ArrowLeft / ArrowRight)
  const handleTabKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextTab = activeTab === 'blocks' ? 'templates' : 'blocks';
      setActiveTab(nextTab);
      setTimeout(() => {
        document.getElementById(`tab-${nextTab}`)?.focus();
      }, 0);
    }
  };

  // Focus trap & Escape listener & Focus restoration (WCAG 2.2 SC 2.1.2 & 2.4.3)
  useModalA11y(true, onClose, modalRef);

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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-blocks-title"
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="bg-[#121216] border border-white/10 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl my-auto text-slate-100 flex flex-col max-h-[92vh] focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-white/[0.02] gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 shrink-0" aria-hidden="true">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="training-blocks-title" className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 m-0 truncate">
                Périodisation & Blocs d'Entraînement
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 m-0 line-clamp-1">
                Cycles spécifiques (3, 4, 6 semaines). Répétition accrue des qualités ciblées et délais allongés en maintien.
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/20 text-slate-300 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 shrink-0"
            aria-label="Fermer le gestionnaire de cycles et blocs"
            title="Fermer (Échap)"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Tab Navigation avec sémantique WAI-ARIA tablist et navigation fléchée */}
        <div 
          role="tablist" 
          aria-label="Sections du gestionnaire de blocs"
          onKeyDown={handleTabKeyDown}
          className="flex items-center border-b border-white/10 bg-black/20 px-4 sm:px-6"
        >
          <button
            type="button"
            role="tab"
            id="tab-blocks"
            aria-selected={activeTab === 'blocks'}
            aria-controls="panel-blocks"
            tabIndex={activeTab === 'blocks' ? 0 : -1}
            onClick={() => setActiveTab('blocks')}
            className={`min-h-[44px] py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              activeTab === 'blocks'
                ? 'border-blue-500 text-white bg-white/[0.04]'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Calendar size={15} aria-hidden="true" />
            <span>Cycles Planifiés & Déclaration ({blocks.length})</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-templates"
            aria-selected={activeTab === 'templates'}
            aria-controls="panel-templates"
            tabIndex={activeTab === 'templates' ? 0 : -1}
            onClick={() => setActiveTab('templates')}
            className={`min-h-[44px] py-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-all cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              activeTab === 'templates'
                ? 'border-blue-500 text-white bg-white/[0.04]'
                : 'border-transparent text-slate-300 hover:text-white'
            }`}
          >
            <Settings size={15} aria-hidden="true" />
            <span>Personnaliser les Templates ({templates.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">

          {/* TAB 1 : BLOCS & CYCLES PLANIFIÉS */}
          {activeTab === 'blocks' && (
            <div 
              role="tabpanel" 
              id="panel-blocks" 
              aria-labelledby="tab-blocks"
              className="space-y-6"
            >
              {/* Active / Configured Blocks List */}
              <div>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 m-0">
                    <Clock className="w-4 h-4 text-blue-400" />
                    Cycles d'entraînement ({blocks.length})
                  </h3>
                  {!showForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBlockId(null);
                        handleSelectPreset('force_max');
                        setStartDate(todayStr);
                        setShowForm(true);
                      }}
                      className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <Plus size={16} /> Déclarer un nouveau bloc
                    </button>
                  )}
                </div>

                {blocks.length === 0 ? (
                  <div className="bg-white/[0.02] border border-dashed border-white/15 rounded-2xl p-6 text-center text-slate-300 text-xs space-y-1">
                    <p className="font-semibold text-slate-200 text-sm mb-1">Aucun bloc de préparation déclaré pour le moment.</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto m-0">
                      Déclarez un cycle de préparation spécifique (ex: Force max sur 4 semaines) pour adapter automatiquement la fréquence et l'ordre des qualités physiologiques.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {blocks.map(b => {
                      const progress = getBlockProgress(b, todayStr);
                      const isCurrent = progress?.isActive;
                      return (
                        <div 
                          key={b.id} 
                          className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                            isCurrent 
                              ? 'bg-gradient-to-r from-blue-950/40 via-purple-950/20 to-slate-900/60 border-blue-500/40 shadow-xl' 
                              : 'bg-white/[0.02] border-white/10'
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                                {getPresetIcon(b.type)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm sm:text-base text-white">{b.name}</span>
                                  {isCurrent ? (
                                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                      ● En cours (Sem. {progress?.currentWeek}/{b.durationWeeks})
                                    </span>
                                  ) : progress?.isUpcoming ? (
                                    <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                      À venir
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-500/20 text-slate-300 border border-slate-500/30">
                                      Terminé
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-300 mt-1 font-mono m-0">
                                  Du {b.startDate} au {b.endDate} ({b.durationWeeks} semaines • {progress?.totalDays} jours)
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {onReorderByBlock && (
                                <button
                                  type="button"
                                  onClick={() => onReorderByBlock(b)}
                                  className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-blue-200 hover:text-white bg-blue-500/15 hover:bg-blue-500/25 rounded-xl border border-blue-500/30 transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                  title="Place les qualités ciblées par ce bloc en haut du tableau"
                                  aria-label={`Trier le tableau principal selon le bloc ${b.name}`}
                                >
                                  <ArrowUpDown size={14} aria-hidden="true" />
                                  <span>Trier tableau</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEditBlock(b)}
                                className="min-h-[44px] px-3.5 py-2 text-xs font-bold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                                aria-label={`Modifier le bloc ${b.name}`}
                              >
                                Modifier
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteBlock(b.id)}
                                className="w-11 h-11 min-w-[44px] min-h-[44px] text-rose-400 hover:text-rose-300 bg-white/5 hover:bg-rose-500/20 rounded-xl border border-white/10 hover:border-rose-500/30 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                title="Supprimer ce bloc"
                                aria-label={`Supprimer le bloc ${b.name}`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Progress Bar if active */}
                          {isCurrent && progress && (
                            <div className="mt-3.5 mb-2.5">
                              <div className="flex justify-between text-xs text-slate-200 mb-1.5 font-mono">
                                <span>Progression du cycle : <strong>{progress.percent}%</strong></span>
                                <span>{progress.remainingDays} jours restants</span>
                              </div>
                              <div 
                                role="progressbar"
                                aria-label={`Progression du cycle ${b.name}`}
                                aria-valuenow={progress.percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuetext={`${progress.percent}% réalisé, ${progress.remainingDays} jours restants sur ${progress.totalDays} jours`}
                                className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden"
                              >
                                <div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 rounded-full transition-all duration-500" 
                                  style={{ width: `${progress.percent}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Targeted vs Maintenance badges */}
                          <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-xs font-bold text-red-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                <Zap size={13} className="text-red-400" /> Fréquence de dév. (rappel toutes les 48-72h · x0.45) :
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {b.focusQualities.map(qId => {
                                  const q = qualities.find(item => item.id === qId);
                                  return (
                                    <span key={qId} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-medium">
                                      {q?.name || qId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                                <Shield size={13} className="text-sky-400" /> Qualités en maintien nominal (x1.0) :
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {qualities
                                  .filter(q => !b.focusQualities.includes(q.id))
                                  .slice(0, 5)
                                  .map(q => (
                                    <span key={q.id} className="px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs font-medium">
                                      {q.name}
                                    </span>
                                  ))}
                                {qualities.filter(q => !b.focusQualities.includes(q.id)).length > 5 && (
                                  <span className="px-2.5 py-1 text-xs text-slate-400 font-medium">
                                    +{qualities.filter(q => !b.focusQualities.includes(q.id)).length - 5} autres
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
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-2">
                      Sélectionnez un modèle de cycle (Template) :
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {templates.map(p => {
                        const isSelected = selectedPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPreset(p.id)}
                            className={`min-h-[52px] p-3 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                              isSelected
                                ? 'bg-blue-600/25 border-blue-500 text-white shadow-md ring-1 ring-blue-500'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                {getPresetIcon(p.id)} {p.name}
                              </span>
                              {isSelected && <Check size={14} className="text-blue-400" />}
                            </div>
                            <p className="text-xs text-slate-300 leading-snug line-clamp-2 m-0">
                              {p.description}
                            </p>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => handleSelectPreset('custom')}
                        className={`min-h-[52px] p-3 rounded-xl border text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          selectedPreset === 'custom'
                            ? 'bg-blue-600/25 border-blue-500 text-white shadow-md ring-1 ring-blue-500'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Sparkles size={14} className="text-yellow-400" /> Personnalisé
                          </span>
                          {selectedPreset === 'custom' && <Check size={14} className="text-blue-400" />}
                        </div>
                        <p className="text-xs text-slate-300 leading-snug m-0">
                          Sélection manuelle libre des qualités et des paramètres.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Block Name */}
                  <div>
                    <label htmlFor="block-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                      Nom du bloc :
                    </label>
                    <input 
                      id="block-name-input"
                      type="text" 
                      value={blockName}
                      onChange={(e) => setBlockName(e.target.value)}
                      placeholder="Ex: Force max, Seuil / VMA, etc."
                      required
                      className="w-full min-h-[44px] px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 placeholder:text-slate-400"
                    />
                  </div>

                  {/* Duration and Date Range */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Duration options: 3, 4, 6 weeks or custom */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                        Durée du cycle :
                      </label>
                      <div className="grid grid-cols-3 gap-2 mb-2.5">
                        {[3, 4, 6].map(weeks => (
                          <button
                            key={weeks}
                            type="button"
                            onClick={() => setDurationWeeks(weeks)}
                            className={`min-h-[44px] py-2.5 px-2 text-center rounded-xl border text-xs font-bold transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                              durationWeeks === weeks
                                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {weeks} Semaines
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2.5 text-xs text-slate-300">
                        <span>Ou personnalisé :</span>
                        <input 
                          type="number"
                          min={1}
                          max={16}
                          value={durationWeeks}
                          onChange={(e) => setDurationWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                          aria-label="Durée personnalisée en semaines"
                          className="w-20 min-h-[36px] px-2 py-1 bg-white/5 border border-white/15 rounded-lg text-center text-white text-xs font-bold focus:outline-none focus:border-blue-500"
                        />
                        <span>semaines ({durationWeeks * 7} jours)</span>
                      </div>
                    </div>

                    {/* Start Date & End Date */}
                    <div>
                      <label htmlFor="start-date-input" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                        Date de début du bloc :
                      </label>
                      <input 
                        id="start-date-input"
                        type="date" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        required
                        className="w-full min-h-[44px] px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 font-mono"
                      />
                      <p className="text-xs text-slate-300 mt-2 flex items-center gap-1.5 font-mono m-0">
                        <Check size={14} className="text-emerald-400 shrink-0" />
                        <span>Fin automatique le : <strong className="text-white font-bold">{computedEndDate}</strong></span>
                      </p>
                    </div>
                  </div>

                  {/* Qualities Selection Matrix */}
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        Sélection des qualités ciblées (Répétées plus souvent) :
                      </label>
                      <span className="text-xs text-slate-300 font-medium">
                        {focusQualities.length} ciblées / {qualities.length - focusQualities.length} en maintien
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {qualities.map(q => {
                        const isFocus = focusQualities.includes(q.id);
                        return (
                          <button
                            key={q.id}
                            type="button"
                            aria-pressed={isFocus}
                            aria-label={`${q.name} : ${isFocus ? 'Ciblée pour développement accéléré (x0.45)' : 'En maintien nominal (x1.0)'}`}
                            onClick={() => toggleQualityFocus(q.id)}
                            className={`min-h-[48px] p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                              isFocus
                                ? 'bg-red-500/20 border-red-500/60 text-white ring-1 ring-red-500/40'
                                : 'bg-sky-500/10 border-sky-500/25 text-slate-300 hover:bg-sky-500/20'
                            }`}
                          >
                            <div className="min-w-0 pr-1.5">
                              <span className={`text-xs font-bold block truncate ${isFocus ? 'text-red-200' : 'text-slate-200'}`}>
                                {q.name}
                              </span>
                              <span className="text-xs uppercase tracking-wider block mt-0.5">
                                {isFocus ? (
                                  <span className="text-red-300 font-bold flex items-center gap-1">
                                    <Zap size={11} aria-hidden="true" /> Dév. (x0.45)
                                  </span>
                                ) : (
                                  <span className="text-sky-300 font-medium flex items-center gap-1">
                                    <Shield size={11} aria-hidden="true" /> Maintien (x1.0)
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isFocus ? 'bg-red-500 text-white' : 'bg-white/10 text-transparent'}`} aria-hidden="true">
                              <Check size={13} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Option: Auto-reorder qualities on activation */}
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs">
                    <input 
                      type="checkbox" 
                      id="autoReorderCheck"
                      checked={autoReorder}
                      onChange={(e) => setAutoReorder(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded bg-white/10 border-white/20 cursor-pointer focus:ring-blue-400"
                    />
                    <label htmlFor="autoReorderCheck" className="text-slate-200 cursor-pointer leading-relaxed">
                      <strong className="text-white">Réorganiser automatiquement le tableau :</strong> placer les qualités ciblées par ce cycle en tête de liste (Lignes #1, #2, #3...).
                    </label>
                  </div>

                  {/* Submit Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    {blocks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setShowForm(false); setEditingBlockId(null); }}
                        className="min-h-[44px] px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        Annuler
                      </button>
                    )}
                    <button
                      type="submit"
                      className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      <Check size={16} />
                      <span>{editingBlockId ? 'Mettre à jour le cycle' : `Activer le cycle · ${blockName}`}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2 : PERSONNALISATION DES TEMPLATES */}
          {activeTab === 'templates' && (
            <div 
              role="tabpanel"
              id="panel-templates"
              aria-labelledby="tab-templates"
              className="space-y-5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 m-0">
                    <Settings className="w-4 h-4 text-blue-400" />
                    Modification des Templates de Cycles
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 m-0">
                    Modifiez la composition des blocs (ex: quelles qualités sont ciblées par défaut dans Force max, Aérobie, etc.).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onResetTemplates}
                  className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl border border-white/10 text-xs font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  title="Rétablir les templates par défaut d'origine"
                >
                  <RotateCcw size={14} />
                  <span>Rétablir les originaux</span>
                </button>
              </div>

              {/* Template selector pills */}
              <div className="flex flex-wrap gap-2.5">
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTemplateToEdit(t.id)}
                    className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      editingTemplateId === t.id
                        ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {getPresetIcon(t.id)}
                    <span>{t.name}</span>
                    <span className="text-xs opacity-80 font-mono">({t.durationWeeks}s)</span>
                  </button>
                ))}
              </div>

              {/* Template Edit Form */}
              <form onSubmit={handleSaveTemplateSubmit} className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="template-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                      Nom du Template :
                    </label>
                    <input 
                      id="template-name-input"
                      type="text" 
                      value={templateForm.name}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                      required
                      className="w-full min-h-[44px] px-3.5 py-2 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="template-duration-input" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                      Durée par défaut (semaines) :
                    </label>
                    <input 
                      id="template-duration-input"
                      type="number" 
                      min={1} 
                      max={16}
                      value={templateForm.durationWeeks}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, durationWeeks: Number(e.target.value) || 1 }))}
                      required
                      className="w-full min-h-[44px] px-3.5 py-2 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="template-desc-input" className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
                    Description & Objectif :
                  </label>
                  <input 
                    id="template-desc-input"
                    type="text" 
                    value={templateForm.description}
                    onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full min-h-[44px] px-3.5 py-2 bg-white/5 border border-white/15 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-400 placeholder:text-slate-400"
                  />
                </div>

                {/* Qualities for this template */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Qualités prioritaires incluses dans ce template ({templateForm.focusQualities.length}) :
                    </label>
                    <span className="text-xs text-slate-300 font-medium">
                      Cochez pour inclure dans la fréquence accrue
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {qualities.map(q => {
                      const isIncluded = templateForm.focusQualities.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          aria-pressed={isIncluded}
                          aria-label={`${q.name} : ${isIncluded ? 'Incluse dans le template' : 'Non incluse'}`}
                          onClick={() => toggleTemplateQuality(q.id)}
                          className={`min-h-[48px] p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                            isIncluded
                              ? 'bg-red-500/20 border-red-500/60 text-white ring-1 ring-red-500/40'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span className="text-xs font-bold truncate text-slate-100">{q.name}</span>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isIncluded ? 'bg-red-500 text-white' : 'bg-white/10 text-transparent'}`} aria-hidden="true">
                            <Check size={13} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {templateSavedMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-2">
                    <Check size={16} />
                    <span>{templateSavedMsg}</span>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="min-h-[44px] flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    <Check size={16} />
                    <span>Enregistrer le template · {templateForm.name}</span>
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
