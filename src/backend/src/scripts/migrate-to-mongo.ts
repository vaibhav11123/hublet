import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { getMongoDb, closeMongoConnection } from '../db/mongo';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const sqliteSourceRaw = process.env.SQLITE_SOURCE_URL || 'file:./prisma/dev.db';
const sqliteSourcePath = sqliteSourceRaw.startsWith('file:')
    ? sqliteSourceRaw.replace(/^file:/, '')
    : sqliteSourceRaw;
const sqliteSourceAbsolutePath = path.isAbsolute(sqliteSourcePath)
    ? sqliteSourcePath
    : path.resolve(process.cwd(), sqliteSourcePath);
const sqliteSourceUrl = `file:${sqliteSourceAbsolutePath}`;

function parseJsonString<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

async function main() {
    if (!fs.existsSync(sqliteSourceAbsolutePath)) {
        throw new Error(`SQLite source file not found at ${sqliteSourceAbsolutePath}`);
    }

    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: sqliteSourceUrl,
            },
        },
    });

    try {
        const [buyers, sellers, properties, leads, matches, workflowEvents] = await Promise.all([
            prisma.buyer.findMany(),
            prisma.seller.findMany(),
            prisma.property.findMany(),
            prisma.lead.findMany(),
            prisma.match.findMany(),
            prisma.workflowEvent.findMany(),
        ]);

        const db = await getMongoDb();

        const buyerDocs = buyers.map((buyer) => ({
            ...buyer,
            amenities: parseJsonString<string[]>(buyer.amenities, []),
            metadata: parseJsonString<Record<string, unknown> | null>(buyer.metadata, null),
        }));

        const sellerDocs = sellers.map((seller) => ({
            ...seller,
            metadata: parseJsonString<Record<string, unknown> | null>(seller.metadata, null),
        }));

        const propertyDocs = properties.map((property) => ({
            ...property,
            amenities: parseJsonString<string[]>(property.amenities, []),
            metadata: parseJsonString<Record<string, unknown> | null>(property.metadata, null),
        }));

        const leadDocs = leads.map((lead) => ({
            ...lead,
            metadata: parseJsonString<Record<string, unknown> | null>(lead.metadata, null),
        }));

        const matchDocs = matches.map((match) => ({
            ...match,
            metadata: parseJsonString<Record<string, unknown> | null>(match.metadata, null),
        }));

        const workflowEventDocs = workflowEvents.map((event) => ({
            ...event,
            metadata: parseJsonString<Record<string, unknown> | null>(event.metadata, null),
        }));

        const upsertById = async (collectionName: string, docs: Array<Record<string, unknown>>) => {
            const collection = db.collection(collectionName);
            if (docs.length === 0) return;

            await collection.bulkWrite(
                docs.map((doc) => ({
                    replaceOne: {
                        filter: { id: doc.id },
                        replacement: doc,
                        upsert: true,
                    },
                })),
                { ordered: false }
            );
        };

        await Promise.all([
            upsertById('buyers', buyerDocs),
            upsertById('sellers', sellerDocs),
            upsertById('properties', propertyDocs),
            upsertById('leads', leadDocs),
            upsertById('matches', matchDocs),
            upsertById('workflowEvents', workflowEventDocs),
        ]);

        await Promise.all([
            db.collection('buyers').createIndex({ email: 1 }, { unique: true }),
            db.collection('sellers').createIndex({ email: 1 }, { unique: true }),
            db.collection('matches').createIndex({ buyerId: 1, propertyId: 1 }, { unique: true }),
            db.collection('properties').createIndex({ sellerId: 1 }),
            db.collection('properties').createIndex({ locality: 1 }),
            db.collection('properties').createIndex({ bhk: 1 }),
            db.collection('properties').createIndex({ price: 1 }),
            db.collection('leads').createIndex({ buyerId: 1 }),
            db.collection('leads').createIndex({ propertyId: 1 }),
            db.collection('leads').createIndex({ state: 1 }),
            db.collection('workflowEvents').createIndex({ leadId: 1 }),
            db.collection('workflowEvents').createIndex({ eventType: 1 }),
            db.collection('workflowEvents').createIndex({ createdAt: 1 }),
        ]);

        const [buyerCount, sellerCount, propertyCount, leadCount, matchCount, workflowEventCount] =
            await Promise.all([
                db.collection('buyers').countDocuments(),
                db.collection('sellers').countDocuments(),
                db.collection('properties').countDocuments(),
                db.collection('leads').countDocuments(),
                db.collection('matches').countDocuments(),
                db.collection('workflowEvents').countDocuments(),
            ]);

        console.log(
            JSON.stringify(
                {
                    status: 'ok',
                    source: sqliteSourceUrl,
                    targetDb: process.env.MONGODB_DB_NAME || 'hublet',
                    counts: {
                        buyers: buyerCount,
                        sellers: sellerCount,
                        properties: propertyCount,
                        leads: leadCount,
                        matches: matchCount,
                        workflowEvents: workflowEventCount,
                    },
                },
                null,
                2
            )
        );
    } finally {
        await prisma.$disconnect();
        await closeMongoConnection();
    }
}

main().catch((error) => {
    console.error('Mongo migration failed:', error);
    process.exit(1);
});
