import React from 'react';
import { Upload, Activity, FileText } from 'lucide-react';

export default function Header({ summary, onOpenUpload, isLoading }) {
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
            <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>Cloud Functions • Firestore</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Automated Health Log Pipeline & SLA Compliance Verification
          </p>
        </div>
      </div>

      {/* Upload Button & Current File Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {summary && summary.filename && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.8rem',
            color: 'var(--text-muted)'
          }}>
            <FileText size={15} color="var(--color-cyan)" />
            <span>Active: <strong style={{ color: 'var(--text-main)' }}>{summary.filename}</strong></span>
          </div>
        )}

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
