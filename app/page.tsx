'use client';

import Hero from './components/Hero'
import FeaturedEvents from './components/FeaturedEvents'
import HowItWorks from './components/HowItWorks'
import Footer from './components/Footer'
import { useSearchParams } from 'next/navigation';

export default function Home() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  return (
    <div className="min-h-screen bg-gray-50 antialiased">
      {/* Payment Status Notifications */}
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

      <Hero />

      <main className="max-w-4xl mx-auto px-4">

        <FeaturedEvents />

  

        <HowItWorks />

        <div className="py-12">
          <h2 className="text-2xl font-bold">Join our community</h2>
          <p className="mt-2 text-sm text-gray-600">Sign up for updates and featured events.</p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
