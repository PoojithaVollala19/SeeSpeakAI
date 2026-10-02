import { useState, useCallback, useRef, useEffect } from 'react';

export function useCamera() {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsActive(true);
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Camera permission was denied. You can continue interview with voice-only.'
        : err.message || 'Unable to access camera device.';
      setError(msg);
      setIsActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const toggleCamera = useCallback(() => {
    if (isActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [isActive, startCamera, stopCamera]);

  // Attach stream to videoRef whenever active or ref changes
  useEffect(() => {
    if (isActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [isActive]);

  // Robust visual frame capture (video element -> ImageCapture API -> offscreen fallback)
  const captureFrame = useCallback(async (): Promise<string | null> => {
    if (!streamRef.current) {
      console.log('[useCamera] Cannot capture frame: stream is not active');
      return null;
    }

    try {
      // 1. Try currently mounted video element if playing
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && v.videoHeight > 0) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(800, v.videoWidth);
        canvas.height = Math.round((canvas.width / v.videoWidth) * v.videoHeight);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          console.log(`[useCamera] Frame captured via videoRef: ${canvas.width}x${canvas.height}, length=${dataUrl.length}`);
          return dataUrl;
        }
      }

      // 2. Try ImageCapture API on the live track
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.readyState === 'live' && typeof (window as any).ImageCapture !== 'undefined') {
        try {
          const imageCapture = new (window as any).ImageCapture(track);
          const bitmap = await imageCapture.grabFrame();
          if (bitmap && bitmap.width > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(800, bitmap.width);
            canvas.height = Math.round((canvas.width / bitmap.width) * bitmap.height);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              console.log(`[useCamera] Frame captured via ImageCapture: ${canvas.width}x${canvas.height}, length=${dataUrl.length}`);
              return dataUrl;
            }
          }
        } catch (icErr) {
          console.debug('[useCamera] ImageCapture fallback attempt failed:', icErr);
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
          canvas.width = Math.min(800, tempVideo.videoWidth);
          canvas.height = Math.round((canvas.width / tempVideo.videoWidth) * tempVideo.videoHeight);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            console.log(`[useCamera] Frame captured via offscreen video: ${canvas.width}x${canvas.height}, length=${dataUrl.length}`);
            return dataUrl;
          }
        }
      }
    } catch (e) {
      console.warn('[useCamera] Failed to capture camera frame:', e);
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
    isActive,
    error,
    videoRef,
    stream: streamRef.current,
    startCamera,
    stopCamera,
    toggleCamera,
    captureFrame,
    clearError: () => setError(null),
  };
}

