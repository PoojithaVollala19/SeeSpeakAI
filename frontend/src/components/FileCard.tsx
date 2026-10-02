import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  FileSpreadsheet,
  CheckCircle2,
  Trash2,
  FileCode,
  Layers,
  Table2,
  ExternalLink
} from 'lucide-react';
import { ConversationFile } from '../types';
import { getApiUrl } from '../utils/apiUrl';

interface FileCardProps {
  file: ConversationFile;
  onRemove?: (id: string) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onRemove }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const mime = (file.mime_type || '').toLowerCase();
  const name = (file.filename || '').toLowerCase();

  const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
  const isImage = mime.startsWith('image/') || name.match(/\.(png|jpg|jpeg|webp|svg)$/);
  const isVideo = mime.startsWith('video/') || name.match(/\.(mp4|mov|webm)$/);
  const isAudio = mime.startsWith('audio/') || name.match(/\.(mp3|wav|ogg|m4a)$/);
  const isSheet = mime.includes('sheet') || mime.includes('excel') || name.match(/\.(csv|xlsx|xls)$/);
  const isCode = name.match(/\.(py|js|ts|tsx|jsx|json|html|css|cpp|java|go|rs|sql)$/);

  const rawFileUrl = file.url || `/uploads/${file.file_path.split(/[\\/]/).pop()}`;
  const fileUrl = getApiUrl(rawFileUrl);

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (isPdf) return <FileText className="text-rose-400" size={18} />;
    if (isImage) return <ImageIcon className="text-purple-400" size={18} />;
    if (isVideo) return <Video className="text-amber-400" size={18} />;
    if (isAudio) return <Music className="text-emerald-400" size={18} />;
    if (isSheet) return <FileSpreadsheet className="text-teal-400" size={18} />;
    if (isCode) return <FileCode className="text-cyan-400" size={18} />;
    return <FileText className="text-indigo-400" size={18} />;
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRemove) return;
    setIsDeleting(true);
    try {
      await onRemove(file.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm group shrink-0 max-w-xs md:max-w-sm">
      {/* Icon / Thumbnail & Info */}
      <div className="flex items-center gap-2 min-w-0">
        {isImage ? (
          <div className="w-7 h-7 rounded-lg overflow-hidden border border-purple-500/30 bg-black/40 shrink-0">
            <img
              src={fileUrl}
              alt={file.filename}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shrink-0">
            {getFileIcon()}
          </div>
        )}

        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" title={file.filename}>
            {file.filename}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
            {isPdf && file.page_count ? (
              <span className="text-rose-500 dark:text-rose-400 font-mono">{file.page_count}p</span>
            ) : isSheet && file.row_count ? (
              <span className="text-teal-600 dark:text-teal-400 font-mono">{file.row_count} rows</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <CheckCircle2 size={10} /> Ready
              </span>
            )}
            {file.size_bytes > 0 && (
              <>
                <span>•</span>
                <span>{formatSize(file.size_bytes)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons: Open & Remove */}
      <div className="flex items-center gap-1 shrink-0 ml-1">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Open / View original file"
        >
          <ExternalLink size={13} />
        </a>

        {onRemove && (
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1 rounded-md text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50 cursor-pointer"
            title="Remove file"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
};
