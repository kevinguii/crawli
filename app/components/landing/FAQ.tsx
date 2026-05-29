import { FAQ_ITEMS } from "./faqData";

// Server-rendered FAQ. Uses native <details> so the full Q&A is in the HTML
// (no client JS) — important for both classic SEO and AI answer engines, which
// read the server HTML directly. Paired with FAQPage JSON-LD in StructuredData.
export default function FAQ() {
  return (
    <>
      <style>{`
        details {
          overflow: hidden;
        }
        details[open] > summary {
          margin-bottom: 0;
        }
        details > summary + p {
          animation: slideDown 300ms ease-out forwards;
          transform-origin: top;
        }
        details:not([open]) > summary + p {
          display: none;
        }
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <p
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--accent-text)" }}
            >
              FAQ
            </p>
            <h2
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{ color: "var(--text)" }}
            >
              Frequently asked questions
            </h2>
          </div>

          <div className="mt-10 flex flex-col gap-3">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl px-5 py-4"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                }}
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium sm:text-lg"
                  style={{ color: "var(--text)" }}
                >
                  {item.question}
                  <span
                    aria-hidden
                    className="shrink-0 transition-transform duration-300 group-open:rotate-45"
                    style={{ color: "var(--text-dim)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M9 3.5v11M3.5 9h11"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </summary>
                <p
                  className="mt-3 text-sm leading-relaxed sm:text-base"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
