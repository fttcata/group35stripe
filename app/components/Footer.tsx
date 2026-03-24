import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/eventify-logo.png" alt="Eventify" width={24} height={24} className="object-contain rounded" />
            <span className="text-sm font-semibold text-slate-900">Eventify</span>
            <span className="text-xs text-slate-400">— Discover local events</span>
          </div>

          <nav className="flex gap-6 text-sm text-slate-500">
            <Link href="/events" className="hover:text-slate-900 transition-colors">Events</Link>
            <Link href="#" className="hover:text-slate-900 transition-colors">About</Link>
            <Link href="#" className="hover:text-slate-900 transition-colors">Contact</Link>
            <Link href="#" className="hover:text-slate-900 transition-colors">Terms</Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Eventify. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
