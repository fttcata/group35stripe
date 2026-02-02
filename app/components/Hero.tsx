import Link from 'next/link'
import Image from 'next/image'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white">
      <div className="max-w-4xl mx-auto px-4 py-16 sm:py-24">
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <Image src="/eventify-logo.png" alt="Eventify" width={96} height={96} className="rounded-md bg-white/5 object-contain" />
          </div>

          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold sm:text-4xl lg:text-5xl">Discover events that spark curiosity</h1>
            <p className="mt-4 text-lg opacity-90">Browse local meetups, workshops, and talks—book seamlessly and join the community.</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/events"
                className="inline-flex items-center justify-center rounded-md bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow hover:opacity-95"
              >
                Browse Events
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-md border border-white/30 px-4 py-2 text-sm text-white/95 hover:bg-white/10"
              >
                How it works
              </a>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-black/10 to-transparent mix-blend-overlay" />
    </section>
  )
}
