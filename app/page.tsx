import { createClient } from '@/lib/supabase/server';
import { getAllCompareItems, getCompareTeasers } from '@/lib/compare';
import LandingNav from '@/app/components/landing/LandingNav';
import Hero from '@/app/components/landing/Hero';
import CompareSection from '@/app/components/landing/CompareSection';
import PlatformLogos from '@/app/components/landing/PlatformLogos';
import BentoFeatures from '@/app/components/landing/BentoFeatures';
import AlertsMock from '@/app/components/landing/AlertsMock';
import SavesMock from '@/app/components/landing/SavesMock';
import AboutSection from '@/app/components/landing/AboutSection';
import FounderNote from '@/app/components/landing/FounderNote';
import CTASection from '@/app/components/landing/CTASection';
import FAQ from '@/app/components/landing/FAQ';
import Footer from '@/app/components/landing/Footer';
import StructuredData from '@/app/components/StructuredData';
import Reveal from '@/app/components/landing/Reveal';

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data, error }, items, teasers] = await Promise.all([
    supabase.auth.getUser(),
    getAllCompareItems(),
    getCompareTeasers(),
  ]);
  const isAuthenticated = !error && !!data.user;

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <StructuredData />
      <LandingNav isAuthenticated={isAuthenticated} />
      <Hero />
      <Reveal><CompareSection items={items} teasers={teasers} /></Reveal>
      <Reveal><PlatformLogos /></Reveal>
      <Reveal><BentoFeatures /></Reveal>
      <Reveal><AlertsMock /></Reveal>
      <Reveal><SavesMock /></Reveal>
      <Reveal><AboutSection /></Reveal>
      <Reveal><FounderNote /></Reveal>
      <Reveal><CTASection /></Reveal>
      <Reveal><FAQ /></Reveal>
      <Footer />
    </main>
  );
}
