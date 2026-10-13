import React from 'react';
import PhysiologyDashboard from './PhysiologyDashboard';
import QualitiesDashboard from './QualitiesDashboard';

export default function MetricsDashboard(props) {
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
