'use client';

import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-gray-50 antialiased">
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Cancel Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
              <span className="text-3xl text-yellow-600">⚠</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-center mb-4">Payment Cancelled</h1>

          <p className="text-center text-gray-600 mb-8">
            You have cancelled your payment. Your cart has been preserved, and you can proceed to checkout whenever you&apos;re ready.
          </p>

          {/* Info Box */}
          <div className="border border-yellow-200 rounded-lg p-6 bg-yellow-50 mb-6">
            <p className="text-sm text-gray-700">
              No charges have been made to your account. You can return to the checkout page to complete your purchase.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/buy"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition"
            >
              Return to Checkout
            </Link>
            <Link
              href="/"
              className="block w-full text-center border border-blue-600 text-blue-600 hover:bg-blue-50 font-bold py-3 px-4 rounded-lg transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
