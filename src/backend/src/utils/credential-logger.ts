/**
 * credential-logger.ts
 *
 * Appends user credentials to a JSON log file every time a buyer/seller
 * signs up or gets seeded. For demo/audit purposes.
 *
 * Log file: src/backend/credentials-log.json
 */

import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(__dirname, '../../credentials-log.json');

export interface CredentialEntry {
    role: 'buyer' | 'seller' | 'admin';
    name: string;
    email: string;
    password: string;
    source: 'signup' | 'seeder' | 'env' | 'scraper' | 'facebook';
    timestamp: string;
}

/**
 * Read existing log entries (or create empty array if file doesn't exist).
 */
function readLog(): CredentialEntry[] {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const raw = fs.readFileSync(LOG_FILE, 'utf-8');
            return JSON.parse(raw);
        }
    } catch {
        // If file is corrupt, start fresh
    }
    return [];
}

/**
 * Append a credential entry to the log file.
 */
export function logCredential(entry: Omit<CredentialEntry, 'timestamp'>): void {
    try {
        const entries = readLog();
        entries.push({
            ...entry,
            timestamp: new Date().toISOString(),
        });
        fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), 'utf-8');
    } catch (err) {
        console.error('[CredentialLogger] Failed to write log:', err);
    }
}

/**
 * Log multiple credentials at once (e.g., after seeding).
 */
export function logCredentials(entries: Omit<CredentialEntry, 'timestamp'>[]): void {
    try {
        const existing = readLog();
        const now = new Date().toISOString();
        const newEntries = entries.map((e) => ({ ...e, timestamp: now }));
        existing.push(...newEntries);
        fs.writeFileSync(LOG_FILE, JSON.stringify(existing, null, 2), 'utf-8');
    } catch (err) {
        console.error('[CredentialLogger] Failed to write log:', err);
    }
}

/**
 * Get all logged credentials.
 */
export function getCredentials(): CredentialEntry[] {
    return readLog();
}

/**
 * Clear ALL credentials from the log file (used on DB reset).
 */
export function clearCredentials(): void {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify([], null, 2), 'utf-8');
    } catch (err) {
        console.error('[CredentialLogger] Failed to clear log:', err);
    }
}

/**
 * Remove all credential entries matching a specific email.
 */
export function removeCredentialByEmail(email: string): void {
    try {
        const entries = readLog();
        const filtered = entries.filter((e) => e.email !== email);
        fs.writeFileSync(LOG_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
    } catch (err) {
        console.error('[CredentialLogger] Failed to remove credential:', err);
    }
}
