import { createClient } from '@/lib/supabase/server';
import LandingNav from '@/app/components/landing/LandingNav';
import Footer from '@/app/components/landing/Footer';

export default async function CompareLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const isAuthenticated = !error && !!data.user;

  return (
    <>
      <LandingNav isAuthenticated={isAuthenticated} />
      <main>{children}</main>
      <Footer />
    </>
  );
}
