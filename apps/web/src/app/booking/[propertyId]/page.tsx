import { notFound } from 'next/navigation'
import BookingChat from '@/components/BookingChat'

async function fetchProperty(id: string) {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const res = await fetch(`${base}/api/properties/${id}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  return res.json()
}

export default async function BookingPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params
  const property = await fetchProperty(propertyId)

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[rgba(224,164,88,0.06)] to-white">
      <BookingChat property={property} />
    </div>
  )
}

