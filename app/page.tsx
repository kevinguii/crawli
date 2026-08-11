import { createClient } from '@/lib/supabase/server';
import { getAllCompareItems, getCompareTeasers, getCompareHeroData } from '@/lib/compare';
import { getPriceGuideSlugMap } from '@/lib/blog';
import LandingNav from '@/app/components/landing/LandingNav';
import Hero from '@/app/components/landing/Hero';
import CompareSection from '@/app/components/landing/CompareSection';
import PlatformLogos from '@/app/components/landing/PlatformLogos';
import SoldCompsSection from '@/app/components/landing/SoldCompsSection';
import AlertsAndTrackedSection from '@/app/components/landing/AlertsAndTrackedSection';
import MarginSection from '@/app/components/landing/MarginSection';
import BentoFeatures from '@/app/components/landing/BentoFeatures';
import AboutSection from '@/app/components/landing/AboutSection';
import FounderNote from '@/app/components/landing/FounderNote';
import CTASection from '@/app/components/landing/CTASection';
import FAQ from '@/app/components/landing/FAQ';
import Footer from '@/app/components/landing/Footer';
import StructuredData from '@/app/components/StructuredData';
import Reveal from '@/app/components/landing/Reveal';

// Curated for the hero's rotating comparison widget: category diversity + a
// visible cross-platform price spread, verified live against compare_snapshots
// on 2026-07-08. Keep this list in sync with docs/superpowers/plans/2026-07-08-landing-page-priority-redesign.md
// if items are swapped in/out later.
//
// Weighted toward luxury as of 2026-07-25: every top AI grounding query Bing
// reports for this domain is luxury resale ("compare luxury resale prices
// including fees", "best marketplaces to resell luxury handbags"), and none are
// streetwear. Two streetwear items stay for category spread. All five verified
// at 8/8 platforms before being added.
const HERO_COMPARE_SLUGS = [
  'chanel-classic-flap',
  'hermes-birkin',
  'louis-vuitton-neverfull',
  'jordan-1-retro-high',
  'nike-dunk-low',
];

export default async function LandingPage() {
  const supabase = await createClient();
  const [{ data, error }, items, teasers, heroItems] = await Promise.all([
    supabase.auth.getUser(),
    getAllCompareItems(),
    getCompareTeasers(),
    getCompareHeroData(HERO_COMPARE_SLUGS),
  ]);
  const isAuthenticated = !error && !!data.user;
  const priceGuideSlugs = getPriceGuideSlugMap();

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <StructuredData />
      <LandingNav isAuthenticated={isAuthenticated} />
      <Hero heroItems={heroItems} />
      <Reveal><PlatformLogos /></Reveal>
      <Reveal><CompareSection items={items} teasers={teasers} priceGuideSlugs={priceGuideSlugs} /></Reveal>
      <Reveal><SoldCompsSection /></Reveal>
      <Reveal><AlertsAndTrackedSection /></Reveal>
      <Reveal><MarginSection /></Reveal>
      <Reveal><BentoFeatures /></Reveal>
      <Reveal><AboutSection /></Reveal>
      <Reveal><FounderNote /></Reveal>
      <Reveal><CTASection /></Reveal>
      <Reveal><FAQ /></Reveal>
      <Footer />
    </main>
  );
}
