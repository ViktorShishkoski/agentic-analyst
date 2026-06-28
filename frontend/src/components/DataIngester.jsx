import React, { useState, useRef } from 'react';
import { Upload, Clipboard, FileText, Loader2, Trash2 } from 'lucide-react';

const DataIngester = ({ 
  rawData = '', 
  setRawData, 
  uploadedFile, 
  setUploadedFile, 
  onIngest, 
  ingestLoading = false, 
  collectionName = 'sales_data', 
  setCollectionName 
}) => {
  const [activeTab, setActiveTab] = useState('paste');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl overflow-hidden shadow-lg">
      {/* Header Tabs */}
      <div className="flex border-b border-[var(--border-color)] bg-white/[0.01]">
        <button
          onClick={() => setActiveTab('paste')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'paste' 
              ? 'border-b-2 border-[var(--accent-gold)] text-[var(--text-primary)] bg-white/[0.01]' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <Clipboard size={13} />
          Paste Data
        </button>
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold tracking-wide transition-all ${
            activeTab === 'upload' 
              ? 'border-b-2 border-[var(--accent-gold)] text-[var(--text-primary)] bg-white/[0.01]' 
              : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <Upload size={13} />
          Upload File
        </button>
      </div>

      <div className="flex-1 flex flex-col p-4 gap-3.5 min-h-0">
        {/* Destination Collection input */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <label className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">
            Target DB Collection
          </label>
          <input
            type="text"
            value={collectionName}
            onChange={(e) => setCollectionName && setCollectionName(e.target.value)}
            disabled={ingestLoading}
            placeholder="e.g. sales_data"
            className="input-field w-full text-xs font-mono"
          />
        </div>

        {/* Tab contents */}
        <div className="flex-1 min-h-0 flex flex-col">
          {activeTab === 'paste' ? (
            <div className="flex-1 flex flex-col gap-1.5 min-h-0">
              <label className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                Raw JSON/CSV Payload
              </label>
              <textarea
                value={rawData}
                onChange={(e) => setRawData && setRawData(e.target.value)}
                disabled={ingestLoading}
                placeholder="Paste CSV (with headers) or JSON array here..."
                className="flex-1 input-field font-mono text-[11px] leading-relaxed resize-none bg-black/30 w-full"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col gap-1.5 min-h-0">
              <label className="text-[10px] font-black uppercase text-[var(--text-muted)] tracking-wider">
                Select Dataset (CSV / JSON)
              </label>
              
              {!uploadedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    isDragOver 
                      ? 'border-[var(--accent-gold)] bg-[oklch(75%_0.14_85_/_0.03)]' 
                      : 'border-[var(--border-color)] hover:border-[var(--text-muted)] hover:bg-white/[0.01]'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".csv,.json"
                    className="hidden"
                  />
                  <Upload size={24} className="text-[var(--text-muted)] mb-2.5" />
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Drag & drop file here</span>
                  <span className="text-[10px] text-[var(--text-muted)] mt-1">or click to browse from finder</span>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-[var(--border-color)] bg-black/20 rounded-lg">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-[oklch(58%_0.07_195_/_0.1)] border border-[oklch(58%_0.07_195_/_0.3)] mb-3">
                    <FileText className="text-[var(--accent-teal)] w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-primary)] max-w-full truncate px-4">
                    {uploadedFile.name}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] mt-1 font-mono">
                    {(uploadedFile.size / 1024).toFixed(1)} KB
                  </span>
                  
                  <button
                    onClick={removeFile}
                    disabled={ingestLoading}
                    className="flex items-center gap-1.5 mt-5 text-[10px] font-semibold text-[var(--error)] hover:bg-[oklch(62%_0.18_25_/_0.06)] px-3 py-1.5 rounded border border-[oklch(62%_0.18_25_/_0.15)] transition-all"
                  >
                    <Trash2 size={11} />
                    Discard File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={onIngest}
          disabled={ingestLoading || (activeTab === 'paste' ? !rawData.trim() : !uploadedFile)}
          className="w-full flex items-center justify-center gap-2 mt-2 py-3 bg-[var(--accent-gold)] hover:bg-[var(--accent-gold-hover)] disabled:bg-white/[0.04] disabled:text-[var(--text-muted)] disabled:border-transparent text-black font-semibold text-xs rounded-lg transition-all"
        >
          {ingestLoading ? (
            <>
              <Loader2 size={13} className="animate-spin stroke-[2.5]" />
              <span>Ingesting dataset...</span>
            </>
          ) : (
            <span>Process & Ingest Data</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default DataIngester;
