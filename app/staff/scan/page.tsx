'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadStripeTerminal } from '@stripe/terminal-js';
import type { Reader, Terminal } from '@stripe/terminal-js';
import Link from 'next/link';
import jsQR from 'jsqr';

interface ScannedTicket {
  ticketCode: string;
  orderId: string;
  customerName?: string;
  eventTitle?: string;
  paymentStatus: string;
  totalAmount: number;
  isPaid: boolean;
  tickets: Array<{ id: string; is_used: boolean }>;
}

export default function StaffScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scanInFlightRef = useRef(false);
  const barcodeDetectorRef = useRef<any>(null);

  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([]);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [discoveringReaders, setDiscoveringReaders] = useState(false);
  const [connectingReader, setConnectingReader] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffAccessLoading, setStaffAccessLoading] = useState(true);
  const [hasStaffAccess, setHasStaffAccess] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [manualTicketCode, setManualTicketCode] = useState('');

  useEffect(() => {
    let mounted = true;

    const setupTerminal = async () => {
      try {
        const StripeTerminal = await loadStripeTerminal();
        if (!StripeTerminal) {
          throw new Error('Failed to load Stripe Terminal SDK');
        }

        const terminalInstance = StripeTerminal.create({
          onFetchConnectionToken: async () => {
            const res = await fetch('/api/terminal/connection-token', { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.secret) {
              throw new Error(data.error || 'Failed to fetch connection token');
            }
            return data.secret as string;
          },
          onUnexpectedReaderDisconnect: () => {
            setConnectedReader(null);
            setTerminalError('Reader disconnected unexpectedly. Reconnect to continue terminal actions.');
          },
        });

        if (mounted) {
          setTerminal(terminalInstance);
        }
      } catch (err) {
        if (mounted) {
          setTerminalError(err instanceof Error ? err.message : 'Failed to initialize Stripe Terminal');
        }
      }
    };

    setupTerminal();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    const loadStaffAccess = async () => {
      try {
        const response = await fetch('/api/staff/my-events');
        if (!response.ok) {
          setHasStaffAccess(false);
          return;
        }
        const data = await response.json();
        setHasStaffAccess(Array.isArray(data.events) && data.events.length > 0);
      } catch {
        setHasStaffAccess(false);
      } finally {
        setStaffAccessLoading(false);
      }
    };

    loadStaffAccess();
  }, []);

  const discoverReaders = useCallback(async () => {
    if (!terminal) {
      setTerminalError('Terminal is not initialized yet.');
      return;
    }

    setDiscoveringReaders(true);
    try {
      setTerminalError(null);
      const result = await terminal.discoverReaders({ simulated: false });
      if ('error' in result) throw new Error(result.error.message);
      setDiscoveredReaders(result.discoveredReaders || []);
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Failed to discover readers');
    } finally {
      setDiscoveringReaders(false);
    }
  }, [terminal]);

  useEffect(() => {
    if (!terminal || connectedReader) return;

    discoverReaders();
    const intervalId = window.setInterval(() => {
      if (!connectedReader) {
        discoverReaders();
      }
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [terminal, connectedReader, discoverReaders]);

  async function connectReader(reader: Reader) {
    if (!terminal) {
      setTerminalError('Terminal is not initialized yet.');
      return;
    }

    setConnectingReader(true);
    try {
      setTerminalError(null);
      const result = await terminal.connectReader(reader);
      if ('error' in result) throw new Error(result.error.message);
      setConnectedReader(reader);
      setDiscoveredReaders([]);
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Failed to connect reader');
    } finally {
      setConnectingReader(false);
    }
  }

  async function clearReaderDisplay() {
    if (!terminal || !connectedReader) return;
    const result = await terminal.clearReaderDisplay();
    if ('error' in result) {
      throw new Error(result.error.message);
    }
  }

  async function setReaderDisplayForScan(ticket: ScannedTicket) {
    if (!terminal || !connectedReader) return;

    const ownerName = ticket.customerName || 'Customer';
    const alreadyCheckedIn = ticket.tickets.some((t) => t.is_used);
    const amountCents = Math.max(0, Math.round(Number(ticket.totalAmount || 0) * 100));

    const lineItems = alreadyCheckedIn
      ? [
          {
            description: `ERROR - ${ownerName}: already checked in`,
            amount: 0,
            quantity: 1,
          },
        ]
      : ticket.isPaid
      ? [
          {
            description: `${ownerName}: Paid - ready to check in`,
            amount: 0,
            quantity: 1,
          },
        ]
      : [
          {
            description: `${ownerName}: Outstanding balance`,
            amount: amountCents,
            quantity: 1,
          },
        ];

    const result = await terminal.setReaderDisplay({
      type: 'cart',
      cart: {
        currency: 'eur',
        line_items: lineItems,
        tax: 0,
        total: alreadyCheckedIn || ticket.isPaid ? 0 : amountCents,
      },
    });

    if ('error' in result) {
      throw new Error(result.error.message);
    }
  }

  const playDuplicateAlertBeep = async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      const audioContext = audioContextRef.current;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const now = audioContext.currentTime;
      const beep = (start: number, frequency: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.35, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      };

      // Three quick harsh beeps to signal a blocking error state.
      beep(now, 940, 0.12);
      beep(now + 0.17, 760, 0.12);
      beep(now + 0.34, 620, 0.16);
    } catch {
      // Ignore audio errors (for example, autoplay policies).
    }
  };

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);
      setVideoReady(false);

      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Camera is not available in this environment.');
      }

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera access is blocked on non-secure pages. Open this scanner over HTTPS (or use localhost on the same device), or use manual ticket code entry below.'
        );
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch {
        // Desktop/laptop webcams may not support environment-facing constraints.
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      }

      streamRef.current = stream;

      if (!videoRef.current) {
        throw new Error('Camera preview element is not ready. Refresh and try again.');
      }

      videoRef.current.srcObject = stream;
      setCameraActive(true);
      try {
        await videoRef.current.play();
      } catch {
        // Keep stream attached even if autoplay is blocked; user can tap Start Live Feed.
      }
      setScanning(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to access camera'
      );
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setVideoReady(false);
    setScanning(false);
  };

  const startPreviewPlayback = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setVideoReady(true);
    } catch {
      setError('Browser blocked preview playback. Click Start Live Feed again.');
    }
  };

  // Decode QR code using a library
  const decodeQRFromCanvas = async (): Promise<string | null> => {
    if (!canvasRef.current || !videoRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight) return null;

    // Match canvas to live frame size so jsQR gets full-resolution pixels.
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Try native BarcodeDetector first when available.
    try {
      const BarcodeDetectorCtor = (globalThis as any).BarcodeDetector;
      if (BarcodeDetectorCtor) {
        if (!barcodeDetectorRef.current) {
          barcodeDetectorRef.current = new BarcodeDetectorCtor({ formats: ['qr_code'] });
        }

        const detected = await barcodeDetectorRef.current.detect(canvas);
        if (Array.isArray(detected) && detected.length > 0 && detected[0].rawValue) {
          return String(detected[0].rawValue);
        }
      }
    } catch {
      // Fall through to jsQR fallback.
    }

    // Fallback to jsQR for browsers without BarcodeDetector or when it misses.
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code?.data) {
      return code.data;
    }

    return null;
  };

  useEffect(() => {
    if (scannedData && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scannedData]);

  // Main scanning loop
  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const scanInterval = setInterval(async () => {
      if (scanInFlightRef.current) return;
      if (!canvasRef.current || !videoRef.current) return;
      const text = await decodeQRFromCanvas();
      if (text) {
        scanInFlightRef.current = true;
        setScanning(false);
        await handleQRScanned(text);
        scanInFlightRef.current = false;
      }
    }, 300);

    return () => clearInterval(scanInterval);
  }, [scanning]);

  // Handle scanned QR data
  const handleQRScanned = async (qrData: string) => {
    setLoading(true);
    setError(null);
    try {
      // QR contains format: TICKET-YYYYMMDD-XXXXXX|Event Title|timestamp
      const parts = qrData.split('|');
      const ticketCode = parts[0];
      const eventTitleHint = parts[1]?.trim() || undefined;

      if (!ticketCode || !ticketCode.startsWith('TICKET-')) {
        throw new Error('Invalid QR code format');
      }

      const response = await fetch('/api/qrcode/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketCode, eventTitleHint }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ticket not found');
      }

      setScannedData(data);
      if (data.tickets?.some((t: { is_used: boolean }) => t.is_used)) {
        await playDuplicateAlertBeep();
      }
      await setReaderDisplayForScan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
      if (!cameraActive) {
        await startCamera();
      } else {
        setScanning(true);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    if (!scannedData) return;
    setLoading(true);
    try {
      const response = await fetch('/api/qrcode/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: scannedData.orderId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Check-in failed');

      setScannedData(null);
      await clearReaderDisplay();
      setScanning(true);
      if (!cameraActive) startCamera();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  // Reset scan
  const resetScan = () => {
    setScannedData(null);
    setError(null);
    clearReaderDisplay().catch(() => undefined);
    setScanning(true);
    if (!cameraActive) startCamera();
  };

  const handleCollectPaymentAndCheckIn = async () => {
    if (!terminal || !connectedReader || !scannedData) {
      setError('Connect a Stripe reader first to collect payment.');
      return;
    }

    setProcessingPayment(true);
    setError(null);

    try {
      const intentResponse = await fetch(`/api/terminal/orders/${scannedData.orderId}/intent`, {
        method: 'POST',
      });
      const intentData = await intentResponse.json();

      if (!intentResponse.ok || !intentData.clientSecret) {
        throw new Error(intentData.error || 'Failed to create terminal payment intent');
      }

      const collectResult = await terminal.collectPaymentMethod(intentData.clientSecret);
      if ('error' in collectResult) {
        throw new Error(collectResult.error.message);
      }

      const processResult = await terminal.processPayment(collectResult.paymentIntent);
      if ('error' in processResult) {
        throw new Error(processResult.error.message);
      }

      const completeResponse = await fetch(`/api/terminal/orders/${scannedData.orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: processResult.paymentIntent.id }),
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) {
        throw new Error(completeData.error || 'Payment succeeded but check-in completion failed');
      }

      setScannedData(null);
      await clearReaderDisplay();
      setScanning(true);
      if (!cameraActive) {
        await startCamera();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment collection failed');
    } finally {
      setProcessingPayment(false);
    }
  };

  const submitManualCode = async () => {
    const code = manualTicketCode.trim();
    if (!code) {
      setError('Enter a ticket code first.');
      return;
    }

    await handleQRScanned(code);
  };

  if (staffAccessLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center px-4">
        <p className="text-slate-300">Checking staff access...</p>
      </div>
    );
  }

  if (!hasStaffAccess) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 grid place-items-center px-4">
        <div className="max-w-lg w-full rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h1 className="text-2xl font-black">Staff access required</h1>
          <p className="mt-2 text-slate-300">
            Your account is not activated for event staff scanning yet. Enter your staff invite code in Account to unlock scanner access.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/account" className="rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-4 py-2">
              Go to Account
            </Link>
            <Link href="/" className="rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold px-4 py-2">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 antialiased text-slate-100 relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-28 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 -right-20 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Staff Mobile</p>
            <h1 className="text-2xl font-black bg-linear-to-r from-cyan-200 via-white to-emerald-200 bg-clip-text text-transparent">
              Rapid Ticket Scan
            </h1>
          </div>
          <Link href="/staff" className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-cyan-200 hover:text-cyan-100 hover:bg-cyan-400/20 font-semibold text-sm transition-colors">
            Main Staff Console
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <section className="mb-5 rounded-2xl border border-slate-700/80 bg-slate-900/80 backdrop-blur p-4 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-200">Reader Status</p>
              <p className="text-xs text-slate-400 mt-1">
                Scanner auto-discovers your Stripe reader and keeps it connected while you process guests.
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${connectedReader ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_16px_rgba(16,185,129,0.25)]' : 'bg-amber-600/20 text-amber-300 border border-amber-500/40 animate-pulse'}`}>
              {connectedReader ? `Connected: ${connectedReader.label}` : 'Not connected'}
            </span>
          </div>

          {!connectedReader && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-300">
                Looking for real Stripe readers on this network.
              </p>

              <button
                onClick={discoverReaders}
                disabled={discoveringReaders || connectingReader}
                className="w-full rounded-xl bg-linear-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 text-slate-950 font-bold py-3 transition-all"
              >
                {discoveringReaders ? 'Discovering readers...' : 'Refresh Reader Search'}
              </button>

              {discoveredReaders.length > 0 && (
                <div className="space-y-2">
                  {discoveredReaders.map((reader) => (
                    <button
                      key={reader.id}
                      onClick={() => connectReader(reader)}
                      disabled={connectingReader}
                      className="w-full text-left rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-4 py-3 font-semibold transition-colors"
                    >
                      {connectingReader ? 'Connecting...' : `Connect ${reader.label}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {terminalError && (
            <p className="mt-3 text-sm text-rose-300">Reader error: {terminalError}</p>
          )}
        </section>

        {/* Camera Feed */}
        <div className="mb-6">
          <div className="relative bg-black rounded-2xl overflow-hidden mb-4 border border-cyan-500/30 min-h-85 shadow-[0_20px_60px_rgba(8,145,178,0.2)]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setVideoReady(true)}
              onPlaying={() => setVideoReady(true)}
              className="w-full h-[66vh] max-h-160 object-cover"
            />
            <canvas ref={canvasRef} hidden width="300" height="300" />
            <div className="absolute inset-0 border-[3px] border-cyan-300/80 m-10 rounded-xl pointer-events-none">
              <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-cyan-400/20" />
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-cyan-300/70 animate-pulse" />
            </div>

            {!cameraActive && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/70 p-4">
                <button
                  onClick={startCamera}
                  className="w-full max-w-sm rounded-2xl bg-linear-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 font-black py-5 px-6 text-xl transition-all"
                >
                  Start Camera and Scan
                </button>
              </div>
            )}

            {cameraActive && !videoReady && (
              <div className="absolute inset-0 grid place-items-center bg-slate-950/60 p-4 text-center">
                <p className="text-slate-200 text-sm font-semibold mb-3">Starting live camera feed...</p>
                <button
                  onClick={startPreviewPlayback}
                  className="rounded-xl bg-linear-to-r from-cyan-400 to-cyan-300 hover:from-cyan-300 hover:to-cyan-200 text-slate-950 font-bold py-2 px-4"
                >
                  Start Live Feed
                </button>
              </div>
            )}

            <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold bg-slate-950/70 text-cyan-200 border border-cyan-500/40">
              {!cameraActive
                ? 'Live camera not started'
                : scanning
                ? 'Live: scanning'
                : scannedData
                ? 'Live: scan paused for ticket action'
                : 'Live camera'}
            </div>
          </div>

          {cameraActive && (
            <button
              onClick={stopCamera}
              className="w-full rounded-xl bg-linear-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold py-3 px-4 transition-all"
            >
              Stop Camera
            </button>
          )}

          {error && (
            <div className="mt-4 bg-rose-950/50 border border-rose-700 text-rose-200 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="mt-4 bg-slate-900/85 border border-slate-700 rounded-xl p-4 backdrop-blur">
            <p className="text-sm text-slate-300 mb-2">Manual code entry</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualTicketCode}
                onChange={(e) => setManualTicketCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManualCode()}
                placeholder="TICKET-YYYYMMDD-XXXXXX"
                className="flex-1 px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100"
              />
              <button
                onClick={submitManualCode}
                disabled={loading}
                className="bg-linear-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-slate-950 font-bold py-2 px-4 rounded"
              >
                Submit
              </button>
            </div>
          </div>

          {loading && (
            <div className="mt-4 text-center text-cyan-300">
              <p>Scanning...</p>
            </div>
          )}

        </div>

        {/* Scanned Ticket Details */}
        {scannedData && (
          <div ref={resultRef} className="rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur p-6 sm:p-8 shadow-[0_18px_48px_rgba(0,0,0,0.38)]">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-3">Resolve Ticket</p>
            <div className="mb-6">
              <h2 className="text-3xl font-black mb-2">
                {scannedData.customerName || 'Customer'}
              </h2>
              <p className="text-slate-400">{scannedData.eventTitle}</p>
            </div>

            {/* Status Badge */}
            <div className={`mb-6 p-4 rounded-xl border-2 ${
              scannedData.tickets.some(t => t.is_used)
                ? 'bg-cyan-950/40 border-cyan-600 text-cyan-200'
                : scannedData.isPaid
                ? 'bg-emerald-950/40 border-emerald-600 text-emerald-200'
                : 'bg-amber-950/40 border-amber-600 text-amber-200'
            }`}>
              <p className="font-bold text-lg">
                {scannedData.tickets.some(t => t.is_used)
                  ? `${scannedData.customerName || 'Customer'}: Already checked in`
                  : scannedData.isPaid
                  ? 'Paid: ready to check in'
                  : `Outstanding Balance: EUR ${scannedData.totalAmount.toFixed(2)}`}
              </p>
              <p className="text-sm mt-1 text-slate-300">
                Reader display is synced for this ticket.
              </p>
            </div>

            {/* Ticket Info */}
            <div className="mb-6 bg-slate-950 p-4 rounded-xl border border-slate-700">
              <p className="text-sm text-slate-400 mb-1">Ticket Code</p>
              <p className="font-mono font-bold text-lg text-cyan-300">{scannedData.ticketCode}</p>
            </div>

            {/* Already Used Check */}
            {scannedData.tickets.some(t => t.is_used) && (
              <div className="mb-6 bg-red-900/60 p-4 rounded-xl border-2 border-red-500 text-red-100">
                <p className="font-black text-lg">STOP: Duplicate check-in scan</p>
                <p className="mt-1 font-semibold">This paid ticket has already been scanned and checked in.</p>
                <p className="mt-1 text-sm text-red-200">Terminal message sent: ERROR - {(scannedData.customerName || 'Customer')}: already checked in</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-3">
              {!scannedData.tickets.some(t => t.is_used) && scannedData.isPaid && (
                <button
                  onClick={handleCheckIn}
                  disabled={loading}
                  className="w-full rounded-xl bg-linear-to-r from-emerald-400 to-emerald-300 hover:from-emerald-300 hover:to-emerald-200 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-slate-950 font-black py-4 px-4 text-lg transition-all"
                >
                  {loading ? 'Processing...' : 'Check In and Scan Next'}
                </button>
              )}

              {!scannedData.tickets.some(t => t.is_used) && !scannedData.isPaid && (
                <button
                  onClick={handleCollectPaymentAndCheckIn}
                  disabled={processingPayment || loading || !connectedReader}
                  className="w-full rounded-xl bg-linear-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-slate-950 font-black py-4 px-4 text-lg transition-all"
                >
                  {processingPayment ? 'Collecting payment...' : 'Collect on Terminal and Check In'}
                </button>
              )}

              <button
                onClick={resetScan}
                disabled={loading || processingPayment}
                className="w-full rounded-xl bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 font-bold py-4 px-4 text-lg transition-colors"
              >
                Scan Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
