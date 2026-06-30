// Single source of truth for the landing FAQ. Consumed by both the visible
// FAQ section (FAQ.tsx) and the FAQPage JSON-LD (StructuredData.tsx) so the
// rendered Q&A and the structured data can never drift.
//
// Answers are entity- and stat-dense with attribution: AI answer engines
// preferentially cite content backed by hard, sourced data.

export type FaqItem = {
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Crawli and who is it for?",
    answer:
      "Crawli is a sourcing intelligence tool built for professional resellers. Instead of checking 9 platforms one by one, you run a single search and Crawli pulls matching listings from Grailed, Depop, Poshmark, StockX, Mercari, Vinted, ThredUp, Vestiaire Collective, and eBay side by side. The flip margin calculator then shows your net profit after real platform fees before you buy. Crawli is built for resellers who source secondhand inventory to flip at a margin, not for casual shoppers.",
  },
  {
    question: "How does the flip margin calculator work?",
    answer:
      "After running a search, expand the flip margin panel in the price summary. Enter your sourcing price and choose the platform you plan to sell on. Crawli calculates your net profit, margin percentage, and ROI using real seller-side fee schedules, not buyer fees or estimates. All 7 platform rates are maintained in a single source of truth and were last verified on 2026-06-28 against official vendor fee pages and fee trackers. As a verified example: sourcing at $40 and selling on eBay at $100 returns $46.35 net profit (46% margin, 116% ROI) after eBay's 13.25% final value fee plus $0.40 per-order fee.",
  },
  {
    question: "How do sourcing alerts work?",
    answer:
      "Save any search to create a sourcing alert. You can set precise criteria: brand, size, and a maximum price. Crawli rechecks the search daily across all platforms and notifies you by email only when a new listing appears that matches all your terms. Alerts use AND logic throughout: a listing must match brand AND size AND max-price to trigger a notification. The first run establishes your baseline; every run after that notifies you only on net-new matching inventory. eBay is excluded from alerts by default due to listing volatility.",
  },
  {
    question: "Which platforms does Crawli search and how accurate are the fee rates?",
    answer:
      "Crawli currently searches 9 platforms: Grailed, Depop, Poshmark, Mercari, Vinted, ThredUp, Vestiaire Collective, StockX, and eBay. Each platform's seller-side fee schedule is stored in a single source of truth in the codebase and verified against official vendor help pages. Buyer-side fees (such as Depop's up-to-5% buyer protection or Mercari's 3.6% buyer protection) are tracked separately and excluded from your net profit calculation, since the buyer pays those. The last verification date is shown on every margin calculation so you always know how current the numbers are.",
  },
  {
    question: "What happens when I run out of included searches?",
    answer:
      "Once you have used all the searches included in your plan for the week, you can continue sourcing by purchasing prepaid search credits. Credits are bought up front as a one-time payment, so there is no surprise billing, no debt, and no open-ended charges. One credit equals one search. Your weekly included searches and your credit balance are tracked separately: included searches reset each week, while credits roll over until you use them. The credits checkout returns a clear status if the feature is not yet active on your account.",
  },
  {
    question: "Is Crawli free to use?",
    answer:
      "Yes. Crawli is free to start with 5 searches per week and 2 sourcing alerts. No credit card required. Paid plans add more weekly searches, more simultaneous alerts with precise criteria, and higher result counts per platform. The flip margin calculator is available on all plans including free.",
  },
];
