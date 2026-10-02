import { useState, useCallback, useRef, useEffect } from 'react';

export function useScreenShare() {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stopScreenShare = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('Screen sharing is not supported in this browser environment.');
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      // Handle user stopping screen share via browser floating bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsSharing(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled picker dialog
        setError(null);
      } else {
        setError(err.message || 'Failed to start screen sharing.');
      }
      setIsSharing(false);
    }
  }, [stopScreenShare]);

  const toggleScreenShare = useCallback(() => {
    if (isSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isSharing, startScreenShare, stopScreenShare]);

  // Attach stream to videoRef whenever sharing state or videoRef updates
  useEffect(() => {
    if (isSharing && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isSharing]);

  // Robust screen share frame capture
  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!streamRef.current) {
      console.log('[useScreenShare] Cannot capture frame: stream is not active');
      return null;
    }

    try {
      // 1. Try videoRef element if ready
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && v.videoHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(1280, v.videoWidth);
        canvas.height = Math.round((canvas.width / v.videoWidth) * v.videoHeight);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          console.log(`[useScreenShare] Frame captured via videoRef: ${canvas.width}x${canvas.height}, length=${dataUrl.length}`);
          return dataUrl;
        }
      }

      // 2. Try ImageCapture API on the live screen track
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.readyState === 'live' && typeof (window as any).ImageCapture !== 'undefined') {
        try {
          const imageCapture = new (window as any).ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          if (bitmap && bitmap.width > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(1280, bitmap.width);
            canvas.height = Math.round((canvas.width / bitmap.width) * bitmap.height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              console.log(`[useScreenShare] Frame captured via ImageCapture: ${canvas.width}x${canvas.height}, length=${dataUrl.length}`);
              return dataUrl;
            }
          }
        } catch (icErr) {
          console.debug('[useScreenShare] ImageCapture attempt failed:', icErr);
        }
      }

      // 3. Fallback: temporary offscreen video from stream
      if (streamRef.current.getVideoTracks().length > 0) {
        const tempVideo = document.createElement('video');
        tempVideo.srcObject = streamRef.current;
        tempVideo.muted = true;
        tempVideo.playsInline = true;
        await tempVideo.play().catch(() => {});
        if (tempVideo.videoWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(1280, tempVideo.videoWidth);
          canvas.height = Math.round((canvas.width / tempVideo.videoWidth) * tempVideo.videoHeight);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            console.log(`[useScreenShare] Frame captured via offscreen video: ${canvas.width}x${canvas.height}, length=${dataUrl.length}`);
            return dataUrl;
          }
        }
      }
    } catch (e) {
      console.warn('[useScreenShare] Failed to capture screen frame:', e);
    }

    return null;
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isSharing,
    error,
    videoRef,
    stream: streamRef.current,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
    captureFrame,
    clearError: () => setError(null),
  };
}

