import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { formatNumber } from '../utils/formatters';

export default function CsvUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file) => {
    if (!file.name.endsWith('.csv')) {
      setErrorMessage('Please upload a valid .csv file.');
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setErrorMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target.result;
        try {
          const res = await onUploadSuccess(text, selectedFile.name);
          setUploadResult(res);
        } catch (err) {
          setErrorMessage(err.message || 'Failed to process CSV file.');
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setErrorMessage('Failed to read file from disk.');
        setUploading(false);
      };
      reader.readAsText(selectedFile);
    } catch (err) {
      setErrorMessage(err.message);
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(5, 8, 16, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} className="animate-fade-in">
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '520px',
        padding: '28px',
        background: 'var(--bg-surface)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-medium)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Modal Header */}
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
              <Upload size={20} color="var(--color-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Upload Health Log CSV</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Handed off to stateless serverless function & MongoDB Atlas
              </p>
            </div>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={handleClose}
            style={{ padding: '6px', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Upload Success View */}
        {uploadResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid var(--status-met-border)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <CheckCircle2 size={24} color="var(--status-met)" />
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--status-met)' }}>
                  Processing & Persistence Complete!
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Cleaned data saved to MongoDB Atlas and SLA computed.
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              textAlign: 'center'
            }}>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Accepted</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--status-met)' }}>
                  {formatNumber(uploadResult.summary?.rowsAccepted)}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Deduplicated</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-cyan)' }}>
                  {formatNumber(uploadResult.summary?.duplicateRows)}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Purged Anomaly</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--status-breached)' }}>
                  {formatNumber((uploadResult.summary?.invalidStatusRows || 0) + (uploadResult.summary?.negativeLatencyRows || 0))}
                </div>
              </div>
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={handleClose}
            >
              <span>View Dashboard</span>
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          /* Upload / Dropzone Form */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Drag & Drop Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--border-medium)'}`,
                background: dragActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                borderRadius: 'var(--radius-md)',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  padding: '12px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.05)'
                }}>
                  <Upload size={28} color="var(--color-primary)" />
                </div>
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {selectedFile ? selectedFile.name : 'Click to select or drag & drop CSV file'}
                  </p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : 'Supports health-check monitoring logs CSV'}
                  </span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--status-breached-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--status-breached)',
                fontSize: '0.8rem'
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Upload Button */}
            {selectedFile && (
              <button
                className="btn btn-primary"
                onClick={handleUploadSubmit}
                disabled={uploading}
                style={{ width: '100%', padding: '12px' }}
              >
                <Upload size={16} />
                <span>{uploading ? 'Uploading & Processing in Serverless Function...' : `Upload & Process ${selectedFile.name}`}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
