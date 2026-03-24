import Image from 'next/image'
import Link from 'next/link'

type TicketType = {
  name: string
  price: number
}

type Props = {
  slug: string
  title: string
  description: string
  date: string
  startTime?: string
  endTime?: string
  sportCategory?: string
  image?: string
  location?: string
  distance?: string
  rating?: number
  ticketTypes?: TicketType[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(d: string) {
  try {
    const date = new Date(d)
    const month = MONTHS[date.getMonth()]
    const day = date.getDate()
    return `${month} ${day}`
  } catch {
    return d
  }
}

export default function EventCard({ slug, title, description, date, startTime, endTime, sportCategory, image, location, distance, rating, ticketTypes }: Props) {
  const formatted = formatDate(date)
  const minPrice = ticketTypes && ticketTypes.length > 0 
    ? Math.min(...ticketTypes.map(t => t.price)) 
    : null

  return (
    <Link
      href={`/eventDetails?slug=${encodeURIComponent(slug)}`}
      className="block h-full group"
      aria-label={`View details for ${title}`}
    >
      <article className="bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col h-full">
        {/* Image Section */}
        {image && (
          <div className="w-full h-52 relative overflow-hidden bg-slate-100">
            <Image 
              src={image} 
              alt={title} 
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500" 
              priority={false}
              unoptimized
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute top-3 right-3 bg-white rounded-lg px-2.5 py-1 shadow-sm">
              <span className="text-xs font-semibold text-slate-700">{formatted}</span>
            </div>
            {sportCategory && (
              <div className="absolute top-3 left-3 bg-indigo-500 rounded-lg px-2.5 py-1">
                <span className="text-xs font-semibold text-white">{sportCategory}</span>
              </div>
            )}
            {minPrice !== null && (
              <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-sm rounded-lg px-2.5 py-1 shadow-sm">
                <span className="text-sm font-bold text-slate-900">From &euro;{minPrice}</span>
              </div>
            )}
          </div>
        )}

        {/* Content Section */}
        <div className="p-5 flex flex-col justify-between flex-1">
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
              {title}
            </h3>
            <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{description}</p>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            {/* Time */}
            {startTime && endTime && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{startTime} – {endTime}</span>
              </div>
            )}
            
            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">
                {location ?? 'Location TBA'}{distance ? ` · ${distance}` : ''}
              </span>
            </div>
            
            {/* Rating */}
            {rating !== undefined && rating > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`w-3.5 h-3.5 ${
                        star <= Math.floor(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'
                      }`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs font-medium text-slate-600">{rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </article>
    </Link>
  )
}
