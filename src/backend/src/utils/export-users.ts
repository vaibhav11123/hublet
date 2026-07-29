/**
 * Export all buyers and sellers from the DB into a nicely formatted
 * users_list.md file in the project root directory.
 * Auto-updated after each scrape.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Root of the monorepo
const ROOT_DIR = path.resolve(__dirname, '../../../../');
const OUTPUT_FILE = path.join(ROOT_DIR, 'users_list.md');

export async function exportUsersList(): Promise<void> {
    const buyers = await prisma.buyer.findMany({ orderBy: { createdAt: 'desc' } });
    const sellers = await prisma.seller.findMany({
        orderBy: { createdAt: 'desc' },
        include: { properties: { select: { id: true, title: true } } }
    });

    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const lines: string[] = [];

    lines.push('#  Users List — Buyers & Sellers');
    lines.push('');
    lines.push(`> Auto-generated on ${now}. Updated after every scrape.`);
    lines.push('');

    // ── Sellers ──
    lines.push('---');
    lines.push('');
    lines.push(`##  Sellers (${sellers.length} total)`);
    lines.push('');
    lines.push('| # | Name | Email | Phone | Type | Rating | Properties |');
    lines.push('|---|------|-------|-------|------|--------|------------|');

    sellers.forEach((s, i) => {
        const propCount = s.properties?.length || 0;
        const phone = s.phone || '—';
        const rating = s.rating ? `${s.rating.toFixed(1)} ` : '—';
        lines.push(`| ${i + 1} | ${s.name} | \`${s.email}\` | ${phone} | ${s.sellerType} | ${rating} | ${propCount} |`);
    });

    lines.push('');

    // Quick login reference for sellers
    if (sellers.length > 0) {
        lines.push('<details><summary> Quick Login Emails (click to expand)</summary>');
        lines.push('');
        lines.push('```');
        sellers.forEach(s => {
            lines.push(`${s.email}`);
        });
        lines.push('```');
        lines.push('</details>');
        lines.push('');
    }

    // ── Buyers ──
    lines.push('---');
    lines.push('');
    lines.push(`##  Buyers (${buyers.length} total)`);
    lines.push('');
    lines.push('| # | Name | Email | Phone | BHK | Budget Range | Area Range | Localities |');
    lines.push('|---|------|-------|-------|-----|--------------|------------|------------|');

    buyers.forEach((b, i) => {
        const phone = b.phone || '—';
        const bhk = b.bhk ? `${b.bhk} BHK` : '—';
        const budgetMin = b.budgetMin ? formatPrice(b.budgetMin) : '—';
        const budgetMax = b.budgetMax ? formatPrice(b.budgetMax) : '—';
        const budget = (budgetMin !== '—' || budgetMax !== '—') ? `${budgetMin} – ${budgetMax}` : '—';
        const areaRange = (b.areaMin || b.areaMax) ? `${b.areaMin || '?'} – ${b.areaMax || '?'} sqft` : '—';

        let localities = '—';
        try {
            const meta = JSON.parse(b.metadata || '{}');
            const coords: Array<{ name: string }> = meta.localityCoords || [];
            if (coords.length > 0) {
                localities = coords.slice(0, 3).map((c) => c.name).join(', ');
                if (coords.length > 3) localities += ` (+${coords.length - 3})`;
            }
        } catch { /* */ }

        lines.push(`| ${i + 1} | ${b.name} | \`${b.email}\` | ${phone} | ${bhk} | ${budget} | ${areaRange} | ${localities} |`);
    });

    lines.push('');

    // Quick login reference for buyers
    if (buyers.length > 0) {
        lines.push('<details><summary> Quick Login Emails (click to expand)</summary>');
        lines.push('');
        lines.push('```');
        buyers.forEach(b => {
            lines.push(`${b.email}`);
        });
        lines.push('```');
        lines.push('</details>');
        lines.push('');
    }

    // ── Stats ──
    lines.push('---');
    lines.push('');
    lines.push('##  Summary');
    lines.push('');
    lines.push(`- **Total Sellers**: ${sellers.length}`);
    lines.push(`- **Total Buyers**: ${buyers.length}`);
    lines.push(`- **Total Properties**: ${sellers.reduce((sum, s) => sum + (s.properties?.length || 0), 0)}`);
    lines.push(`- **Last Updated**: ${now}`);
    lines.push('');

    fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');
}

function formatPrice(price: number): string {
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(2)} Lac`;
    return `₹${price.toLocaleString('en-IN')}`;
}
