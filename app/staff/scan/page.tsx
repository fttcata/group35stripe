'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { loadStripeTerminal } from '@stripe/terminal-js';
import type { Reader, Terminal } from '@stripe/terminal-js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import jsQR from 'jsqr';

interface ScannedTicket {
  ticketCode: string;
  orderId: string;
  eventId?: string;
  customerName?: string;
  eventTitle?: string;
  paymentStatus: string;
  totalAmount: number;
  isPaid: boolean;
  tickets: Array<{ id: string; is_used: boolean }>;
}

interface StaffEvent {
  eventId: string;
  title: string;
  startDate: string | null;
  venue: string | null;
}

export default function StaffScanPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <StaffScanPage />
    </Suspense>
  );
}

function StaffScanPage() {
  const searchParams = useSearchParams();
  const selectedEventId = (searchParams.get('eventId') || '').trim();

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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffAccessLoading, setStaffAccessLoading] = useState(true);
  const [hasStaffAccess, setHasStaffAccess] = useState(false);
  const [staffEvents, setStaffEvents] = useState<StaffEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<StaffEvent | null>(null);
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
        const events = Array.isArray(data.events) ? (data.events as StaffEvent[]) : [];
        setStaffEvents(events);
        setHasStaffAccess(events.length > 0);
        if (selectedEventId) {
          const matched = events.find((e) => e.eventId === selectedEventId) || null;
          setSelectedEvent(matched);
        }
      } catch {
        setHasStaffAccess(false);
      } finally {
        setStaffAccessLoading(false);
      }
    };

    loadStaffAccess();
  }, [selectedEventId]);

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

  // Handle scanned QR data
  const handleQRScanned = useCallback(async (qrData: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // QR contains format: 123456|Event Title|timestamp
      const parts = qrData.split('|');
      const ticketCode = parts[0]?.trim();
      const eventTitleHint = parts[1]?.trim() || undefined;

      if (!ticketCode) {
        throw new Error('Invalid QR code format');
      }

      const response = await fetch('/api/qrcode/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketCode, eventTitleHint, selectedEventId }),
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
  }, [selectedEventId, cameraActive, terminal, connectedReader]);

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
  }, [scanning, handleQRScanned]);

  // Handle check-in
  const handleCheckIn = async () => {
    if (!scannedData) return;
    setLoading(true);
    try {
      const response = await fetch('/api/qrcode/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: scannedData.orderId, selectedEventId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Check-in failed');

      const name = scannedData.customerName || 'Customer';
      setSuccessMessage(`${name} checked in successfully`);
      setScannedData(null);
      await clearReaderDisplay();

      // Auto-resume scanning after a brief delay so staff see the confirmation
      setTimeout(() => {
        setSuccessMessage(null);
        setScanning(true);
        if (!cameraActive) startCamera();
      }, 1500);
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
    setSuccessMessage(null);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedEventId }),
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
        body: JSON.stringify({ paymentIntentId: processResult.paymentIntent.id, selectedEventId }),
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) {
        throw new Error(completeData.error || 'Payment succeeded but check-in completion failed');
      }

      const name = scannedData.customerName || 'Customer';
      setSuccessMessage(`${name} — payment collected and checked in`);
      setScannedData(null);
      await clearReaderDisplay();

      setTimeout(() => {
        setSuccessMessage(null);
        setScanning(true);
        if (!cameraActive) startCamera();
      }, 1500);
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
      <div className="min-h-screen bg-slate-100 text-slate-900 grid place-items-center px-4">
        <p className="text-slate-600">Checking staff access...</p>
      </div>
    );
  }

  if (!hasStaffAccess) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 grid place-items-center px-4">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold">Staff access required</h1>
          <p className="mt-2 text-slate-600">
            Your account is not activated for event staff scanning yet. Enter your staff invite code in Account to unlock scanner access.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/account" className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2">
              Go to Account
            </Link>
            <Link href="/" className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2">
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedEventId) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 grid place-items-center px-4">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold">Select an event first</h1>
          <p className="mt-2 text-slate-600">Choose the event you are scanning for from the staff page.</p>
          <div className="mt-4">
            <Link href="/staff" className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 inline-block">
              Go to Staff Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 grid place-items-center px-4">
        <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold">Event not available</h1>
          <p className="mt-2 text-slate-600">You do not have scanner access for this event. Pick one of your assigned events.</p>
          <div className="mt-4">
            <Link href="/staff" className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold px-4 py-2 inline-block">
              Back to Staff Events
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 antialiased text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Staff Scanner</p>
            <h1 className="text-2xl font-bold text-slate-900">Event Ticket Scanner</h1>
            <p className="text-sm text-slate-600 mt-1">{selectedEvent.title}</p>
          </div>
          <Link href="/staff" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 hover:bg-slate-50 font-semibold text-sm">
            Change Event
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Reader Status</p>
              <p className="text-xs text-slate-600 mt-1">
                Scanner auto-discovers your Stripe reader and keeps it connected while you process guests.
              </p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${connectedReader ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {connectedReader ? `Connected: ${connectedReader.label}` : 'Not connected'}
            </span>
          </div>

          {!connectedReader && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-600">
                Looking for real Stripe readers on this network.
              </p>

              <button
                onClick={discoverReaders}
                disabled={discoveringReaders || connectingReader}
                className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-3"
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
                      className="w-full text-left rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 px-4 py-3 font-semibold text-slate-800"
                    >
                      {connectingReader ? 'Connecting...' : `Connect ${reader.label}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {terminalError && (
            <p className="mt-3 text-sm text-rose-700">Reader error: {terminalError}</p>
          )}
        </section>

        {/* Camera Feed */}
        <div className="mb-6">
          <div className="relative bg-black rounded-2xl overflow-hidden mb-4 border border-slate-300 min-h-85">
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
            <div className="absolute inset-0 border-2 border-white/70 m-10 rounded-xl pointer-events-none">
              <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-white/10" />
            </div>

            {!cameraActive && (
              <div className="absolute inset-0 grid place-items-center bg-black/45 p-4">
                <button
                  onClick={startCamera}
                  className="w-full max-w-sm rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold py-4 px-6 text-lg"
                >
                  Start Camera and Scan
                </button>
              </div>
            )}

            {cameraActive && !videoReady && (
              <div className="absolute inset-0 grid place-items-center bg-black/45 p-4 text-center">
                <p className="text-white text-sm font-medium mb-3">Starting live camera feed...</p>
                <button
                  onClick={startPreviewPlayback}
                  className="rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2 px-4"
                >
                  Start Live Feed
                </button>
              </div>
            )}

            <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold bg-black/50 text-white border border-white/30">
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
              className="w-full rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold py-3 px-4"
            >
              Stop Camera
            </button>
          )}

          {error && (
            <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg font-semibold text-lg text-center">
              {successMessage}
            </div>
          )}

          <div className="mt-4 bg-white border border-slate-200 rounded-lg p-4">
            <p className="text-sm text-slate-700 mb-2">Manual code entry</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualTicketCode}
                onChange={(e) => setManualTicketCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitManualCode()}
                placeholder="6-digit ticket code"
                className="flex-1 px-3 py-2 rounded border border-slate-300 text-slate-900"
              />
              <button
                onClick={submitManualCode}
                disabled={loading}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-2 px-4 rounded"
              >
                Submit
              </button>
            </div>
          </div>

          {loading && (
            <div className="mt-4 text-center text-slate-600">
              <p>Scanning...</p>
            </div>
          )}

        </div>

        {/* Scanned Ticket Details */}
        {scannedData && (
          <div ref={resultRef} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 mb-3">Resolve Ticket</p>
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2 text-slate-900">
                {scannedData.customerName || 'Customer'}
              </h2>
              <p className="text-slate-600">{scannedData.eventTitle}</p>
            </div>

            {/* Status Badge */}
            <div className={`mb-6 p-4 rounded-xl border-2 ${
              scannedData.tickets.some(t => t.is_used)
                ? 'bg-slate-100 border-slate-300 text-slate-800'
                : scannedData.isPaid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <p className="font-bold text-lg">
                {scannedData.tickets.some(t => t.is_used)
                  ? `${scannedData.customerName || 'Customer'}: Already checked in`
                  : scannedData.isPaid
                  ? 'Paid: ready to check in'
                  : `Outstanding Balance: EUR ${scannedData.totalAmount.toFixed(2)}`}
              </p>
              <p className="text-sm mt-1 text-slate-600">
                Reader display is synced for this ticket.
              </p>
            </div>

            {/* Ticket Info */}
            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-sm text-slate-500 mb-1">Ticket Code</p>
              <p className="font-mono font-bold text-lg text-slate-900">{scannedData.ticketCode}</p>
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
                  className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-4 px-4 text-lg"
                >
                  {loading ? 'Processing...' : 'Check In and Scan Next'}
                </button>
              )}

              {!scannedData.tickets.some(t => t.is_used) && !scannedData.isPaid && (
                <button
                  onClick={handleCollectPaymentAndCheckIn}
                  disabled={processingPayment || loading || !connectedReader}
                  className="w-full rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold py-4 px-4 text-lg"
                >
                  {processingPayment ? 'Collecting payment...' : 'Collect on Terminal and Check In'}
                </button>
              )}

              <button
                onClick={resetScan}
                disabled={loading || processingPayment}
                className="w-full rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 text-slate-800 font-semibold py-4 px-4 text-lg"
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
