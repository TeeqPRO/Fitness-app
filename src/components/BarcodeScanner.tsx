import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ScanLine, X } from 'lucide-react';

type ScannerProps = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

type DetectedBarcode = { rawValue?: string };

type BarcodeDetectorLike = {
  detect: (image: ImageBitmapSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export default function BarcodeScanner({ onDetected, onClose }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectingRef = useRef(false);
  const [err, setErr] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [detectorSupported, setDetectorSupported] = useState(true);

  const stopCamera = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const emitCode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    stopCamera();
    onDetected(code);
  };

  useEffect(() => {
    const start = async () => {
      try {
        const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        if (!window.isSecureContext && !isLocalhost) {
          throw new Error('Safari wymaga HTTPS do kamery. Otwórz aplikację przez https:// albo localhost.');
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Przeglądarka nie udostępnia API kamery.');
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: 'environment' },
            },
            audio: false,
          });
        } catch {
          // Fallback for browsers that reject detailed constraints.
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) throw new Error('Nie udało się uruchomić podglądu kamery.');
        video.srcObject = stream;
        await video.play();
        setStarting(false);

        const BarcodeDetectorGlobal = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (!BarcodeDetectorGlobal) {
          setDetectorSupported(false);
          return;
        }

        let detector: BarcodeDetectorLike;
        try {
          detector = new BarcodeDetectorGlobal({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf'],
          });
        } catch {
          detector = new BarcodeDetectorGlobal();
        }

        let lastScanTs = 0;
        const loop = () => {
          rafRef.current = requestAnimationFrame(loop);
          if (detectingRef.current) return;
          const now = Date.now();
          if (now - lastScanTs < 320) return;
          lastScanTs = now;

          if (!videoRef.current || videoRef.current.readyState < 2) return;
          detectingRef.current = true;
          detector.detect(videoRef.current)
            .then((barcodes) => {
              const first = barcodes.find((b) => b.rawValue?.trim());
              if (first?.rawValue) emitCode(first.rawValue);
            })
            .catch(() => {})
            .finally(() => {
              detectingRef.current = false;
            });
        };

        loop();
      } catch (e: any) {
        const name = String(e?.name || '');
        if (name === 'NotAllowedError' || name === 'SecurityError') {
          setErr('Brak zgody na kamerę. Zezwól na aparat w Safari i odśwież ekran.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setErr('Nie znaleziono kamery w tym urządzeniu.');
        } else {
          setErr(String(e?.message || e));
        }
        setStarting(false);
      }
    };

    start();

    return () => {
      stopCamera();
    };
  }, []);

  const submitManualCode = () => {
    if (!manualCode.trim()) return;
    emitCode(manualCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between p-4 safe-top">
        <h3 className="font-display text-lg font-semibold">Skanuj kod kreskowy</h3>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
      </div>
      <div className="relative flex-1 overflow-hidden bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center text-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        )}
        {!starting && detectorSupported && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-36 w-[75%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.3)]" />
          </div>
        )}
        {err && (
          <div className="absolute inset-x-4 top-4 rounded-2xl bg-destructive/90 p-4 text-sm text-destructive-foreground">
            Nie udało się włączyć kamery: {err}
          </div>
        )}
        {!starting && !detectorSupported && !err && (
          <div className="absolute inset-x-4 top-4 rounded-2xl bg-black/70 p-4 text-sm text-white">
            Auto-skanowanie nie jest wspierane w tej przeglądarce. Wpisz kod ręcznie poniżej.
          </div>
        )}
      </div>
      <div className="space-y-3 p-4 safe-bottom">
        <p className="text-center text-xs text-muted-foreground">Skieruj kamerę na kod kreskowy lub wpisz go ręcznie</p>
        <div className="flex gap-2">
          <Input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            inputMode="numeric"
            placeholder="Wpisz kod kreskowy"
            onKeyDown={(e) => { if (e.key === 'Enter') submitManualCode(); }}
          />
          <Button variant="hero" className="shrink-0" onClick={submitManualCode}>
            <ScanLine className="h-4 w-4" /> Szukaj
          </Button>
        </div>
      </div>
    </div>
  );
}
