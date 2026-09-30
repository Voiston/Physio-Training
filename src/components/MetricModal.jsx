import { useState } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';

export default function MetricModal({ info, onClose, onSave }) {
  const existing = info.currentValue !== '-' ? info.currentValue : '';
  const [value, setValue] = useState(existing);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(value ? Number(value) : null);
    onClose();
  };

  // Raccourcis rapides pour saisie en 1 clic
  const isReadiness = info.type === 'readiness';
  const quickOptions = isReadiness 
    ? [5, 6, 7, 8, 9, 10] 
    : info.type === 'vfc' 
    ? [45, 55, 65, 75, 85, 95] 
    : [48, 52, 56, 60, 64, 68];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-fadeIn" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between pb-3 border-b border-white/10 mb-4">
          <div>
            <h3 className="text-xl font-bold text-slate-100 tracking-tight m-0">{info.title}</h3>
            <p className="text-xs font-mono text-blue-400 mt-1 mb-0 flex items-center gap-1.5">
              <Calendar size={12} /> {info.dateStr}
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="input-group">
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">{info.label}</label>
            <input 
              type="number" 
              min={info.min} 
              max={info.max} 
              value={value} 
              onChange={(e) => setValue(e.target.value)} 
              autoFocus 
              placeholder={info.placeholder}
              className="w-full font-mono text-base bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Raccourcis rapides en 1 clic */}
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-1.5">Suggestions rapides :</span>
            <div className="grid grid-cols-6 gap-1.5">
              {quickOptions.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setValue(String(opt))}
                  className={`py-1 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                    String(value) === String(opt)
                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions pt-2 border-t border-white/10 flex items-center justify-between">
            {existing ? (
              <button 
                type="button" 
                className="btn-delete" 
                onClick={() => { onSave(null); onClose(); }}
              >
                Effacer
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button type="button" className="btn-cancel" onClick={onClose}>
                Annuler
              </button>
              <button type="submit" className="btn-save flex items-center gap-1 font-bold">
                <CheckCircle2 size={13} />
                <span>Valider</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
