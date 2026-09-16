import React from 'react';
import { Server, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { formatPercentage, formatLatency, formatNumber } from '../utils/formatters';

const SERVICE_META = {
  'svc-auth': { name: 'Authentication API', icon: Server, desc: 'OAuth & Token Validation' },
  'svc-notify': { name: 'Notification Worker', icon: Server, desc: 'Webhooks & Email Delivery' },
  'svc-payments': { name: 'Payments Gateway', icon: Server, desc: 'Transactions & Ledger' },
  'svc-reports': { name: 'Reporting Service', icon: Server, desc: 'Aggregation & Analytics' },
  'svc-search': { name: 'Search Engine API', icon: Server, desc: 'Index Queries & Search' }
};

export default function ServiceHealthGrid({ services = {}, onFilterService, activeService }) {
  const serviceList = Object.values(services);

  if (serviceList.length === 0) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={18} color="var(--color-primary)" />
          Service-by-Service SLA Breakdown
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Click card to filter logs
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '14px'
      }}>
        {serviceList.map((srv) => {
          const meta = SERVICE_META[srv.serviceId] || { name: srv.serviceName, desc: 'Microservice' };
          const isBreached = srv.slaStatus === 'BREACHED';
          const isSelected = activeService === srv.serviceId;

          return (
            <div
              key={srv.serviceId}
              className="glass-card"
              onClick={() => onFilterService && onFilterService(isSelected ? 'all' : srv.serviceId)}
              style={{
                padding: '16px',
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--color-primary)' : isBreached ? 'rgba(239, 68, 68, 0.25)' : 'var(--border-subtle)',
                background: isSelected ? 'var(--bg-card-active)' : 'var(--bg-card)',
                boxShadow: isSelected ? '0 0 16px var(--color-primary-glow)' : 'none',
                transition: 'all var(--transition-fast)'
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {meta.name}
                  </h4>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    {srv.serviceId}
                  </span>
                </div>
                <span className={`badge ${isBreached ? 'badge-breached' : 'badge-met'}`} style={{ fontSize: '0.7rem' }}>
                  {isBreached ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                  {srv.slaStatus}
                </span>
              </div>

              {/* Availability Number & Progress */}
              <div style={{ marginTop: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: isBreached ? 'var(--status-breached)' : 'var(--status-met)' }}>
                    {formatPercentage(srv.availability)}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {formatNumber(srv.failedChecks)} fails / {formatNumber(srv.totalChecks)} checks
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(Math.max(srv.availability, 0), 100)}%`,
                    background: isBreached ? 'var(--status-breached)' : 'var(--status-met)',
                    borderRadius: 'var(--radius-full)'
                  }} />
                </div>
              </div>

              {/* Latency Stats */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '8px',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>Avg: </span>
                  <strong>{formatLatency(srv.averageLatencyMs)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>P95: </span>
                  <strong style={{ color: srv.p95LatencyMs > 600 ? 'var(--status-warn)' : 'var(--text-main)' }}>
                    {formatLatency(srv.p95LatencyMs)}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
