'use client';

import Link from "next/link";
import { Suspense } from "react";
import SuccessContent from "../components/SuccessContent";

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 antialiased">
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <span className="text-3xl text-green-600">✓</span>
            </div>
          </div>

          <Suspense fallback={<div className="text-center text-gray-600">Loading...</div>}>
            <SuccessContent />
          </Suspense>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href="/"
              className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition"
            >
              Back to Home
            </Link>
            <Link
              href="/buy"
              className="block w-full text-center border border-blue-600 text-blue-600 hover:bg-blue-50 font-bold py-3 px-4 rounded-lg transition"
            >
              Buy Another Ticket
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
