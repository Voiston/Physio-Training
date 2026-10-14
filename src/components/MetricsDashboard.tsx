import PhysiologyDashboard from './PhysiologyDashboard';
import type { PhysiologyDashboardProps } from './PhysiologyDashboard';
import QualitiesDashboard from './QualitiesDashboard';
import type { QualitiesDashboardProps } from './QualitiesDashboard';

export type MetricsDashboardProps = PhysiologyDashboardProps & QualitiesDashboardProps & {
  viewMode?: 'all' | 'physiology' | 'qualities';
};

export default function MetricsDashboard(props: MetricsDashboardProps) {
  const { viewMode = 'all' } = props;

  if (viewMode === 'physiology') {
    return <PhysiologyDashboard {...props} />;
  }

  if (viewMode === 'qualities') {
    return <QualitiesDashboard {...props} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PhysiologyDashboard {...props} />
      <QualitiesDashboard {...props} />
    </div>
  );
}
