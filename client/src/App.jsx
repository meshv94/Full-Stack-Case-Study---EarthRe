import React, { useState, useEffect } from 'react';
import { Upload, Activity, ShieldAlert, FileText, Database, ArrowUpCircle } from 'lucide-react';
import Header from './components/Header';
import StatsSection from './components/StatsSection';
import LogsSection from './components/LogsSection';
import CsvUploadModal from './components/CsvUploadModal';
import { fetchDashboardStats, fetchLogs, uploadCsvFile } from './services/api';

export default function App() {
  const [summary, setSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [totalLogsCount, setTotalLogsCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Filters state
  const [filters, setFilters] = useState({
    serviceId: 'all',
    status: 'all',
    from: '',
    to: ''
  });

  // Check if any previous active upload exists in Firestore on initial load
  useEffect(() => {
    async function initDashboard() {
      setIsLoading(true);
      try {
        const statsRes = await fetchDashboardStats();
        if (statsRes && statsRes.hasData) {
          setSummary(statsRes.summary);
          setStats(statsRes.stats);
          await loadLogsData({ ...filters, page: 1 });
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initDashboard();
  }, []);

  // Fetch logs helper
  const loadLogsData = async (filterParams = filters, targetPage = page) => {
    try {
      const result = await fetchLogs({
        ...filterParams,
        page: targetPage,
        pageSize
      });
      setLogs(result.records || []);
      setTotalLogsCount(result.totalCount || 0);
      setPage(result.page || 1);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  // Filter change handler
  const handleFilterChange = async (updatedFields) => {
    const newFilters = { ...filters, ...updatedFields };
    setFilters(newFilters);
    setPage(1);
    await loadLogsData(newFilters, 1);
  };

  // Reset filters
  const handleResetFilters = async () => {
    const resetFilters = {
      serviceId: 'all',
      status: 'all',
      from: '',
      to: ''
    };
    setFilters(resetFilters);
    setPage(1);
    await loadLogsData(resetFilters, 1);
  };

  // Page change
  const handlePageChange = async (newPage) => {
    setPage(newPage);
    await loadLogsData(filters, newPage);
  };

  // Custom CSV upload
  const handleUploadSuccess = async (csvContent, filename) => {
    const result = await uploadCsvFile(csvContent, filename);
    if (result && result.data) {
      setSummary(result.data.summary);
      setStats(result.data.stats);
      setFilters({ serviceId: 'all', status: 'all', from: '', to: '' });
      setPage(1);
      await loadLogsData({ serviceId: 'all', status: 'all', from: '', to: '' }, 1);
      return result.data;
    }
  };

  return (
    <div className="app-container">
      {/* 1. Header with Brand and Upload Trigger */}
      <Header
        summary={summary}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        isLoading={isLoading}
      />

      {/* 2. Main Body: Either Empty State or Active Stats & Logs */}
      {!summary || !stats ? (
        /* Empty State */
        <div className="glass-card animate-fade-in" style={{
          padding: '64px 32px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          minHeight: '420px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'var(--color-primary-glow)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)'
          }}>
            <Upload size={32} color="var(--color-primary)" />
          </div>

          <div style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.02em' }}>
              No Monitoring Data Loaded
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Upload a health-check monitoring CSV file. The file will be sent to the stateless cloud function to clean, validate, persist in Firestore, and compute contractual 99.9% SLA availability.
            </p>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setIsUploadModalOpen(true)}
            style={{ padding: '12px 24px', fontSize: '0.95rem' }}
          >
            <Upload size={18} />
            <span>Upload CSV File</span>
          </button>
        </div>
      ) : (
        <>
          {/* Top Section: Collapsible SLA Statistics */}
          <StatsSection
            stats={stats}
            summary={summary}
            onFilterService={(serviceId) => handleFilterChange({ serviceId })}
            activeService={filters.serviceId}
          />

          {/* Bottom Section: Filterable Monitoring Logs View */}
          <LogsSection
            logs={logs}
            totalCount={totalLogsCount}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        </>
      )}

      {/* 3. CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
