import { createClient } from '@/lib/supabase/server';
import LandingNav from '@/app/components/landing/LandingNav';
import Hero from '@/app/components/landing/Hero';
import SearchMock from '@/app/components/landing/SearchMock';
import PlatformLogos from '@/app/components/landing/PlatformLogos';
import BentoFeatures from '@/app/components/landing/BentoFeatures';
import CompareSection from '@/app/components/landing/CompareSection';
import AlertsMock from '@/app/components/landing/AlertsMock';
import AboutSection from '@/app/components/landing/AboutSection';
import SavesMock from '@/app/components/landing/SavesMock';
import FounderNote from '@/app/components/landing/FounderNote';
import CTASection from '@/app/components/landing/CTASection';
import FAQ from '@/app/components/landing/FAQ';
import Footer from '@/app/components/landing/Footer';
import StructuredData from '@/app/components/StructuredData';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const isAuthenticated = !error && !!data.user;

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <StructuredData />
      <LandingNav isAuthenticated={isAuthenticated} />
      <Hero />
      <SearchMock />
      <PlatformLogos />
      <BentoFeatures />
      <CompareSection />
      <AlertsMock />
      <AboutSection />
      <SavesMock />
      <FounderNote />
      <CTASection />
      <FAQ />
      <Footer />
    </main>
  );
}
