

import React, { useCallback, useState } from 'react';
import { Upload, FileImage, X, Plus, Disc } from 'lucide-react';

interface DropZoneProps {
  label: string;
  subLabel: string;
  accept: string; // e.g. ".raf" or ".fp1,.cube"
  file: File | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  label,
  subLabel,
  accept,
  file,
  onFileSelect,
  onClear,
  icon,
  disabled = false
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      const extension = '.' + droppedFile.name.split('.').pop()?.toLowerCase();
      const accepted = accept.split(',').map(a => a.trim().toLowerCase());
      
      // Allow JPEGs in dropzone for sample mode logic if configured, but here we check strictly against accept prop first
      // Actually, let's loosen it slightly to ensure the UX is smooth
      if (accepted.some(acc => extension === acc || extension.endsWith(acc))) {
         onFileSelect(droppedFile);
      } else {
        alert(`Invalid file type. Please upload ${accept}`);
      }
    }
  }, [accept, onFileSelect, disabled]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (file) {
    return (
      <div className="relative group bg-white border-2 border-black rounded-sm p-6 flex flex-col items-center justify-center h-48 transition-all hover:border-[#d5001c] shadow-[4px_4px_0px_black] hover:shadow-[2px_2px_0px_black] hover:translate-x-[2px] hover:translate-y-[2px]">
        {/* Corner Accents (Viewfinder style) */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-black group-hover:border-[#d5001c] transition-colors"></div>
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-black group-hover:border-[#d5001c] transition-colors"></div>
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-black group-hover:border-[#d5001c] transition-colors"></div>
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-black group-hover:border-[#d5001c] transition-colors"></div>

        <button 
          onClick={onClear}
          className="absolute top-3 right-3 p-1 text-black hover:text-[#d5001c] transition-colors z-20"
        >
          <X size={18} />
        </button>
        
        <div className="w-16 h-16 flex items-center justify-center text-[#d5001c] mb-3 animate-pulse bg-zinc-100 rounded-full border-2 border-black">
           {icon || <FileImage size={32} strokeWidth={1.5} />}
        </div>
        <p className="font-bold text-black truncate max-w-[200px] font-mono text-sm tracking-wider uppercase" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-zinc-500 mt-1 font-mono uppercase font-bold">
          {(file.size / (1024 * 1024)).toFixed(2)} MB
        </p>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative h-48 flex flex-col items-center justify-center text-center p-6 transition-all cursor-pointer bg-zinc-50
        ${isDragging 
          ? 'border-2 border-[#009639] bg-white shadow-[0_0_20px_#009639]' 
          : 'border-2 border-dashed border-zinc-400 hover:border-black hover:bg-white'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : ''}
      `}
    >
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        disabled={disabled}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
      />
      
      <div className={`mb-4 transition-colors relative z-10 ${isDragging ? 'text-[#009639] scale-110' : 'text-zinc-400'}`}>
        <Upload size={32} strokeWidth={1.5} />
      </div>
      <p className="font-black text-zinc-800 uppercase tracking-[0.15em] text-sm relative z-10">
        {label}
      </p>
      <p className="text-[10px] text-zinc-500 mt-2 font-mono uppercase relative z-10 font-bold bg-white px-2 border border-zinc-200">
        {subLabel}
      </p>
    </div>
  );
};
