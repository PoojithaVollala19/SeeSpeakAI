import React from 'react';
import { Camera, Monitor, X } from 'lucide-react';

interface MediaPreviewDockProps {
  isCameraActive: boolean;
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>;
  onStopCamera: () => void;
  isScreenSharing: boolean;
  screenVideoRef: React.RefObject<HTMLVideoElement | null>;
  onStopScreenShare: () => void;
}

export const MediaPreviewDock: React.FC<MediaPreviewDockProps> = ({
  isCameraActive,
  cameraVideoRef,
  onStopCamera,
  isScreenSharing,
  screenVideoRef,
  onStopScreenShare,
}) => {
  if (!isCameraActive && !isScreenSharing) {
    return null;
  }

  return (
    <div className="w-full flex flex-wrap items-center justify-center gap-4 my-4 z-20">
      {/* Camera Preview */}
      {isCameraActive && (
        <div className="relative rounded-2xl overflow-hidden border border-indigo-500/40 bg-slate-900/90 shadow-2xl shadow-indigo-950/50 backdrop-blur-md w-64 h-44 transition-all">
          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700/60 text-[11px] font-medium text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Camera size={12} />
            <span>Camera Active</span>
          </div>
          <button
            onClick={onStopCamera}
            title="Turn off camera"
            className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 hover:bg-rose-950/80 border border-slate-700/60 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Screen Share Preview */}
      {isScreenSharing && (
        <div className="relative rounded-2xl overflow-hidden border border-cyan-500/40 bg-slate-900/90 shadow-2xl shadow-cyan-950/50 backdrop-blur-md w-80 h-44 transition-all">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain bg-black"
          />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/80 border border-slate-700/60 text-[11px] font-medium text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <Monitor size={12} />
            <span>Sharing Screen</span>
          </div>
          <button
            onClick={onStopScreenShare}
            title="Stop screen sharing"
            className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 hover:bg-rose-950/80 border border-slate-700/60 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
