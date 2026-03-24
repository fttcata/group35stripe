'use client';

import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          {/* Cancel Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-50 rounded-full mb-4">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-slate-900 mb-3">Payment Cancelled</h1>

          <p className="text-center text-slate-500 mb-6">
            Your cart has been preserved. You can proceed to checkout whenever you&apos;re ready.
          </p>

          {/* Info Box */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-6">
            <p className="text-sm text-slate-600">
              No charges have been made. Return to checkout to complete your purchase.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/buy"
              className="block w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Return to Checkout
            </Link>
            <Link
              href="/"
              className="block w-full text-center border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
