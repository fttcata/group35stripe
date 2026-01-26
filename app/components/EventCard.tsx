import Image from 'next/image'

type Props = {
  title: string
  description: string
  date: string
  image?: string
  location?: string
  distance?: string
  rating?: number
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export default function EventCard({ title, description, date, image, location, distance, rating }: Props) {
  const formatted = formatDate(date)

  return (
    <article className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 hover:border-purple-200 hover:-translate-y-1 flex flex-col h-full">
      {/* Image Section */}
      {image && (
        <div className="w-full h-56 relative overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100">
          <Image 
            src={image} 
            alt={title} 
            fill 
            className="object-cover group-hover:scale-105 transition-transform duration-300" 
          />
          <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1 shadow-md">
            <span className="text-xs font-semibold text-purple-700">{formatted}</span>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className="p-6 flex flex-col justify-between flex-1">
        <div className="space-y-3">
          <h3 className="text-xl font-bold text-gray-900 group-hover:text-purple-700 transition-colors line-clamp-2">
            {title}
          </h3>
          <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{description}</p>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {/* Location */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">
              {location ?? 'Location TBA'}{distance ? ` • ${distance}` : ''}
            </span>
          </div>
          
          {/* Rating */}
          {rating !== undefined && rating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.floor(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                    }`}
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">{rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
