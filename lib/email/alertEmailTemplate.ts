import type { Listing } from '@/lib/types';
import { PLATFORM_NAMES } from '@/lib/types';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', GBP: '£', EUR: '€', CAD: 'CA$', AUD: 'A$', JPY: '¥',
};

function formatPrice(price: number | null, currency: string): string {
  if (price == null) return 'Price unavailable';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function listingMetaLine(l: Listing): string {
  const parts = [
    PLATFORM_NAMES[l.platform] ?? l.platform,
    l.size,
    l.condition,
  ].filter((p): p is string => Boolean(p));
  return escapeHtml(parts.join(' · '));
}

function listingRow(l: Listing): string {
  const title = escapeHtml(l.title || 'Item');
  const price = formatPrice(l.price, l.currency);
  const meta = listingMetaLine(l);
  const thumb = l.image
    ? `<img src="${escapeHtml(l.image)}" width="80" height="80" alt="" style="display:block;width:80px;height:80px;border-radius:8px;object-fit:cover;background:#f0f0ee;" />`
    : `<div style="width:80px;height:80px;border-radius:8px;background:#f0f0ee;"></div>`;

  return `
    <tr>
      <td style="padding:0 0 12px 0;">
        <a href="${escapeHtml(l.url)}" style="text-decoration:none;color:inherit;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ececeb;border-radius:10px;background:#ffffff;">
            <tr>
              <td style="width:80px;padding:12px;">${thumb}</td>
              <td style="padding:12px 16px 12px 0;vertical-align:middle;">
                <div style="font-size:14px;font-weight:600;color:#111110;line-height:1.3;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${title}</div>
                <div style="font-size:15px;font-weight:700;color:#E24B4A;margin-top:4px;">${price}</div>
                ${meta ? `<div style="font-size:12px;color:rgba(0,0,0,0.45);margin-top:2px;">${meta}</div>` : ''}
              </td>
            </tr>
          </table>
        </a>
      </td>
    </tr>`;
}

/** Shared chrome so the baseline and new-match emails stay visually identical. */
function emailShell({ eyebrow, body }: { eyebrow: string; body: string }): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f7f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f6;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:92%;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#E24B4A;padding:20px 24px;">
                <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Crawli</span>
                <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:0.4px;margin-left:10px;">${escapeHtml(eyebrow)}</span>
              </td>
            </tr>
            ${body}
            <tr>
              <td style="background:#f7f7f6;padding:18px 24px;text-align:center;">
                <a href="https://thecrawli.com/alerts" style="font-size:12px;color:rgba(0,0,0,0.45);text-decoration:underline;">Manage your alerts</a>
                <div style="font-size:12px;color:rgba(0,0,0,0.35);margin-top:8px;">Crawli</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface BaselineEmailParams {
  query: string;
  /** Everything matching right now — the alert's starting baseline. */
  totalCount: number;
  /** How many marketplaces were actually searched for this alert. */
  platformCount: number;
  /** The subset shown inline (caller slices). */
  listings: Listing[];
  /** e.g. "daily" / "weekly" — how often this alert rechecks. */
  cadenceWord: string;
}

/**
 * Sent the moment an alert's first run finishes, so creating an alert pays off
 * immediately instead of going quiet until something new appears. Explicitly
 * labels these as the starting point, not as new matches, so it can't be
 * confused with the recurring new-listings email.
 */
export function buildBaselineEmailHtml({
  query, totalCount, platformCount, listings, cadenceWord,
}: BaselineEmailParams): string {
  const marketplaces = `${platformCount} marketplace${platformCount === 1 ? '' : 's'}`;

  if (totalCount === 0) {
    return emailShell({
      eyebrow: 'Alert created',
      body: `
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <p style="margin:0 0 12px 0;font-size:15px;color:#111110;line-height:1.5;">
                  Your alert for <strong>&quot;${escapeHtml(query)}&quot;</strong> is live, watching ${marketplaces}.
                </p>
                <p style="margin:0;font-size:15px;color:#111110;line-height:1.5;">
                  Nothing matches right now, so there is nothing to show yet. We will email you the
                  moment something does. If that stays quiet, try a broader query or loosen the size
                  and price filters on the alert.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 28px 24px;" align="center">
                <a href="https://thecrawli.com/alerts" style="display:inline-block;background:#E24B4A;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Edit this alert</a>
              </td>
            </tr>`,
    });
  }

  const rows = listings.map(listingRow).join('');
  const remaining = totalCount - listings.length;
  const moreRow = remaining > 0
    ? `<tr><td style="padding:4px 0 0 0;font-size:13px;color:rgba(0,0,0,0.45);text-align:center;">…and ${remaining} more matching right now.</td></tr>`
    : '';

  return emailShell({
    eyebrow: 'Alert created',
    body: `
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <p style="margin:0 0 8px 0;font-size:15px;color:#111110;line-height:1.5;">
                  Your alert for <strong>&quot;${escapeHtml(query)}&quot;</strong> is live. Right now
                  <strong>${totalCount} listing${totalCount === 1 ? '' : 's'}</strong> match across ${marketplaces}:
                </p>
                <p style="margin:0 0 16px 0;font-size:13px;color:rgba(0,0,0,0.5);line-height:1.5;">
                  These are your starting point, not new finds. From here we recheck ${escapeHtml(cadenceWord)} and only
                  email you listings that appear after today.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                  ${moreRow}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 28px 24px;" align="center">
                <a href="https://thecrawli.com/alerts" style="display:inline-block;background:#E24B4A;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;margin-top:8px;">Manage this alert</a>
              </td>
            </tr>`,
  });
}

export interface AlertEmailParams {
  query: string;
  newCount: number;
  listings: Listing[];
  totalNewCount: number;
}

export function buildAlertEmailHtml({ query, newCount, listings, totalNewCount }: AlertEmailParams): string {
  const rows = listings.map(listingRow).join('');
  const remaining = totalNewCount - listings.length;
  const moreRow = remaining > 0
    ? `<tr><td style="padding:4px 0 0 0;font-size:13px;color:rgba(0,0,0,0.45);text-align:center;">…and ${remaining} more.</td></tr>`
    : '';

  return emailShell({
    eyebrow: 'Alert',
    body: `
            <tr>
              <td style="padding:24px 24px 8px 24px;">
                <p style="margin:0 0 16px 0;font-size:15px;color:#111110;line-height:1.5;">
                  Your alert for <strong>&quot;${escapeHtml(query)}&quot;</strong> found ${newCount} new listing${newCount === 1 ? '' : 's'}:
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                  ${moreRow}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 28px 24px;" align="center">
                <a href="https://thecrawli.com/alerts" style="display:inline-block;background:#E24B4A;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;margin-top:8px;">View all results</a>
              </td>
            </tr>`,
  });
}
