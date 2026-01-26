import Image from 'next/image'

type Props = {
  title: string
  description: string
  date: string
  image: string
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
    <article className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col md:flex-row">
      <div className="md:w-48 w-full h-48 md:h-auto relative flex-shrink-0">
        <Image src={image} alt={title} fill className="object-cover" />
      </div>

      <div className="p-4 flex flex-col justify-between flex-1">
        <div>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold mb-1">{title}</h3>
            <span className="text-xs text-gray-500">{formatted}</span>
          </div>
          <p className="text-sm text-gray-600">{description}</p>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <div className="truncate">
            {location ?? 'Location unknown'}{distance ? ` • ${distance}` : ''}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-yellow-500">{rating && rating > 0 ? '★' : '☆'}</div>
            <div className="text-xs text-gray-600">{rating && rating > 0 ? rating.toFixed(1) : '—'}</div>
          </div>
        </div>
      </div>
    </article>
  )
}
