import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Filter, Sparkles, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { formatNumber } from '../utils/formatters';

export default function DataQualityReport({ summary }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!summary) return null;

  return (
    <div className="glass-card" style={{ padding: '14px 18px' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--color-cyan)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Pipeline Cleaning & Data Findings Audit
          </span>
          <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
            {formatNumber(summary.rowsAccepted)} accepted / {formatNumber(summary.rowsRejected)} rejected
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>{isOpen ? 'Hide Audit Details' : 'View Pipeline Audit'}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isOpen && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }} className="animate-fade-in">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total Rows Received</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>{formatNumber(summary.rowsReceived)}</div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--status-breached)', textTransform: 'uppercase' }}>Duplicates Removed</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--status-breached)' }}>{formatNumber(summary.duplicateRows)}</div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--status-breached)', textTransform: 'uppercase' }}>Invalid Status (999) Purged</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--status-breached)' }}>{formatNumber(summary.invalidStatusRows)}</div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--status-breached)', textTransform: 'uppercase' }}>Negative Latencies Purged</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--status-breached)' }}>{formatNumber(summary.negativeLatencyRows)}</div>
            </div>

            <div style={{ background: 'rgba(6, 182, 212, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 182, 212, 0.15)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-cyan)', textTransform: 'uppercase' }}>Seconds Unit Normalized</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-cyan)' }}>{formatNumber(summary.normalizedUnitRows)}</div>
            </div>

            <div style={{ background: 'rgba(99, 102, 241, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--color-primary)', textTransform: 'uppercase' }}>Epoch Timestamps Normalized</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>{formatNumber(summary.normalizedEpochRows)}</div>
            </div>

            <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--status-warn)', textTransform: 'uppercase' }}>Missing Latencies Retained</span>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--status-warn)' }}>{formatNumber(summary.missingLatencyRows)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
