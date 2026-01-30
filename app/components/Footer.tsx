import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="mt-12 border-t bg-transparent border-gray-200/70">
      <div className="max-w-4xl mx-auto px-4 py-8 text-sm text-gray-600">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Image src="/eventify-logo.png" alt="Eventify" width={96} height={32} className="object-contain" />
            <span className="text-xs text-gray-500">— Discover local events</span>
          </div>

          <nav className="flex gap-4">
            <Link href="#" className="hover:underline">About</Link>
            <Link href="#" className="hover:underline">Contact</Link>
            <Link href="#" className="hover:underline">Terms</Link>
          </nav>
        </div>

        <div className="mt-6 text-xs text-gray-500">© {new Date().getFullYear()} Eventify. All rights reserved.</div>
      </div>
    </footer>
  )
}
