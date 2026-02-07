'use client';

import { useSearchParams } from "next/navigation";

export default function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const paymentMethod = searchParams.get('payment'); // 'check-in' or undefined (for Stripe)
  const emailParam = searchParams.get('email'); // Email for check-in payments
  const isLoading = !!sessionId;

  const isCheckInPayment = paymentMethod === 'check-in';
  const userEmail = emailParam || localStorage.getItem('checkInEmail');

  return (
    <>
      <h1 className="text-3xl font-bold text-center mb-4">
        {isCheckInPayment ? 'Registration Confirmed!' : 'Payment Successful!'}
      </h1>

      <p className="text-center text-gray-600 mb-8">
        {isCheckInPayment 
          ? `Thank you for registering. Your ticket confirmation has been sent to ${userEmail}. Please bring your confirmation to check-in and complete payment at the event.`
          : 'Thank you for your purchase. Your ticket has been confirmed and you are fully registered.'}
      </p>

      {/* Order Details */}
      {!isLoading && (
        <div className={`border rounded-lg p-6 mb-6 ${isCheckInPayment ? 'border-blue-200 bg-blue-50' : 'border-green-200 bg-green-50'}`}>
          <p className="text-sm text-gray-600 mb-2">{isCheckInPayment ? 'Confirmation' : 'Order Confirmation'}</p>
          <p className="font-mono text-sm text-gray-900 break-all mb-4">{sessionId || new Date().toISOString()}</p>
          {isCheckInPayment && userEmail && (
            <div className="bg-white rounded p-3 mb-3 border border-blue-100">
              <p className="text-xs text-gray-600 mb-1">Confirmation sent to:</p>
              <p className="font-semibold text-gray-900">{userEmail}</p>
            </div>
          )}
          <p className="text-xs text-gray-500">
            {isCheckInPayment 
              ? 'Check your email for your receipt and confirmation details. Please bring this confirmation to the event.'
              : 'A confirmation email has been sent to your registered email address.'}
          </p>
        </div>
      )}
    </>
  );
}
