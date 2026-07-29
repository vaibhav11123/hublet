import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const CITIES = {
    Mumbai: ['Bandra', 'Andheri', 'Powai', 'Juhu', 'Worli', 'Malad', 'Vikhroli', 'Mulund', 'Goregaon', 'Borivali'],
    Hyderabad: ['Hitech City', 'Gachibowli', 'Banjara Hills', 'Jubilee Hills', 'Madhapur', 'Kondapur'],
    Delhi: ['Connaught Place', 'Saket', 'Dwarka', 'Rohini', 'Vasant Kunj', 'Hauz Khas']
};

const AMENITIES = ['Parking', 'Gym', 'Pool', 'Security', 'Garden', 'Clubhouse', 'Elevator', 'Power Backup', 'Air Conditioning', 'Furnished'];

async function main() {
    console.log(' Starting database seed for Buyers only...\n');

    // Clear existing data
    console.log('Clearing existing data...');
    try {
        // Delete in order to avoid foreign key constraints violations if any
        await prisma.workflowEvent.deleteMany();
        await prisma.lead.deleteMany();
        await prisma.match.deleteMany();
        await prisma.property.deleteMany();
        await prisma.buyer.deleteMany();
        await prisma.seller.deleteMany();
        console.log('Cleared existing data.');
    } catch (error) {
        console.log('Error clearing data:', error);
    }

    // --- Create Buyers ---
    console.log('Creating buyers for Mumbai, Delhi, Hyderabad...');
    const buyers: any[] = [];

    for (const [city, localities] of Object.entries(CITIES)) {
        // Create 10 buyers per city
        const numBuyers = 10;

        for (let b = 0; b < numBuyers; b++) {
            const bhk = [0, 1, 2, 3, 4][Math.floor(Math.random() * 5)]; // 0 for commercial

            // Realistic budgets for these cities
            const basePrice = 5000000; // 50L
            const multiplier = Math.floor(Math.random() * 10) + 1; // 1x to 10x
            const budgetMin = basePrice * multiplier;
            const budgetMax = budgetMin * 1.5;

            // Random localities from the city list
            const preferredLocalities = localities
                .sort(() => 0.5 - Math.random())
                .slice(0, 2 + Math.floor(Math.random() * 3));

            // Include the city name itself to match city-wide searches
            preferredLocalities.push(city);

            // Random amenities
            const preferredAmenities = AMENITIES
                .sort(() => 0.5 - Math.random())
                .slice(0, 2 + Math.floor(Math.random() * 3));

            const buyer = await prisma.buyer.create({
                data: {
                    name: `${city} Investor ${b + 1}`,
                    email: `investor.${city.toLowerCase()}.${b + 1}@example.com`,
                    phone: `+91 ${7000000000 + Math.floor(Math.random() * 1000000000)}`,
                    areaMin: 500,
                    areaMax: 5000,
                    budgetMin: budgetMin,
                    budgetMax: budgetMax,
                    bhk: bhk,
                    amenities: JSON.stringify(preferredAmenities),
                    metadata: JSON.stringify({
                        source: 'seed-script',
                        city: city,
                        type: 'investor'
                    })
                },
            });
            buyers.push(buyer);
        }
    }
    console.log(`✓ Created ${buyers.length} buyers across ${Object.keys(CITIES).length} cities\n`);

    console.log(' Database seeding completed! Ready for scraping.');
}

main()
    .catch((e) => {
        console.error('Error seeding database:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
