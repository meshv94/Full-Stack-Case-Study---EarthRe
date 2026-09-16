import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import StatsSection from './components/StatsSection';
import LogsSection from './components/LogsSection';
import CsvUploadModal from './components/CsvUploadModal';
import { fetchDashboardStats, fetchLogs, uploadCsvFile, loadPresetDataset } from './services/api';

const DEFAULT_DATASET = 'monitoring_checks_9d_seed101.csv';

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

  // Load initial dataset on mount
  useEffect(() => {
    async function initDashboard() {
      setIsLoading(true);
      try {
        // Try fetching active upload or fallback to loading 9d dataset
        const statsRes = await fetchDashboardStats();
        if (statsRes && statsRes.hasData) {
          setSummary(statsRes.summary);
          setStats(statsRes.stats);
          await loadLogsData({ ...filters, page: 1 });
        } else {
          // Load default 9-day sample
          const uploadRes = await loadPresetDataset(DEFAULT_DATASET);
          if (uploadRes && uploadRes.data) {
            setSummary(uploadRes.data.summary);
            setStats(uploadRes.data.stats);
            await loadLogsData({ ...filters, page: 1 });
          }
        }
      } catch (err) {
        console.error('Failed to initialize dashboard:', err);
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

  // Preset sample selection
  const handleSelectPreset = async (filename) => {
    setIsLoading(true);
    try {
      const result = await loadPresetDataset(filename);
      if (result && result.data) {
        setSummary(result.data.summary);
        setStats(result.data.stats);
        setFilters({ serviceId: 'all', status: 'all', from: '', to: '' });
        setPage(1);
        await loadLogsData({ serviceId: 'all', status: 'all', from: '', to: '' }, 1);
        return result.data;
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* 1. Header with Brand, Active Dataset, and Upload Trigger */}
      <Header
        summary={summary}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onSelectPreset={handleSelectPreset}
        isLoading={isLoading}
      />

      {/* 2. Top Section: Collapsible SLA Performance & Operational Statistics */}
      <StatsSection
        stats={stats}
        summary={summary}
        onFilterService={(serviceId) => handleFilterChange({ serviceId })}
        activeService={filters.serviceId}
      />

      {/* 3. Bottom Section: Filterable Monitoring Logs View */}
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

      {/* 4. CSV Upload Modal */}
      <CsvUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
        onSelectPreset={handleSelectPreset}
      />
    </div>
  );
}
