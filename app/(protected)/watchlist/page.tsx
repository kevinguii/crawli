import { redirect } from 'next/navigation';

export default function WatchlistPage() {
  redirect('/alerts?tab=tracked');
}
