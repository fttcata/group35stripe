'use client';

import Image from "next/image";
import Link from "next/link";

export default function BuyPage() {
  const handleCheckout = async () => {
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
      });
      const { url, error: apiError } = await response.json();
      
      if (apiError) {
        throw new Error(apiError);
      }

      if (url) {
        window.location.assign(url);
      }
    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <Image
          className="dark:invert mb-8"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Purchase Ticket
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            This is the dedicated checkout page. Click below to proceed to payment for your $10 ticket.
          </p>
          <button
            onClick={handleCheckout}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-8 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-auto"
          >
            Confirm & Pay $10
          </button>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            Go back home
          </Link>
        </div>
      </main>
    </div>
  );
}
