// Route: /detailed-summary?date=YYYY-MM-DD
// Thin server component — reads the date from the URL and passes it to the client view.
// searchParams is a Promise in Next.js 15+ and must be awaited.

import DetailedSummaryView from '@/components/DetailedSummaryView';

export default async function DetailedSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <DetailedSummaryView initialDate={date ?? ''} />;
}
