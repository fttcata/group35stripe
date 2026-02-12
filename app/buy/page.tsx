'use client';

import Link from "next/link";
import { useState, useEffect } from "react";

interface CartData {
  event: { id: string; title: string; date: string };
  quantities: Record<string, number>;
  paymentOption: string;
  totalPrice: number;
  totalTickets: number;
}

export default function BuyPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartData, setCartData] = useState<CartData | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Load cart data from localStorage
    const saved = localStorage.getItem('cartData');
    if (saved) {
      setCartData(JSON.parse(saved));
    }
  }, []);

  // Ticket details - from cart or defaults
  const ticketDetails = cartData ? {
    eventName: cartData.event.title,
    eventDate: cartData.event.date,
    eventId: cartData.event.id,
    totalPrice: cartData.totalPrice,
    quantity: cartData.totalTickets,
  } : {
    eventName: 'Event',
    eventDate: 'TBD',
    eventId: 'unknown',
    totalPrice: 10.00,
    quantity: 1,
  };

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // If paying at check-in, skip Stripe and go directly to success page
      if (cartData?.paymentOption === 'pay-on-day') {
        // Validate email for check-in payment
        if (!email || !email.includes('@')) {
          setError('Please enter a valid email address');
          setIsLoading(false);
          return;
        }
        
        // Store email and redirect to success page
        localStorage.setItem('checkInEmail', email);
        localStorage.removeItem('cartData');
        window.location.href = `/success?payment=check-in&email=${encodeURIComponent(email)}`;
        return;
      }

      // Otherwise, proceed with Stripe checkout for pay-now
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventName: ticketDetails.eventName,
          eventDate: ticketDetails.eventDate,
          eventId: ticketDetails.eventId,
          totalPrice: Math.round(ticketDetails.totalPrice * 100), // Convert to cents
          quantity: ticketDetails.quantity,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        // Redirect to Stripe hosted checkout page
        window.location.assign(data.url);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 antialiased">
      <main className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-8">Purchase Ticket</h1>
          
          {/* Ticket Details Card */}
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50 mb-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Event:</span>
                <span className="font-semibold">{ticketDetails.eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-medium">Date:</span>
                <span className="font-semibold">{ticketDetails.eventDate}</span>
              </div>
              <div className="border-t pt-4 flex justify-between">
                <span className="text-gray-600 font-medium">Total:</span>
                <span className="font-semibold">${ticketDetails.totalPrice.toFixed(2)}</span>
              </div>
              <div className="border-t pt-4 flex justify-between text-lg font-bold">
                <span>Grand Total:</span>
                <span className="text-blue-600">${ticketDetails.totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg">
              <p className="text-red-800 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Email Input for Check-in Payment */}
          {cartData?.paymentOption === 'pay-on-day' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-600 mt-2">
                We&apos;ll send your confirmation and receipt to this email. Bring it to check-in.
              </p>
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg mb-4 transition"
          >
            {isLoading ? 'Processing...' : cartData?.paymentOption === 'pay-on-day' ? 'Complete Registration (Pay at Check-in)' : `Confirm & Pay $${ticketDetails.totalPrice.toFixed(2)}`}
          </button>

          {/* Back Link */}
          <Link href="/" className="block text-center text-blue-600 hover:underline text-sm">
            Go back home
          </Link>
        </div>
      </main>
    </div>
  );
}
