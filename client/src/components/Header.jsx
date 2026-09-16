import React from 'react';
import { Upload, Activity, ShieldCheck, AlertTriangle, FileText, Database } from 'lucide-react';
import { formatDateShort } from '../utils/formatters';

const PRESET_DATASETS = [
  { id: 'monitoring_checks_9d_seed101.csv', label: '9-Day Dataset (seed101)', days: '9d' },
  { id: 'monitoring_checks_12d_seed505.csv', label: '12-Day Dataset (seed505)', days: '12d' },
  { id: 'monitoring_checks_14d_seed202.csv', label: '14-Day Dataset (seed202)', days: '14d' },
  { id: 'monitoring_checks_21d_seed303.csv', label: '21-Day Dataset (seed303)', days: '21d' },
  { id: 'monitoring_checks_30d_seed404.csv', label: '30-Day Dataset (seed404)', days: '30d' }
];

export default function Header({ summary, onOpenUpload, onSelectPreset, isLoading }) {
  return (
    <header className="glass-card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
      {/* Brand & Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)'
        }}>
          <Activity size={24} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>SLA Monitor</h1>
            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>v1.0 • Stateless Engine</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Automated Health Log Pipeline & SLA Compliance Verification
          </p>
        </div>
      </div>

      {/* Dataset Selector & Upload Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Preset Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.04)', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <Database size={15} color="var(--text-muted)" />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600 }}>Sample:</span>
          <select
            className="input-control"
            style={{ padding: '4px 8px', fontSize: '0.75rem', background: 'transparent', border: 'none', cursor: 'pointer', maxWidth: '170px' }}
            value={summary?.filename || ''}
            onChange={(e) => onSelectPreset(e.target.value)}
            disabled={isLoading}
          >
            <option value="" disabled style={{ background: '#0d1527', color: '#fff' }}>Select Sample Dataset</option>
            {PRESET_DATASETS.map(d => (
              <option key={d.id} value={d.id} style={{ background: '#0d1527', color: '#fff' }}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Upload Trigger */}
        <button
          id="upload-csv-btn"
          className="btn btn-primary"
          onClick={onOpenUpload}
          disabled={isLoading}
        >
          <Upload size={16} />
          <span>Upload CSV</span>
        </button>
      </div>
    </header>
  );
}
