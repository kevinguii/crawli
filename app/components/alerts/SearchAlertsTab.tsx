'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import SavedSearchCard from './SavedSearchCard';
import CreateAlertModal from './CreateAlertModal';

export interface SavedSearch {
  id: string;
  query: string;
  platforms: string[];
  filters: Record<string, unknown> | null;
  cadence_hours: 12 | 24;
  last_run_at: string | null;
  next_run_at: string;
  unread_match_count: number;
  paused: boolean;
  created_at: string;
}

export default function SearchAlertsTab() {
  const [alerts, setAlerts] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/saved-searches');
      if (res.ok) setAlerts(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/saved-searches/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      toast.success('Alert deleted');
    } else {
      toast.error('Failed to delete alert');
    }
  }

  async function handleTogglePause(alert: SavedSearch) {
    const res = await fetch(`/api/saved-searches/${alert.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused: !alert.paused }),
    });
    if (res.ok) {
      const updated = await res.json() as SavedSearch;
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } else {
      toast.error('Failed to update alert');
    }
  }

  async function handleMarkSeen(id: string) {
    await fetch(`/api/saved-searches/${id}/mark-seen`, { method: 'POST' });
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, unread_match_count: 0 } : a)),
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl animate-pulse"
            style={{ background: 'var(--surface)' }}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {alerts.length === 0
            ? 'No alerts yet. Create one to get notified when new listings match your search.'
            : `${alerts.length} alert${alerts.length > 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="btn-primary px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New alert
        </button>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <SavedSearchCard
              key={alert.id}
              alert={alert}
              onDelete={handleDelete}
              onTogglePause={handleTogglePause}
              onMarkSeen={handleMarkSeen}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateAlertModal
          onClose={() => setShowCreate(false)}
          onCreated={(newAlert) => {
            setAlerts((prev) => [newAlert, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
