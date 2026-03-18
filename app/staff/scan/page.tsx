'use client';

import { useEffect, useRef, useState } from 'react';
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

export default function StaffScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<ScannedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualTicketCode, setManualTicketCode] = useState('');

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
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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

    const context = canvasRef.current.getContext('2d');
    if (!context) return null;

    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    const imageData = context.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Use jsQR library for QR code detection
    try {
      const jsQR = await import('jsqr').then(m => m.default);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      return code ? code.data : null;
    } catch {
      return null;
    }
  };

  // Main scanning loop
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

  // Handle scanned QR data
  const handleQRScanned = async (qrData: string) => {
    setLoading(true);
    setError(null);
    try {
      // QR contains format: TICKET-YYYYMMDD-XXXXXX|Event Title|timestamp
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
      setError(err instanceof Error ? err.message : 'Scan failed');
      setScanning(true);
      if (cameraActive) startCamera();
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
    setScanning(true);
    if (!cameraActive) startCamera();
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
    <div className="min-h-screen bg-gray-900 antialiased">
      <header className="bg-gray-800 text-white p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">📱 Ticket Scanner</h1>
          <Link href="/staff/terminal" className="text-blue-400 hover:underline">
            Back to Terminal
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Camera Feed */}
        {!scannedData && (
          <div className="mb-6">
            {!cameraActive ? (
              <button
                onClick={startCamera}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg text-lg"
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
                  <div className="absolute inset-0 border-4 border-blue-500 m-12 rounded-lg pointer-events-none">
                    <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-blue-500 opacity-20" />
                  </div>
                </div>
                <button
                  onClick={stopCamera}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg"
                >
                  ⏹️ Stop Camera
                </button>
              </>
            )}

            {error && (
              <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="mt-4 bg-gray-800 border border-gray-700 rounded p-4">
              <p className="text-sm text-gray-300 mb-2">Manual fallback (for local demo without HTTPS camera)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualTicketCode}
                  onChange={(e) => setManualTicketCode(e.target.value)}
                  placeholder="TICKET-YYYYMMDD-XXXXXX"
                  className="flex-1 px-3 py-2 rounded bg-gray-900 border border-gray-600 text-white"
                />
                <button
                  onClick={submitManualCode}
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-500 text-white font-bold py-2 px-4 rounded"
                >
                  Submit
                </button>
              </div>
            </div>

            {loading && (
              <div className="mt-4 text-center text-blue-400">
                <p>Scanning...</p>
              </div>
            )}
          </div>
        )}

        {/* Scanned Ticket Details */}
        {scannedData && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="mb-6">
              <h2 className="text-3xl font-bold mb-2">
                {scannedData.customerName || 'Customer'}
              </h2>
              <p className="text-gray-600">{scannedData.eventTitle}</p>
            </div>

            {/* Status Badge */}
            <div className={`mb-6 p-4 rounded-lg ${scannedData.isPaid ? 'bg-green-100 border-green-300 text-green-800' : 'bg-yellow-100 border-yellow-300 text-yellow-800'} border-2`}>
              <p className="font-bold text-lg">
                {scannedData.isPaid ? '✓ Payment Confirmed' : `💳 Outstanding: €${scannedData.totalAmount.toFixed(2)}`}
              </p>
            </div>

            {/* Ticket Info */}
            <div className="mb-6 bg-gray-50 p-4 rounded border border-gray-200">
              <p className="text-sm text-gray-600 mb-1">Ticket Code</p>
              <p className="font-mono font-bold text-lg text-blue-600">{scannedData.ticketCode}</p>
            </div>

            {/* Already Used Check */}
            {scannedData.tickets.some(t => t.is_used) && (
              <div className="mb-6 bg-red-50 p-4 rounded border-2 border-red-300 text-red-800">
                <p className="font-bold">⚠️ Already Checked In</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4">
              {!scannedData.tickets.some(t => t.is_used) && (
                <button
                  onClick={handleCheckIn}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 px-4 rounded-lg"
                >
                  {loading ? 'Processing...' : scannedData.isPaid ? '✓ Check In' : '💳 Collect Payment'}
                </button>
              )}
              <button
                onClick={resetScan}
                disabled={loading}
                className="flex-1 bg-gray-400 hover:bg-gray-500 disabled:bg-gray-300 text-white font-bold py-3 px-4 rounded-lg"
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
