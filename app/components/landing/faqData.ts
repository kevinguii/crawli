// Single source of truth for the landing FAQ. Consumed by both the visible
// FAQ section (FAQ.tsx) and the FAQPage JSON-LD (StructuredData.tsx) so the
// rendered Q&A and the structured data can never drift — Google requires the
// FAQPage markup to match the on-page content.
//
// Answers are intentionally entity- and stat-dense (with attribution): AI
// answer engines preferentially cite content backed by hard data.

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Crawli?",
    answer:
      "Crawli is a resale price search engine for secondhand fashion. Instead of checking eight marketplaces one by one, you run a single search and Crawli pulls matching listings from Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay and Vestiaire side by side, ranked by price.",
  },
  {
    question: "How does Crawli compare resale prices across platforms?",
    answer:
      "You type what you're looking for once. Crawli searches every supported marketplace at the same time, normalizes sizes and conditions, and shows the low, average and high price across all results so you can see whether a listing is actually a good deal before you click through to buy.",
  },
  {
    question: "Which resale marketplaces does Crawli search?",
    answer:
      "Crawli currently searches eight platforms: Grailed, Depop, Poshmark, StockX, Mercari, Vinted, eBay and Vestiaire Collective, covering streetwear, sneakers, designer, vintage and everyday secondhand fashion.",
  },
  {
    question: "Is Crawli free to use?",
    answer:
      "Yes. Crawli is free to start with no credit card required. Paid plans add more searches per week, daily search alerts and higher result limits, but the core cross-platform price comparison is free.",
  },
  {
    question: "Is buying secondhand fashion worth it?",
    answer:
      "Increasingly, yes. The U.S. secondhand apparel market grew about 14% in 2024 (its strongest growth since 2021), and 58% of U.S. consumers shopped secondhand that year, according to ThredUp's 2025 Resale Report. Buying preloved is cheaper and more sustainable, and Crawli makes it easier by surfacing the lowest price across every major resale platform at once.",
  },
  {
    question: "Can Crawli alert me when a new listing appears?",
    answer:
      "Yes. Save any search to set up daily alerts. You choose which platforms to monitor from any combination of the eight, and Crawli notifies you when a new matching listing appears. This is useful for tracking a specific grail, size, or price drop.",
  },
];
