'use client';

import Link from "next/link";
import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface CartData {
  event: { id: string; title: string; date: string };
  quantities: Record<string, number>;
  ticketBreakdown?: Array<{ ticketTypeId: string | null; ticketTypeName: string; quantity: number; unitPrice: number }>;
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
  const [isOrganizerUser, setIsOrganizerUser] = useState(false);
  
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

  useEffect(() => {
    const loadRole = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsOrganizerUser(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const role = String(profile?.role || user.user_metadata?.role || '').toLowerCase();
        setIsOrganizerUser(role === 'organizer' || role === 'organiser');
      } catch {
        setIsOrganizerUser(false);
      }
    };

    loadRole();
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
  const normalizedEventId = (() => {
    const raw = cartData?.event?.id || ''
    const directUuid = raw.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    if (directUuid) return raw

    const embeddedUuid = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    return embeddedUuid ? embeddedUuid[0] : 'unknown'
  })()

  const ticketDetails = cartData ? {
    eventName: cartData.event.title,
    eventDate: cartData.event.date,
    eventId: normalizedEventId,
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
    if (isOrganizerUser) {
      setError('Organizers cannot buy tickets. Use an attendee account to purchase tickets.');
      return;
    }

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
            eventId: ticketDetails.eventId,
            quantity: ticketDetails.quantity,
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
          ticketBreakdown: cartData?.ticketBreakdown ? JSON.stringify(cartData.ticketBreakdown) : undefined,
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
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-6">Purchase Ticket</h1>
          
          {/* Ticket Details Card */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-5 mb-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Event</span>
                <span className="font-medium text-slate-900 text-sm">{ticketDetails.eventName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-sm">Date</span>
                <span className="font-medium text-slate-900 text-sm">{ticketDetails.eventDate}</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between">
                <span className="text-slate-500 text-sm">Quantity</span>
                <span className="font-medium text-slate-900 text-sm">{ticketDetails.quantity}</span>
              </div>
              <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="font-bold text-lg text-indigo-600">€{ticketDetails.totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Guest Checkout Form */}
          <div className="mb-6 p-5 bg-slate-50 border border-slate-200 rounded-lg">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">
              Your Details
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              No account needed — just provide your details to complete the purchase.
            </p>
            
            {/* Name Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={guestInfo.name}
                onChange={handleInputChange('name')}
                onBlur={handleBlur('name')}
                placeholder="John Doe"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                  touched.name && formErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
                required
              />
              {touched.name && formErrors.name && (
                <p className="text-red-600 text-xs mt-1">{formErrors.name}</p>
              )}
            </div>
            
            {/* Email Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={guestInfo.email}
                onChange={handleInputChange('email')}
                onBlur={handleBlur('email')}
                placeholder="you@example.com"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                  touched.email && formErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
                required
              />
              {touched.email && formErrors.email && (
                <p className="text-red-600 text-xs mt-1">{formErrors.email}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                We&apos;ll send your ticket confirmation here.
              </p>
            </div>
            
            {/* Phone Field (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={guestInfo.phone}
                onChange={handleInputChange('phone')}
                onBlur={handleBlur('phone')}
                placeholder="+353 1 234 5678"
                className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
                  touched.phone && formErrors.phone ? 'border-red-300 bg-red-50' : 'border-slate-200'
                }`}
              />
              {touched.phone && formErrors.phone && (
                <p className="text-red-600 text-xs mt-1">{formErrors.phone}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                For event updates and check-in assistance.
              </p>
            </div>
          </div>

          {/* Pay at Check-in Notice */}
          {cartData?.paymentOption === 'pay-on-day' && (
            <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm text-amber-800 font-medium">
                Pay at Check-in Selected
              </p>
              <p className="text-xs text-amber-700 mt-1">
                You&apos;ll receive a confirmation email with your ticket. Payment will be collected when you arrive at the event.
              </p>
            </div>
          )}

          {isOrganizerUser && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <p className="text-sm text-amber-900 font-semibold">
                Organizer accounts cannot purchase tickets.
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Organizers can only create and manage events. Please use an attendee account for ticket purchases.
              </p>
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={isLoading || isOrganizerUser}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg mb-4 transition-colors"
          >
            {isLoading ? 'Processing...' : cartData?.paymentOption === 'pay-on-day' ? 'Complete Registration (Pay at Check-in)' : `Confirm & Pay €${ticketDetails.totalPrice.toFixed(2)}`}
          </button>

          {/* Back Link */}
          <Link href="/" className="block text-center text-indigo-500 hover:text-indigo-600 text-sm transition-colors">
            Go back home
          </Link>
        </div>
      </main>
    </div>
  );
}
