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

interface GuestInfo {
  name: string;
  email: string;
  phone: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Phone validation regex (allows various formats)
const PHONE_REGEX = /^[\d\s\-+()]{7,20}$/;

function validateEmail(email: string): string | undefined {
  if (!email.trim()) {
    return 'Email is required';
  }
  if (!EMAIL_REGEX.test(email.trim())) {
    return 'Please enter a valid email address';
  }
  return undefined;
}

function validateName(name: string): string | undefined {
  if (!name.trim()) {
    return 'Name is required';
  }
  if (name.trim().length < 2) {
    return 'Name must be at least 2 characters';
  }
  return undefined;
}

function validatePhone(phone: string): string | undefined {
  // Phone is optional, but if provided, must be valid
  if (phone.trim() && !PHONE_REGEX.test(phone.trim())) {
    return 'Please enter a valid phone number';
  }
  return undefined;
}

export default function BuyPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cartData, setCartData] = useState<CartData | null>(null);
  
  // Guest checkout form state
  const [guestInfo, setGuestInfo] = useState<GuestInfo>({
    name: '',
    email: '',
    phone: '',
  });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load cart data from localStorage
    const saved = localStorage.getItem('cartData');
    if (saved) {
      setCartData(JSON.parse(saved));
    }
  }, []);

  // Validate form on input change
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    
    const nameError = validateName(guestInfo.name);
    if (nameError) errors.name = nameError;
    
    const emailError = validateEmail(guestInfo.email);
    if (emailError) errors.email = emailError;
    
    const phoneError = validatePhone(guestInfo.phone);
    if (phoneError) errors.phone = phoneError;
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof GuestInfo) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setGuestInfo(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleBlur = (field: keyof GuestInfo) => () => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate field on blur
    let error: string | undefined;
    if (field === 'name') error = validateName(guestInfo.name);
    if (field === 'email') error = validateEmail(guestInfo.email);
    if (field === 'phone') error = validatePhone(guestInfo.phone);
    
    setFormErrors(prev => ({ ...prev, [field]: error }));
  };

  // Format email to lowercase and trim
  const formatEmail = (email: string): string => {
    return email.trim().toLowerCase();
  };

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
    // Validate guest form first
    if (!validateForm()) {
      setError('Please fill in all required fields correctly');
      return;
    }

    setIsLoading(true);
    setError(null);

    const formattedEmail = formatEmail(guestInfo.email);

    try {
      // Require an email for both payment flows
      if (!formattedEmail || !formattedEmail.includes('@')) {
        setError('Please enter a valid email address');
        setIsLoading(false);
        return;
      }

      // If paying at check-in, skip Stripe and go directly to success page
      if (cartData?.paymentOption === 'pay-on-day') {
        // Store guest info and send confirmation email
        localStorage.setItem('guestCheckoutInfo', JSON.stringify({
          name: guestInfo.name.trim(),
          email: formattedEmail,
          phone: guestInfo.phone.trim(),
        }));

        const checkInResponse = await fetch('/api/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formattedEmail,
            eventTitle: ticketDetails.eventName,
            eventDate: ticketDetails.eventDate,
            amount: ticketDetails.totalPrice,
          }),
        });

        const checkInData = await checkInResponse.json();
        if (!checkInResponse.ok || checkInData.error) {
          throw new Error(checkInData.error || 'Failed to send confirmation email');
        }

        localStorage.removeItem('cartData');
        window.location.href = `/success?payment=check-in&email=${encodeURIComponent(formattedEmail)}&guest=true&order_id=${encodeURIComponent(checkInData.orderId || '')}`;
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
          // Guest checkout info
          isGuest: true,
          guestName: guestInfo.name.trim(),
          guestEmail: formattedEmail,
          guestPhone: guestInfo.phone.trim() || undefined,
          customerEmail: formattedEmail,
        }),
      });

      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        // Store guest info for success page
        localStorage.setItem('guestCheckoutInfo', JSON.stringify({
          name: guestInfo.name.trim(),
          email: formattedEmail,
          phone: guestInfo.phone.trim(),
        }));
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

          {/* Guest Checkout Form */}
          <div className="mb-6 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Guest Checkout
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              No account needed! Just provide your details below to complete your purchase.
            </p>
            
            {/* Name Field */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={guestInfo.name}
                onChange={handleInputChange('name')}
                onBlur={handleBlur('name')}
                placeholder="John Doe"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  touched.name && formErrors.name ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                required
              />
              {touched.name && formErrors.name && (
                <p className="text-red-600 text-xs mt-1">{formErrors.name}</p>
              )}
            </div>
            
            {/* Email Field */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={guestInfo.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                placeholder="your@email.com"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  touched.email && formErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
                required
              />
              {touched.email && formErrors.email && (
                <p className="text-red-600 text-xs mt-1">{formErrors.email}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                We'll send your ticket confirmation to this email.
              </p>
            </div>
            
            {/* Phone Field (Optional) */}
            <div className="mb-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Phone Number <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="tel"
                value={guestInfo.phone}
                onChange={handleInputChange('phone')}
                onBlur={handleBlur('phone')}
                placeholder="+1 (555) 123-4567"
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  touched.phone && formErrors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300'
                }`}
              />
              {touched.phone && formErrors.phone && (
                <p className="text-red-600 text-xs mt-1">{formErrors.phone}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                For event updates and check-in assistance.
              </p>
            </div>
          </div>

          {/* Pay at Check-in Notice */}
          {cartData?.paymentOption === 'pay-on-day' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">
                💳 Pay at Check-in Selected
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                You'll receive a confirmation email with your ticket. Payment will be collected when you arrive at the event.
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
