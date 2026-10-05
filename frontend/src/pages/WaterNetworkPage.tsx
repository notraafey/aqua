import React, { useState, useEffect } from 'react';
import { StreamReach, Incident, Task, Observation } from '@aquasentinel/shared';
import { StreamReachesPage } from './StreamReachesPage.js';
import { MapPage } from './MapPage.js';

interface WaterNetworkPageProps {
  reaches: StreamReach[];
  incidents: Incident[];
  tasks?: Task[];
  observations?: Observation[];
  initialSubTab?: 'map' | 'reaches';
  onNavigateToIncident?: (incidentId: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToEvidence?: (reachId: string) => void;
  onNavigateToResilience?: (reachId: string) => void;
  onSubTabChange?: (subTab: 'map' | 'reaches') => void;
}

export const WaterNetworkPage: React.FC<WaterNetworkPageProps> = ({
  reaches = [],
  incidents = [],
  tasks = [],
  observations = [],
  initialSubTab = 'reaches',
  onNavigateToIncident,
  onNavigateToTask,
  onNavigateToEvidence,
  onNavigateToResilience,
  onSubTabChange,
}) => {
  const [subTab, setSubTab] = useState<'map' | 'reaches'>(initialSubTab);
  const [selectedReachId, setSelectedReachId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const handleSubTabChange = (newSubTab: 'map' | 'reaches') => {
    setSubTab(newSubTab);
    onSubTabChange?.(newSubTab);
  };

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {subTab === 'reaches' ? (
        <StreamReachesPage
          reaches={reaches}
          incidents={incidents}
          tasks={tasks}
          observations={observations}
          selectedReachId={selectedReachId}
          onSelectReach={setSelectedReachId}
          onNavigateToIncident={onNavigateToIncident}
          onNavigateToTask={onNavigateToTask}
          onNavigateToEvidence={onNavigateToEvidence}
          onNavigateToResilience={onNavigateToResilience}
          onOpenCatchmentMap={() => handleSubTabChange('map')}
        />
      ) : (
        <MapPage
          reaches={reaches}
          incidents={incidents}
          tasks={tasks}
          observations={observations}
          selectedReachId={selectedReachId}
          onSelectReach={setSelectedReachId}
          onNavigateToIncident={onNavigateToIncident}
          onNavigateToTask={onNavigateToTask}
          onNavigateToEvidence={onNavigateToEvidence}
          onNavigateToResilience={onNavigateToResilience}
          onNavigateToStreamReaches={(reachId) => {
            if (reachId) setSelectedReachId(reachId);
            handleSubTabChange('reaches');
          }}
        />
      )}
    </div>
  );
};
