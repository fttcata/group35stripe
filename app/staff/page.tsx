'use client';

import { useEffect, useRef, useState } from 'react';
import { loadStripeTerminal } from '@stripe/terminal-js';
import type { Reader, Terminal } from '@stripe/terminal-js';
import Link from 'next/link';

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

interface Event {
  id: string;
  title: string;
  date: string;
  location: string;
}

export default function StaffPage() {
  // Event selection state
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(true);

  // Terminal state
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [connectedReader, setConnectedReader] = useState<Reader | null>(null);
  const [discoveredReaders, setDiscoveredReaders] = useState<Reader[]>([]);
  const [simulated, setSimulated] = useState(true);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [discoveringReaders, setDiscoveringReaders] = useState(false);
  const [connectingReader, setConnectingReader] = useState(false);
  const [showTerminalSetup, setShowTerminalSetup] = useState(false);

  // Scanner state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedTicket | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualTicketCode, setManualTicketCode] = useState('');

  // Load events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch('/api/events');
        const data = await response.json();
        if (response.ok && data.events) {
          // Filter to upcoming events only
          const now = new Date();
          const upcomingEvents = data.events.filter((event: Event) => 
            new Date(event.date) >= now
          );
          setEvents(upcomingEvents);
        }
      } catch (error) {
        console.error('Failed to load events:', error);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
  }, []);

  // Initialize Stripe Terminal
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

  // Terminal functions
  async function discoverReaders() {
    if (!terminal) { setTerminalError('Terminal is not initialized yet.'); return; }
    setDiscoveringReaders(true);
    try {
      setTerminalError(null);
      const result = await terminal.discoverReaders({ simulated });
      if ('error' in result) throw new Error(result.error.message);
      setDiscoveredReaders(result.discoveredReaders || []);
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setDiscoveringReaders(false);
    }
  }

  async function connectReader(reader: Reader) {
    if (!terminal) { setTerminalError('Terminal is not initialized yet.'); return; }
    setConnectingReader(true);
    try {
      setTerminalError(null);
      const result = await terminal.connectReader(reader);
      if ('error' in result) throw new Error(result.error.message);
      setConnectedReader(reader);
      setShowTerminalSetup(false);
    } catch (err) {
      setTerminalError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnectingReader(false);
    }
  }

  // Camera functions
  const startCamera = async () => {
    try {
      setScanError(null);

      if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        throw new Error('Camera is not available in this environment.');
      }

      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera access is blocked on non-secure pages. Open this scanner over HTTPS (or use localhost on the same device), or use manual ticket code entry below.'
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setScanning(true);
      }
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Failed to access camera'
      );
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setCameraActive(false);
      setScanning(false);
    }
  };

  const decodeQRFromCanvas = async (): Promise<string | null> => {
    if (!canvasRef.current || !videoRef.current) return null;

    const context = canvasRef.current.getContext('2d');
    if (!context) return null;

    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

    try {
      const jsQR = await import('jsqr').then(m => m.default);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      return code ? code.data : null;
    } catch {
      return null;
    }
  };

  // QR scanning loop
  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    const scanInterval = setInterval(async () => {
      if (!canvasRef.current || !videoRef.current) return;
      const text = await decodeQRFromCanvas();
      if (text) {
        setScanning(false);
        stopCamera();
        handleQRScanned(text);
      }
    }, 300);

    return () => clearInterval(scanInterval);
  }, [scanning]);

  const handleQRScanned = async (qrData: string) => {
    setLoading(true);
    setScanError(null);
    try {
      const parts = qrData.split('|');
      const ticketCode = parts[0];

      if (!ticketCode || !ticketCode.startsWith('TICKET-')) {
        throw new Error('Invalid QR code format');
      }

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
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed');
      setScanning(true);
      if (cameraActive) startCamera();
    } finally {
      setLoading(false);
    }
  };

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

      // Reset for next scan
      setScannedData(null);
      setScanError(null);
      setManualTicketCode('');
      setScanning(true);
      if (!cameraActive) startCamera();
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    setScannedData(null);
    setScanError(null);
    setManualTicketCode('');
    setScanning(true);
    if (!cameraActive) startCamera();
  };

  const submitManualCode = async () => {
    const code = manualTicketCode.trim();
    if (!code) {
      setScanError('Enter a ticket code first.');
      return;
    }
    await handleQRScanned(code);
  };

  return (
    <div className="min-h-screen bg-gray-900 antialiased">
      {/* Header with Terminal Status */}
      <header className="bg-gray-800 text-white p-4 border-b border-gray-700">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">🎫 Staff Scanner</h1>
              {selectedEvent ? (
                <p className="text-sm text-gray-400">{selectedEvent.title}</p>
              ) : (
                <p className="text-sm text-gray-400">Select an event to begin</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/staff/scan"
                className="px-3 py-2 rounded-lg text-sm font-medium bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                🚀 Rapid Mobile Scan
              </Link>
              <button
                onClick={() => setShowTerminalSetup(!showTerminalSetup)}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${
                  connectedReader
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-yellow-600 hover:bg-yellow-700'
                }`}
              >
                {connectedReader ? `✓ ${connectedReader.label}` : '⚠️ Setup Terminal'}
              </button>
            </div>
          </div>
          
          {terminalError && (
            <div className="mt-2 text-sm text-red-400">
              Terminal Error: {terminalError}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Event Selection */}
        {!selectedEvent ? (
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Select Event</h2>
            <p className="text-gray-400 text-sm mb-6">
              Choose the event you'll be scanning tickets for
            </p>

            {loadingEvents ? (
              <div className="text-center text-gray-400 py-8">
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                No upcoming events found
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg p-4 transition-colors"
                  >
                    <h3 className="font-semibold text-white text-lg">{event.title}</h3>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                      <span>📍 {event.location}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Change Event Button */}
            <button
              onClick={() => {
                setSelectedEvent(null);
                stopCamera();
                setScannedData(null);
              }}
              className="mb-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
            >
              ← Change Event
            </button>

            {/* Terminal Setup (Collapsible) */}
            {showTerminalSetup && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Terminal Setup</h2>
            
            {!connectedReader ? (
              <>
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-gray-300">
                    <input
                      type="checkbox"
                      checked={simulated}
                      onChange={(e) => setSimulated(e.target.checked)}
                      disabled={discoveringReaders}
                      className="rounded"
                    />
                    <span className="text-sm">Use Simulated Reader (for testing)</span>
                  </label>
                </div>

                <button
                  onClick={discoverReaders}
                  disabled={discoveringReaders || connectingReader}
                  className="w-full mb-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg"
                >
                  {discoveringReaders ? 'Discovering...' : 'Discover Readers'}
                </button>

                {discoveredReaders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400 font-semibold">Available Readers:</p>
                    {discoveredReaders.map((reader) => (
                      <button
                        key={reader.id}
                        onClick={() => connectReader(reader)}
                        disabled={connectingReader}
                        className="w-full text-left bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 border border-gray-600 rounded-lg p-3 font-medium text-white"
                      >
                        {reader.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-green-400">
                <p className="font-semibold">✓ Connected to: {connectedReader.label}</p>
                <p className="text-sm text-gray-400 mt-2">Terminal is ready for payments</p>
              </div>
            )}
          </div>
        )}

        {/* Scanner Section */}
        {!scannedData ? (
          <div>
            {!cameraActive ? (
              <button
                onClick={startCamera}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 px-6 rounded-lg text-xl mb-4"
              >
                📷 Start Camera
              </button>
            ) : (
              <>
                <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-96 object-cover"
                  />
                  <canvas ref={canvasRef} hidden width="300" height="300" />
                  <div className="absolute inset-0 border-4 border-blue-500 m-12 rounded-lg pointer-events-none" />
                  {scanning && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                      🔍 Scanning for QR codes...
                    </div>
                  )}
                </div>
                <button
                  onClick={stopCamera}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg mb-4"
                >
                  ⏹️ Stop Camera
                </button>
              </>
            )}

            {scanError && (
              <div className="mb-4 bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
                {scanError}
              </div>
            )}

            {/* Manual Entry */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Manual Entry</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualTicketCode}
                  onChange={(e) => setManualTicketCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitManualCode()}
                  placeholder="TICKET-YYYYMMDD-XXXXXX"
                  className="flex-1 px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white"
                />
                <button
                  onClick={submitManualCode}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded"
                >
                  {loading ? '...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Scanned Ticket Result */
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2 text-gray-900">
                {scannedData.customerName || 'Customer'}
              </h2>
              <p className="text-gray-600">{scannedData.eventTitle}</p>
            </div>

            <div className={`mb-6 p-4 rounded-lg border-2 ${
              scannedData.isPaid 
                ? 'bg-green-100 border-green-400 text-green-900' 
                : 'bg-yellow-100 border-yellow-400 text-yellow-900'
            }`}>
              <p className="font-bold text-lg">
                {scannedData.isPaid 
                  ? '✓ Payment Confirmed' 
                  : `💳 Outstanding Balance: €${scannedData.totalAmount.toFixed(2)}`
                }
              </p>
            </div>

            <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Ticket Code</p>
              <p className="font-mono font-bold text-lg text-blue-600">{scannedData.ticketCode}</p>
            </div>

            {scannedData.tickets.some(t => t.is_used) && (
              <div className="mb-6 bg-red-50 p-4 rounded border-2 border-red-400 text-red-900">
                <p className="font-bold">⚠️ Already Checked In</p>
              </div>
            )}

            <div className="flex gap-4">
              {!scannedData.tickets.some(t => t.is_used) && (
                <button
                  onClick={handleCheckIn}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-4 px-4 rounded-lg text-lg"
                >
                  {loading ? 'Processing...' : scannedData.isPaid ? '✓ Check In' : '💳 Collect Payment & Check In'}
                </button>
              )}
              <button
                onClick={resetScan}
                disabled={loading}
                className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white font-bold py-4 px-4 rounded-lg text-lg"
              >
                Next Ticket
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
