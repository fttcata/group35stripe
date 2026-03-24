'use client';

import Link from "next/link";
import { Suspense } from "react";
import SuccessContent from "../components/SuccessContent";

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-50 rounded-full mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            </div>
          </div>

          <Suspense fallback={<div className="text-center text-slate-500">Loading...</div>}>
            <SuccessContent />
          </Suspense>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full text-center bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Back to Home
            </Link>
            <Link
              href="/buy"
              className="block w-full text-center border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Buy Another Ticket
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
