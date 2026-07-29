
import { PrismaClient } from '@prisma/client';
import { MatchingService } from './src/services/matching.service';
import { LeadService } from './src/services/lead.service';

const prisma = new PrismaClient();

async function main() {
    console.log("Creating test buyer for Pune...");

    const buyer = await prisma.buyer.create({
        data: {
            name: "Pune Tech Buyer",
            email: `pune.buyer.${Date.now()}@test.com`,
            phone: "9876543210",
            localities: JSON.stringify(["Baner", "Hinjawadi", "Wakad", "Pune"]),
            areaMin: 400,
            areaMax: 1000,
            budgetMin: 10000000, // 1 Cr
            budgetMax: 50000000, // 5 Cr
            bhk: 0,
            amenities: JSON.stringify(["Air Conditioning", "Power Backup"]),
            metadata: JSON.stringify({ source: "manual-test" })
        }
    });

    console.log(`Created buyer: ${buyer.name} (${buyer.id})`);

    console.log("Running matching service...");
    const matchingService = new MatchingService();

    // Find matches for this new buyer
    const matches = await matchingService.findMatchesForBuyer(buyer.id);
    console.log(`Found ${matches.length} matches.`);

    // Auto-create leads
    for (const match of matches) {
        if (match.matchScore >= 50) { // Lower threshold for test
            await LeadService.createLead({
                buyerId: buyer.id,
                propertyId: match.property.id,
                matchScore: match.matchScore,
                metadata: {
                    source: 'manual-test-script',
                    autoCreated: true
                }
            });
            console.log(`Created LEAD for property: ${match.property.title} (Score: ${match.matchScore})`);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
