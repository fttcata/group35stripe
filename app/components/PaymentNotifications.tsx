'use client';

import { useSearchParams } from 'next/navigation';

export default function PaymentNotifications() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  return (
    <>
      {success && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
            <p className="text-green-800 font-semibold">✓ Payment successful! You are fully registered for the event.</p>
          </div>
        </div>
      )}

      {canceled && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
            <p className="text-yellow-800">⚠ Payment was cancelled. Your cart is still available.</p>
          </div>
        </div>
      )}
    </>
  );
}
