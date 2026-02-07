'use client';

import { Suspense } from 'react';
import Hero from './components/Hero'
import FeaturedEvents from './components/FeaturedEvents'
import HowItWorks from './components/HowItWorks'
import Footer from './components/Footer'
import PaymentNotifications from './components/PaymentNotifications';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 antialiased">
      {/* Payment Status Notifications */}
      <Suspense fallback={null}>
        <PaymentNotifications />
      </Suspense>

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
