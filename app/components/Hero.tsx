import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-slate-900 text-white">
      {/* Subtle gradient overlay */}
      <div aria-hidden className="absolute inset-0 bg-linear-to-br from-indigo-600/20 via-transparent to-amber-500/10" />
      <div aria-hidden className="absolute top-0 left-1/2 -translate-x-1/2 w-200 h-150 bg-indigo-500/10 rounded-full blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-indigo-400 font-semibold text-sm tracking-wide uppercase mb-4">Irish sporting events</p>
          <h1 className="text-4xl font-extrabold sm:text-5xl lg:text-6xl leading-tight tracking-tight">
            Find your next
            <span className="block text-indigo-400">sporting event</span>
          </h1>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-lg">
            Discover GAA matches, parkruns, charity 5Ks, and more across Ireland. Book your tickets in seconds.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-500 hover:bg-indigo-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-400/30"
            >
              Browse Events
              <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>

            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center rounded-lg border border-slate-600 px-5 py-3 text-sm font-medium text-slate-300 hover:text-white hover:border-slate-500 hover:bg-white/5 transition-all"
            >
              How it works
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
