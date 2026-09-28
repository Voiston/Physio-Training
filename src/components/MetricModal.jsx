import { useState } from 'react';

export default function MetricModal({ info, onClose, onSave }) {
  const existing = info.currentValue !== '-' ? info.currentValue : '';
  const [value, setValue] = useState(existing);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(value);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-slate-100 tracking-tight m-0">{info.title}</h3>
        <p className="text-sm font-semibold text-blue-400 mt-1 mb-6">{info.dateStr}</p>
        
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>{info.label}</label>
            <input 
              type="number" 
              min={info.min} 
              max={info.max} 
              value={value} 
              onChange={(e) => setValue(e.target.value)} 
              autoFocus 
              placeholder={info.placeholder}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-delete" onClick={() => { onSave(null); onClose(); }}>Supprimer</button>
            <button type="button" className="btn-cancel" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-save">Valider</button>
          </div>
        </form>
      </div>
    </div>
  );
}
