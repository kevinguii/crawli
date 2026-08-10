import { Suspense } from 'react';
import AlertsTabsClient from '@/app/components/alerts/AlertsTabsClient';

type Params = { tab?: string; new?: string; query?: string; platforms?: string };

export default function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
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
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;

  // `?new=1&query=…&platforms=…` comes from the results-page alert CTA
  // (app/components/AlertCtaBanner.tsx). It opens the create form pre-filled
  // rather than dropping the user on an empty alerts list.
  const autoCreate = params.new === '1'
    ? {
        query: params.query ?? '',
        platforms: (params.platforms ?? '')
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      }
    : null;

  return (
    <AlertsTabsClient
      // A create request always concerns search alerts, never tracked listings.
      initialTab={autoCreate ? 'search' : params.tab === 'tracked' ? 'tracked' : 'search'}
      autoCreate={autoCreate}
    />
  );
}
