import React from 'react';
import { ShieldAlert, ShieldCheck, Clock, TrendingDown, TrendingUp, AlertOctagon } from 'lucide-react';
import { formatPercentage, formatNumber, formatDateShort } from '../utils/formatters';

export default function SlaBanner({ stats, summary }) {
  if (!stats) return null;

  const isBreached = stats.slaStatus === 'BREACHED';
  const availability = stats.availability || 0;
  const slaTarget = stats.slaTarget || 99.9;
  const delta = availability - slaTarget;

  return (
    <div style={{
      background: isBreached
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(13, 21, 39, 0.8) 100%)'
        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(13, 21, 39, 0.8) 100%)',
      border: `1px solid ${isBreached ? 'var(--status-breached-border)' : 'var(--status-met-border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '24px 28px',
      boxShadow: isBreached ? '0 8px 32px var(--status-breached-glow)' : '0 8px 32px var(--status-met-glow)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '24px',
      alignItems: 'center'
    }}>
      {/* SLA Primary Gauge */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 700 }}>
            Monthly Service Level Agreement (SLA)
          </span>
          <span className={`badge ${isBreached ? 'badge-breached' : 'badge-met'}`}>
            {isBreached ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
            {stats.slaStatus}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span style={{
            fontSize: '3rem',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            lineHeight: 1,
            color: isBreached ? 'var(--status-breached)' : 'var(--status-met)',
            letterSpacing: '-0.03em'
          }}>
            {formatPercentage(availability)}
          </span>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              Target: <strong style={{ color: 'var(--text-main)' }}>{slaTarget.toFixed(1)}%</strong>
            </span>
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: isBreached ? 'var(--status-breached)' : 'var(--status-met)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              {isBreached ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {delta >= 0 ? `+${delta.toFixed(3)}%` : `${delta.toFixed(3)}%`} vs threshold
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ marginTop: '16px' }}>
          <div style={{
            height: '8px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(Math.max(availability, 0), 100)}%`,
              background: isBreached
                ? 'linear-gradient(90deg, #f87171 0%, #ef4444 100%)'
                : 'linear-gradient(90deg, #34d399 0%, #10b981 100%)',
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.8s ease-out'
            }} />
          </div>
        </div>
      </div>

      {/* SLA Impact & Billing Credit Advisory */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertOctagon size={18} color={isBreached ? 'var(--status-breached)' : 'var(--status-met)'} />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Billing Credit Status</h4>
        </div>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          {isBreached
            ? 'Monthly uptime fell below the contractual 99.9% guarantee. Customer is automatically eligible for credit compensation.'
            : 'All cloud services operated above the 99.9% SLA availability threshold during the monitoring window.'}
        </p>
        <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          <span>Dataset: <strong>{summary?.filename || 'Active logs'}</strong></span>
          <span>Coverage: <strong>{formatDateShort(stats.dateRange?.from)} – {formatDateShort(stats.dateRange?.to)}</strong></span>
        </div>
      </div>
    </div>
  );
}
