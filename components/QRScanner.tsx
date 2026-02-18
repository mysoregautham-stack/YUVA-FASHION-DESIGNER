
import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'https://esm.sh/jsqr@1.4.0';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // required to tell iOS safari we don't want fullscreen
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        setError("Camera access denied or unavailable.");
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            onScan(code.data);
            return; // Stop scanning once found
          }
        }
      }
      animationId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      cancelAnimationFrame(animationId);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="absolute top-8 right-8 z-20">
        <button onClick={onClose} className="p-4 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative w-full max-w-md aspect-square px-6">
        {/* Scanner Viewport */}
        <div className="relative w-full h-full rounded-[40px] overflow-hidden border-4 border-white/20 shadow-2xl">
          <video ref={videoRef} className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Scanning Animation Overlays */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Corner Brackets */}
            <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-xl shadow-lg"></div>
            <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-xl shadow-lg"></div>
            <div className="absolute bottom-8 left-8 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-xl shadow-lg"></div>
            <div className="absolute bottom-8 right-8 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-xl shadow-lg"></div>
            
            {/* Scan Line */}
            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_20px_white] animate-[scan_3s_ease-in-out_infinite] top-0"></div>
          </div>
        </div>

        <div className="mt-12 text-center space-y-4">
          <h3 className="text-white text-2xl serif italic">Align Studio Tag</h3>
          <p className="text-white/50 text-xs font-black uppercase tracking-[0.3em]">Point camera at a StyleAI QR Code</p>
        </div>

        {error && (
          <div className="mt-8 p-4 bg-red-500/20 backdrop-blur-md border border-red-500/50 rounded-2xl text-red-200 text-center text-xs font-bold uppercase tracking-widest">
            {error}
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 10%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 90%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
