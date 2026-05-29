import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingNav from '@/app/components/landing/LandingNav';
import Hero from '@/app/components/landing/Hero';
import SearchMock from '@/app/components/landing/SearchMock';
import PlatformLogos from '@/app/components/landing/PlatformLogos';
import HowItWorks from '@/app/components/landing/HowItWorks';
import BentoFeatures from '@/app/components/landing/BentoFeatures';
import AlertsMock from '@/app/components/landing/AlertsMock';
import SavesMock from '@/app/components/landing/SavesMock';
import AboutSection from '@/app/components/landing/AboutSection';
import FAQ from '@/app/components/landing/FAQ';
import CTASection from '@/app/components/landing/CTASection';
import Footer from '@/app/components/landing/Footer';
import StructuredData from '@/app/components/StructuredData';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) {
    redirect('/search');
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <StructuredData />
      <LandingNav />
      <Hero />
      <SearchMock />
      <PlatformLogos />
      <HowItWorks />
      <BentoFeatures />
      <AlertsMock />
      <SavesMock />
      <AboutSection />
      <FAQ />
      <CTASection />
      <Footer />
    </main>
  );
}
