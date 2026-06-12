'use client';

import { useState } from 'react';

export interface FAQItem {
  question: string;
  answer: string;
}

interface Props {
  items: FAQItem[];
}

export default function CollapsibleFAQ({ items }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const toggle = (index: number) => {
    setExpanded((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <section className="mt-14 border-t pt-10" style={{ borderColor: 'var(--border)' }}>
      <h2
        className="text-2xl font-semibold tracking-tight"
        style={{ color: 'var(--text)' }}
      >
        Frequently asked questions
      </h2>
      <div className="mt-6 flex flex-col gap-3">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="flex items-start gap-3 border rounded-lg p-4 text-left transition-colors hover:opacity-80"
            style={{ borderColor: 'var(--border)', background: 'transparent' }}
          >
            <span
              className="mt-1 flex-shrink-0 text-lg leading-none transition-transform"
              style={{
                color: 'var(--text)',
                transform: expanded[i] ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            >
              ▼
            </span>
            <div className="flex-1">
              <h3
                className="text-base font-medium leading-snug"
                style={{ color: 'var(--text)' }}
              >
                {item.question}
              </h3>
              {expanded[i] && (
                <p
                  className="mt-3 text-sm leading-relaxed"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {item.answer}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
