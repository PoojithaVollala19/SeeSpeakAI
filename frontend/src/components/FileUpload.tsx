import React, { useRef, useState } from 'react';
import { UploadCloud, Loader2, FileText, Image as ImageIcon, Video, BarChart3 } from 'lucide-react';
import { getUploadConfig } from '../config/uploadConfig';

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  supportedMimeTypes?: string[];
  featureTitle?: string;
  featureId?: string;
  isUploading?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  featureTitle = 'Workspace',
  featureId,
  isUploading = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const uploadConfig = getUploadConfig(featureId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await onFileUpload(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      await onFileUpload(file);
      e.target.value = ''; // Reset input so same file can be reselected
    }
  };

  const renderIcon = () => {
    if (isUploading) {
      return <Loader2 className="animate-spin" size={24} />;
    }
    switch (uploadConfig.iconName) {
      case 'Image':
        return <ImageIcon size={24} />;
      case 'Video':
        return <Video size={24} />;
      case 'BarChart3':
        return <BarChart3 size={24} />;
      default:
        return <FileText size={24} />;
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative w-full border-2 border-dashed rounded-2xl p-5 md:p-6 text-center cursor-pointer transition-all duration-200 select-none ${
        isDragOver
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.01]'
          : 'border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/80 dark:hover:bg-slate-900/70'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={uploadConfig.accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      <div className="flex flex-col items-center justify-center space-y-2">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm">
          {renderIcon()}
        </div>
        <div>
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {isUploading ? 'Uploading & Analyzing File...' : uploadConfig.title}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {uploadConfig.hint}
          </p>
        </div>
      </div>
    </div>
  );
};
