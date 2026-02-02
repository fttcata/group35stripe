export default function HowItWorks() {
  const steps = [
    {
      title: 'Browse',
      desc: 'Find events by category, date, and location.',
      icon: (
        <svg className="h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
        </svg>
      ),
    },
    {
      title: 'Book',
      desc: 'Secure your spot in a few clicks with a clear checkout.',
      icon: (
        <svg className="h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8 7h8" />
        </svg>
      ),
    },
    {
      title: 'Attend',
      desc: 'Show up, learn, network, and enjoy the experience.',
      icon: (
        <svg className="h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 7H9l3-7z" />
          <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M5 22h14" />
        </svg>
      ),
    },
  ]

  return (
    <section id="how-it-works" className="py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold mb-4">How it works</h2>
        <p className="text-sm text-gray-600 mb-6">Simple steps to go from discovery to participation.</p>

        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.title} className="rounded-lg border bg-white p-6 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
                {s.icon}
              </div>
              <h3 className="text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
