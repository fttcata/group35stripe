import type { Metadata } from "next"

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "Submit Event - Ticket Store",
  description: "Submit your event to the community event listing",
}

export default function SubmitEventLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
