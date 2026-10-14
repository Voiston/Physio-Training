import { useMemo } from 'react';
import { usePersistentState } from './usePersistentState';
import { getActiveBlockForDate, getSavedBlockTemplates } from '../utils/physiology';
import { getLocalYYYYMMDD } from '../utils/dateHelpers';

export interface BlockTemplate {
  id: string;
  name: string;
  durationWeeks: number;
  focusQualities: string[];
  description: string;
  targetMultiplier: number;
  maintenanceMultiplier: number;
  color?: string;
  badge?: string;
}

export interface TrainingBlock {
  id: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  durationWeeks: number;
  focusQualities: string[];
  targetMultiplier: number;
  maintenanceMultiplier: number;
  color?: string;
  notes?: string;
}

export interface UseBlocksStateOptions {
  onPushSync?: () => void;
}

/**
 * Sous-hook gérant l'état persistant des blocs d'entraînement et des modèles de blocs.
 */
export function useBlocksState(options: UseBlocksStateOptions = {}) {
  const { onPushSync } = options;

  const [blockTemplates, setBlockTemplates] = usePersistentState<BlockTemplate[]>('physio_block_templates', () => {
    return getSavedBlockTemplates();
  });

  const [trainingBlocks, setTrainingBlocks] = usePersistentState<TrainingBlock[]>('physio_training_blocks', () => {
    try {
      const raw = localStorage.getItem('physio_training_blocks');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((b: TrainingBlock) => ({
            ...b,
            targetMultiplier: b.targetMultiplier === 0.75 ? 0.45 : (b.targetMultiplier ?? 0.45),
            maintenanceMultiplier: b.maintenanceMultiplier === 1.35 ? 1.0 : (b.maintenanceMultiplier ?? 1.0)
          }));
        }
      }
    } catch (err) { console.warn("[blocks] Blocs d'entraînement illisibles, liste vide", err); }
    return [];
  });

  const activeBlockToday = useMemo(() => {
    const todayStr = getLocalYYYYMMDD(new Date());
    return getActiveBlockForDate(todayStr, trainingBlocks);
  }, [trainingBlocks]);

  const saveTrainingBlock = (block: TrainingBlock) => {
    setTrainingBlocks(prev => {
      const idx = prev.findIndex(b => b.id === block.id);
      let updated: TrainingBlock[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = block;
      } else {
        updated = [...prev, block];
      }
      return updated;
    });
    onPushSync?.();
  };

  const deleteTrainingBlock = (blockId: string) => {
    setTrainingBlocks(prev => prev.filter(b => b.id !== blockId));
    onPushSync?.();
  };

  const saveBlockTemplate = (template: BlockTemplate) => {
    setBlockTemplates(prev => {
      const idx = prev.findIndex(t => t.id === template.id);
      let updated: BlockTemplate[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = template;
      } else {
        updated = [...prev, template];
      }
      return updated;
    });
    onPushSync?.();
  };

  const resetBlockTemplates = () => {
    localStorage.removeItem('physio_block_templates');
    const defaults = getSavedBlockTemplates();
    setBlockTemplates(defaults);
    onPushSync?.();
  };

  return {
    trainingBlocks,
    setTrainingBlocks,
    activeBlockToday,
    saveTrainingBlock,
    deleteTrainingBlock,
    blockTemplates,
    setBlockTemplates,
    saveBlockTemplate,
    resetBlockTemplates
  };
}

export default useBlocksState;
