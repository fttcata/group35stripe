'use client';

import { Suspense } from 'react';
import Hero from './components/Hero'
import FeaturedEvents from './components/FeaturedEvents'
import HowItWorks from './components/HowItWorks'
import Footer from './components/Footer'
import PaymentNotifications from './components/PaymentNotifications';

export default function Home() {
  return (
    <div className="min-h-screen bg-white antialiased">
      {/* Payment Status Notifications */}
      <Suspense fallback={null}>
        <PaymentNotifications />
      </Suspense>

      <Hero />

      <main>
        <FeaturedEvents />
        <HowItWorks />

        {/* CTA Section */}
        <section className="py-16 sm:py-20 bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-3xl font-bold">Ready to discover your next event?</h2>
            <p className="mt-3 text-slate-400 max-w-md mx-auto">Sign up for free and never miss out on what&apos;s happening near you.</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/register" className="inline-flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-400 px-6 py-3 text-sm font-semibold text-white transition-colors">
                Get started free
              </a>
              <a href="/events" className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-6 py-3 text-sm font-medium text-slate-300 hover:text-white hover:border-slate-500 transition-colors">
                Browse events
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
