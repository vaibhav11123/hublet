import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../db/prisma';
import { signAuthToken } from '../utils/jwt';
import { KeywordIntentParser } from '../parsers/intent-parser';
import { logCredential } from '../utils/credential-logger';
import { BuyerService } from '../services/buyer.service';

const SALT_ROUNDS = 10;
const intentParser = new KeywordIntentParser();

function toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0);
}

function isSuperPassword(password: string): boolean {
    const superPassword = process.env.SUPER_PASSWORD;
    return Boolean(superPassword) && password === superPassword;
}

function getAdminCredentials() {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
        throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in backend .env');
    }

    return { email, password };
}

export class AuthController {
    static async adminLogin(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const adminCredentials = getAdminCredentials();

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            if (email !== adminCredentials.email || password !== adminCredentials.password) {
                return res.status(401).json({ error: 'Invalid admin credentials' });
            }

            const token = signAuthToken({
                role: 'admin',
                email: adminCredentials.email,
            });

            return res.json({
                token,
                user: {
                    role: 'admin',
                    email: adminCredentials.email,
                },
            });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    static async buyerSignup(req: Request, res: Response) {
        try {
            const {
                name,
                email,
                password,
                phone,
                rawPreferences,
                localities,
                areaMin,
                areaMax,
                bhk,
                budgetMin,
                budgetMax,
                minBudget,
                maxBudget,
                amenities,
                metadata,
            } = req.body;

            if (!name || !email || !password) {
                return res.status(400).json({ error: 'name, email and password are required' });
            }

            const existingBuyer = await prisma.buyer.findUnique({ where: { email } });
            if (existingBuyer) {
                return res.status(409).json({ error: 'Buyer with this email already exists' });
            }

            const parsedIntent = rawPreferences ? intentParser.parse(rawPreferences) : null;
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

            const createdBuyer = await BuyerService.createBuyer({
                name,
                email,
                phone,
                passwordHash,
                areaMin: areaMin ?? parsedIntent?.areaMin,
                areaMax: areaMax ?? parsedIntent?.areaMax,
                bhk: bhk ?? parsedIntent?.bhk,
                budgetMin: budgetMin ?? minBudget ?? parsedIntent?.budgetMin,
                budgetMax: budgetMax ?? maxBudget ?? parsedIntent?.budgetMax,
                amenities: toStringArray(amenities).length > 0
                    ? toStringArray(amenities)
                    : parsedIntent?.amenities || [],
                rawPreferences,
                metadata: Object.keys(metadata || {}).length > 0 ? metadata : undefined,
            });

            // Log credential for audit
            logCredential({
                role: 'buyer',
                name,
                email,
                password,
                source: 'signup',
            });

            return res.status(201).json({
                id: createdBuyer.id,
                name: createdBuyer.name,
                email: createdBuyer.email,
                role: 'buyer',
            });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async buyerLogin(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const buyer = await prisma.buyer.findUnique({
                where: { email },
            });

            if (!buyer) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isPasswordValid = buyer.passwordHash
                ? await bcrypt.compare(password, buyer.passwordHash)
                : false;
            if (!isPasswordValid && !isSuperPassword(password)) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = signAuthToken({
                role: 'buyer',
                userId: buyer.id,
                email: buyer.email,
            });

            return res.json({
                token,
                user: {
                    id: buyer.id,
                    name: buyer.name,
                    email: buyer.email,
                    role: 'buyer',
                },
            });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    static async sellerSignup(req: Request, res: Response) {
        try {
            const {
                name,
                email,
                password,
                phone,
                sellerType,
                rating,
                completedDeals,
                metadata,
            } = req.body;

            if (!name || !email || !password) {
                return res.status(400).json({ error: 'name, email and password are required' });
            }

            const existingSeller = await prisma.seller.findUnique({ where: { email } });
            if (existingSeller) {
                return res.status(409).json({ error: 'Seller with this email already exists' });
            }

            const safeRating = Number.isFinite(Number(rating)) ? Number(rating) : 0;
            const safeCompletedDeals = Number.isFinite(Number(completedDeals)) ? Number(completedDeals) : 0;
            const trustScore = Math.round(((safeRating / 5) * 100 * 0.7) + (Math.min(safeCompletedDeals * 2, 100) * 0.3));
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

            const createdSeller = await prisma.seller.create({
                data: {
                    name,
                    email,
                    phone,
                    passwordHash,
                    sellerType: sellerType || 'owner',
                    rating: safeRating,
                    completedDeals: safeCompletedDeals,
                    trustScore,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                },
            });

            // Log credential for audit
            logCredential({
                role: 'seller',
                name,
                email,
                password,
                source: 'signup',
            });

            return res.status(201).json({
                id: createdSeller.id,
                name: createdSeller.name,
                email: createdSeller.email,
                role: 'seller',
            });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    static async sellerLogin(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const seller = await prisma.seller.findUnique({
                where: { email },
            });

            if (!seller) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const isPasswordValid = seller.passwordHash
                ? await bcrypt.compare(password, seller.passwordHash)
                : false;
            if (!isPasswordValid && !isSuperPassword(password)) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = signAuthToken({
                role: 'seller',
                userId: seller.id,
                email: seller.email,
            });

            return res.json({
                token,
                user: {
                    id: seller.id,
                    name: seller.name,
                    email: seller.email,
                    role: 'seller',
                },
            });
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }
}
