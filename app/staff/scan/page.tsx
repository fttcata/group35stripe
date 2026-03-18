'use client';

import { useEffect, useRef, useState } from 'react';
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
  const scanInFlightRef = useRef(false);
  const barcodeDetectorRef = useRef<any>(null);

  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([]);
  const [simulated, setSimulated] = useState(true);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [discoveringReaders, setDiscoveringReaders] = useState(false);
  const [connectingReader, setConnectingReader] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualTicketCode, setManualTicketCode] = useState('');
  const [lastDecodedPreview, setLastDecodedPreview] = useState<string>('');
  const [lastDecodeStatus, setLastDecodeStatus] = useState<'none' | 'accepted' | 'rejected'>('none');
  const [lastDecodeEngine, setLastDecodeEngine] = useState<'none' | 'barcode-detector' | 'jsqr'>('none');

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

  async function discoverReaders() {
    if (!terminal) {
      setTerminalError('Terminal is not initialized yet.');
      return;
    }

    setDiscoveringReaders(true);
    try {
      setTerminalError(null);
      const result = await terminal.discoverReaders({ simulated });
      if ('error' in result) throw new Error(result.error.message);
      setDiscoveredReaders(result.discoveredReaders || []);
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Failed to discover readers');
    } finally {
      setDiscoveringReaders(false);
    }
  }

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
    const isCheckedInMessage = ticket.isPaid;
    const amountCents = Math.max(0, Math.round(Number(ticket.totalAmount || 0) * 100));

    const lineItems = isCheckedInMessage
      ? [
          {
            description: `Checked In! - ${ownerName}`,
            amount: 0,
            quantity: 1,
          },
        ]
      : [
          {
            description: `${ownerName} - Outstanding balance`,
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
        total: isCheckedInMessage ? 0 : amountCents,
      },
    });

    if ('error' in result) {
      throw new Error(result.error.message);
    }
  }

  // Start camera
  const startCamera = async () => {
    try {
      setError(null);

      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Camera is not available in this environment.');
      }

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera access is blocked on non-secure pages. Open this scanner over HTTPS (or use localhost on the same device), or use manual ticket code entry below.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanning(true);
      }
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
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
      setScanning(false);
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
          setLastDecodeEngine('barcode-detector');
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
      setLastDecodeEngine('jsqr');
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
    const preview = qrData.length > 60 ? `${qrData.slice(0, 60)}...` : qrData;
    setLastDecodedPreview(preview);
    try {
      // QR contains format: TICKET-YYYYMMDD-XXXXXX|Event Title|timestamp
      const parts = qrData.split('|');
      const ticketCode = parts[0];

      if (!ticketCode || !ticketCode.startsWith('TICKET-')) {
        setLastDecodeStatus('rejected');
        throw new Error('Invalid QR code format');
      }

      setLastDecodeStatus('accepted');

      const response = await fetch('/api/qrcode/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ticket not found');
      }

      setScannedData(data);
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

  return (
    <div className="min-h-screen bg-slate-950 antialiased text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Staff Mobile</p>
            <h1 className="text-2xl font-black">Rapid Ticket Scan</h1>
          </div>
          <Link href="/staff" className="text-cyan-300 hover:text-cyan-200 font-semibold text-sm">
            Main Staff Console
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <section className="mb-5 rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-200">1) Connect Reader Once</p>
              <p className="text-xs text-slate-400 mt-1">
                Wireless reader stays connected while you scan and process each ticket.
              </p>
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${connectedReader ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-600/20 text-amber-300 border border-amber-500/40'}`}>
              {connectedReader ? `Connected: ${connectedReader.label}` : 'Not connected'}
            </span>
          </div>

          {!connectedReader && (
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={simulated}
                  onChange={(e) => setSimulated(e.target.checked)}
                  disabled={discoveringReaders || connectingReader}
                  className="rounded"
                />
                Use simulated reader (test mode)
              </label>

              <button
                onClick={discoverReaders}
                disabled={discoveringReaders || connectingReader}
                className="w-full rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-400 text-slate-950 font-bold py-3"
              >
                {discoveringReaders ? 'Discovering readers...' : 'Discover Readers'}
              </button>

              {discoveredReaders.length > 0 && (
                <div className="space-y-2">
                  {discoveredReaders.map((reader) => (
                    <button
                      key={reader.id}
                      onClick={() => connectReader(reader)}
                      disabled={connectingReader}
                      className="w-full text-left rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 px-4 py-3 font-semibold"
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
          {!cameraActive ? (
            <button
              onClick={startCamera}
              className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-5 px-6 text-xl"
            >
              Start Camera and Scan
            </button>
          ) : (
            <>
              <div className="relative bg-black rounded-2xl overflow-hidden mb-4 border border-slate-700">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-[66vh] max-h-160 object-cover"
                />
                <canvas ref={canvasRef} hidden width="300" height="300" />
                <div className="absolute inset-0 border-4 border-cyan-400 m-10 rounded-xl pointer-events-none">
                  <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-cyan-500/20" />
                </div>
                <div className="absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-bold bg-slate-950/70 text-cyan-200 border border-cyan-500/40">
                  {scanning ? 'Live: scanning' : scannedData ? 'Live: scan paused for ticket action' : 'Live camera'}
                </div>
              </div>
              <button
                onClick={stopCamera}
                className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 px-4"
              >
                Stop Camera
              </button>
            </>
          )}

          {error && (
            <div className="mt-4 bg-rose-950/50 border border-rose-700 text-rose-200 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="mt-4 bg-slate-900 border border-slate-700 rounded-xl p-4">
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
                className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-bold py-2 px-4 rounded"
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

          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-xs">
            <p className="text-slate-300 font-semibold">Scanner Debug</p>
            <p className="text-slate-400 mt-1">
              Status:{' '}
              <span className={
                lastDecodeStatus === 'accepted'
                  ? 'text-emerald-300'
                  : lastDecodeStatus === 'rejected'
                  ? 'text-amber-300'
                  : 'text-slate-500'
              }>
                {lastDecodeStatus === 'none' ? 'Waiting for decode...' : lastDecodeStatus}
              </span>
            </p>
            <p className="text-slate-400 mt-1">
              Decoder engine: {lastDecodeEngine}
            </p>
            <p className="text-slate-400 mt-1 break-all">
              Last decoded text: {lastDecodedPreview || 'No QR decoded yet'}
            </p>
          </div>
        </div>

        {/* Scanned Ticket Details */}
        {scannedData && (
          <div ref={resultRef} className="rounded-2xl border border-slate-700 bg-slate-900 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300 mb-3">2) Resolve Ticket</p>
            <div className="mb-6">
              <h2 className="text-3xl font-black mb-2">
                {scannedData.customerName || 'Customer'}
              </h2>
              <p className="text-slate-400">{scannedData.eventTitle}</p>
            </div>

            {/* Status Badge */}
            <div className={`mb-6 p-4 rounded-xl border-2 ${scannedData.isPaid ? 'bg-emerald-950/40 border-emerald-600 text-emerald-200' : 'bg-amber-950/40 border-amber-600 text-amber-200'}`}>
              <p className="font-bold text-lg">
                {scannedData.isPaid ? 'Checked In! (Paid)' : `Outstanding Balance: EUR ${scannedData.totalAmount.toFixed(2)}`}
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
              <div className="mb-6 bg-rose-950/50 p-4 rounded-xl border-2 border-rose-700 text-rose-200">
                <p className="font-bold">Already Checked In</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-1 gap-3">
              {!scannedData.tickets.some(t => t.is_used) && scannedData.isPaid && (
                <button
                  onClick={handleCheckIn}
                  disabled={loading}
                  className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-black py-4 px-4 text-lg"
                >
                  {loading ? 'Processing...' : 'Check In and Scan Next'}
                </button>
              )}

              {!scannedData.tickets.some(t => t.is_used) && !scannedData.isPaid && (
                <button
                  onClick={handleCollectPaymentAndCheckIn}
                  disabled={processingPayment || loading || !connectedReader}
                  className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-black py-4 px-4 text-lg"
                >
                  {processingPayment ? 'Collecting payment...' : 'Collect on Terminal and Check In'}
                </button>
              )}

              <button
                onClick={resetScan}
                disabled={loading || processingPayment}
                className="w-full rounded-xl bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-100 font-bold py-4 px-4 text-lg"
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
