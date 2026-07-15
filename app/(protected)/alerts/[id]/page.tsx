import AlertMatchesPage from '@/app/components/alerts/AlertMatchesPage';

export default async function AlertMatchesRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AlertMatchesPage alertId={id} />;
}
