import React from 'react';

export default function StatCard({ label, value, subtext, icon: Icon, badge, color = 'primary' }) {
  return (
    <div className="glass-card" style={{
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '12px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        {Icon && (
          <div style={{
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            background: 'rgba(255, 255, 255, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Icon size={16} color="var(--text-muted)" />
          </div>
        )}
      </div>

      {/* Main Metric */}
      <div>
        <div style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
          {value}
        </div>
        {subtext && (
          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {subtext}
          </div>
        )}
      </div>

      {/* Optional Badge */}
      {badge && (
        <div style={{ marginTop: '2px' }}>
          {badge}
        </div>
      )}
    </div>
  );
}
