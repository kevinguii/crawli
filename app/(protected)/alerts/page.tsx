import { Suspense } from 'react';
import AlertsTabsClient from '@/app/components/alerts/AlertsTabsClient';

export default function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense>
      <AlertsTabsClientWrapper searchParams={searchParams} />
    </Suspense>
  );
}

async function AlertsTabsClientWrapper({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return <AlertsTabsClient initialTab={tab === 'search' ? 'search' : 'tracked'} />;
}
