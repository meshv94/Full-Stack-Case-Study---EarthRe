import React, { useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Gauge,
  Calendar,
  Layers
} from 'lucide-react';
import SlaBanner from './SlaBanner';
import StatCard from './StatCard';
import ServiceHealthGrid from './ServiceHealthGrid';
import DataQualityReport from './DataQualityReport';
import { formatNumber, formatLatency, formatDateShort, formatPercentage } from '../utils/formatters';

export default function StatsSection({ stats, summary, onFilterService, activeService }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!stats) return null;

  return (
    <section className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Section Header with Collapse/Expand Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <BarChart3 size={18} color="var(--color-primary)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Operational SLA Statistics</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Comprehensive availability metrics & performance percentiles
            </p>
          </div>
        </div>

        <button
          id="collapse-stats-btn"
          className="btn btn-secondary btn-sm"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {isExpanded ? (
            <>
              <span>Collapse Stats</span>
              <ChevronUp size={16} />
            </>
          ) : (
            <>
              <span>Expand Stats</span>
              <ChevronDown size={16} />
            </>
          )}
        </button>
      </div>

      {/* Collapsed Compact State Summary */}
      {!isExpanded && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'rgba(255, 255, 255, 0.02)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)'
        }} className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Availability:</span>
              <strong style={{
                fontSize: '1.1rem',
                fontFamily: 'var(--font-display)',
                color: stats.slaStatus === 'BREACHED' ? 'var(--status-breached)' : 'var(--status-met)'
              }}>
                {formatPercentage(stats.availability)}
              </strong>
              <span className={`badge ${stats.slaStatus === 'BREACHED' ? 'badge-breached' : 'badge-met'}`} style={{ fontSize: '0.65rem' }}>
                {stats.slaStatus}
              </span>
            </div>

            <div style={{ height: '16px', width: '1px', background: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>Checks:</span>
              <strong>{formatNumber(stats.totalChecks)}</strong>
              <span style={{ color: 'var(--status-breached)', marginLeft: '4px' }}>({formatNumber(stats.failedChecks)} failed)</span>
            </div>

            <div style={{ height: '16px', width: '1px', background: 'var(--border-subtle)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-dim)' }}>P95 Latency:</span>
              <strong>{formatLatency(stats.p95LatencyMs)}</strong>
            </div>
          </div>

          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            {formatDateShort(stats.dateRange?.from)} – {formatDateShort(stats.dateRange?.to)}
          </span>
        </div>
      )}

      {/* Expanded Full View */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
          {/* Top Hero SLA Banner */}
          <SlaBanner stats={stats} summary={summary} />

          {/* Key Metrics Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px'
          }}>
            <StatCard
              label="Total Checks"
              value={formatNumber(stats.totalChecks)}
              subtext="15-min intervals processed"
              icon={Activity}
            />

            <StatCard
              label="Successful Checks"
              value={formatNumber(stats.successfulChecks)}
              subtext="2xx healthy responses"
              icon={CheckCircle}
              badge={<span className="badge badge-met">Healthy</span>}
            />

            <StatCard
              label="Downtime Checks"
              value={formatNumber(stats.failedChecks)}
              subtext="5xx & degraded checks"
              icon={XCircle}
              badge={<span className="badge badge-breached">{stats.failedChecks > 0 ? 'Degraded' : 'Zero Errors'}</span>}
            />

            <StatCard
              label="Average Latency"
              value={formatLatency(stats.averageLatencyMs)}
              subtext="Across all reporting agents"
              icon={Clock}
            />

            <StatCard
              label="P95 Latency"
              value={formatLatency(stats.p95LatencyMs)}
              subtext={`P99: ${formatLatency(stats.p99LatencyMs)}`}
              icon={Gauge}
            />

            <StatCard
              label="Data Coverage"
              value={summary?.rowsReceived ? `${Math.round(stats.totalChecks / 96 / 5)} Days` : '—'}
              subtext={`${formatDateShort(stats.dateRange?.from)} to ${formatDateShort(stats.dateRange?.to)}`}
              icon={Calendar}
            />
          </div>

          {/* Per-Service Breakdown */}
          <ServiceHealthGrid
            services={stats.services}
            onFilterService={onFilterService}
            activeService={activeService}
          />

          {/* Data Quality & Pipeline Audit */}
          <DataQualityReport summary={summary} />
        </div>
      )}
    </section>
  );
}
