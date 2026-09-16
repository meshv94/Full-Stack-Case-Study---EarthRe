import React, { useState } from 'react';
import {
  ListFilter,
  Calendar,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Server,
  Globe,
  Radio,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { formatDateTime, formatLatency, formatNumber, getStatusDetails } from '../utils/formatters';

export default function LogsSection({
  logs = [],
  totalCount = 0,
  page = 1,
  pageSize = 50,
  totalPages = 1,
  filters,
  onFilterChange,
  onResetFilters,
  onPageChange,
  isLoading
}) {
  const [filterMode, setFilterMode] = useState(filters.from && filters.to && filters.from !== filters.to ? 'range' : 'single');

  // Handle single date selection
  const handleSingleDateChange = (dateVal) => {
    if (!dateVal) {
      onFilterChange({ from: '', to: '' });
      return;
    }
    // Set from = start of day UTC, to = end of day UTC
    onFilterChange({
      from: `${dateVal}T00:00:00.000Z`,
      to: `${dateVal}T23:59:59.999Z`
    });
  };

  const getSingleDateValue = () => {
    if (filters.from) {
      return filters.from.split('T')[0];
    }
    return '';
  };

  return (
    <section className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            padding: '8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-cyan-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ListFilter size={18} color="var(--color-cyan)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Underlying Monitoring Logs</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Inspect raw health checks, multi-agent observations, and latency metrics
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-neutral">
            {formatNumber(totalCount)} matching checks
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        {/* Top Filter Controls: Date Mode & Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', background: 'rgba(13, 21, 39, 0.9)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <button
              className={`btn btn-ghost btn-sm ${filterMode === 'single' ? 'btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => {
                setFilterMode('single');
                const currDate = getSingleDateValue();
                if (currDate) handleSingleDateChange(currDate);
              }}
            >
              Single Date
            </button>
            <button
              className={`btn btn-ghost btn-sm ${filterMode === 'range' ? 'btn-primary' : ''}`}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              onClick={() => setFilterMode('range')}
            >
              Date Range
            </button>
          </div>

          {/* Date Picker Inputs */}
          {filterMode === 'single' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={15} color="var(--text-dim)" />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Date:</span>
              <input
                id="filter-single-date"
                type="date"
                className="input-control"
                style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                value={getSingleDateValue()}
                onChange={(e) => handleSingleDateChange(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>From:</span>
                <input
                  id="filter-date-from"
                  type="date"
                  className="input-control"
                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                  value={filters.from ? filters.from.split('T')[0] : ''}
                  onChange={(e) => onFilterChange({ from: e.target.value ? `${e.target.value}T00:00:00.000Z` : '' })}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>To:</span>
                <input
                  id="filter-date-to"
                  type="date"
                  className="input-control"
                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                  value={filters.to ? filters.to.split('T')[0] : ''}
                  onChange={(e) => onFilterChange({ to: e.target.value ? `${e.target.value}T23:59:59.999Z` : '' })}
                />
              </div>
            </div>
          )}

          {/* Service Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Server size={15} color="var(--text-dim)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Service:</span>
            <select
              id="filter-service"
              className="input-control"
              style={{ padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer' }}
              value={filters.serviceId || 'all'}
              onChange={(e) => onFilterChange({ serviceId: e.target.value })}
            >
              <option value="all" style={{ background: '#0d1527' }}>All Services</option>
              <option value="svc-auth" style={{ background: '#0d1527' }}>svc-auth (auth-api)</option>
              <option value="svc-notify" style={{ background: '#0d1527' }}>svc-notify (notify-worker)</option>
              <option value="svc-payments" style={{ background: '#0d1527' }}>svc-payments (payments-api)</option>
              <option value="svc-reports" style={{ background: '#0d1527' }}>svc-reports (reports-api)</option>
              <option value="svc-search" style={{ background: '#0d1527' }}>svc-search (search-api)</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Radio size={15} color="var(--text-dim)" />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Status:</span>
            <select
              id="filter-status"
              className="input-control"
              style={{ padding: '4px 10px', fontSize: '0.8rem', cursor: 'pointer' }}
              value={filters.status || 'all'}
              onChange={(e) => onFilterChange({ status: e.target.value })}
            >
              <option value="all" style={{ background: '#0d1527' }}>All Check Results</option>
              <option value="success_only" style={{ background: '#0d1527' }}>200 OK Only</option>
              <option value="errors_only" style={{ background: '#0d1527' }}>Outages (5xx) Only</option>
            </select>
          </div>

          {/* Reset Filters */}
          <button
            id="reset-filters-btn"
            className="btn btn-ghost btn-sm"
            onClick={onResetFilters}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}
          >
            <RotateCcw size={14} />
            <span>Reset Filters</span>
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.825rem' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-dim)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>
              <th style={{ padding: '12px 16px' }}>Timestamp (UTC)</th>
              <th style={{ padding: '12px 16px' }}>Service ID</th>
              <th style={{ padding: '12px 16px' }}>Status Code</th>
              <th style={{ padding: '12px 16px' }}>Latency</th>
              <th style={{ padding: '12px 16px' }}>Agent</th>
              <th style={{ padding: '12px 16px' }}>Region</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '16px', width: '140px' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '16px', width: '100px' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '16px', width: '70px' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '16px', width: '60px' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '16px', width: '60px' }} /></td>
                  <td style={{ padding: '14px 16px' }}><div className="skeleton" style={{ height: '16px', width: '80px' }} /></td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <AlertCircle size={32} color="var(--text-dim)" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                    No check records match the selected filters
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Try expanding your date range or clearing specific service filters.
                  </p>
                  <button className="btn btn-secondary btn-sm" onClick={onResetFilters}>
                    Clear Active Filters
                  </button>
                </td>
              </tr>
            ) : (
              logs.map((row) => {
                const statusInfo = getStatusDetails(row.statusCode);
                const isError = row.isDown || row.statusCode >= 500;

                return (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isError ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                      transition: 'background var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isError ? 'rgba(239, 68, 68, 0.04)' : 'transparent'; }}
                  >
                    {/* Timestamp */}
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatDateTime(row.timestamp)}
                    </td>

                    {/* Service */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{row.serviceId}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>({row.serviceName})</span>
                      </div>
                    </td>

                    {/* Status Code */}
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${isError ? 'badge-breached' : 'badge-met'}`}>
                        {isError ? <XCircle size={12} /> : <CheckCircle2 size={12} />}
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Latency */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          color: row.latencyMs > 600 ? 'var(--status-warn)' : 'var(--text-main)'
                        }}>
                          {formatLatency(row.latencyMs)}
                        </span>
                        {row.latencyMs !== null && (
                          <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min((row.latencyMs / 1000) * 100, 100)}%`,
                              background: row.latencyMs > 600 ? 'var(--status-warn)' : 'var(--color-primary)'
                            }} />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Agent */}
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      <span style={{ background: 'rgba(255, 255, 255, 0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                        {row.agent}
                      </span>
                    </td>

                    {/* Region */}
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {row.region}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginTop: '4px' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({formatNumber(totalCount)} total checks)
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            id="prev-page-btn"
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>

          <span style={{ fontSize: '0.8rem', padding: '0 8px', color: 'var(--text-muted)' }}>
            {page} / {totalPages}
          </span>

          <button
            id="next-page-btn"
            className="btn btn-secondary btn-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
