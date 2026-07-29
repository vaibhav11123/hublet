/**
 * seed-demo-sellers.ts
 *
 * Seeds 15 demo sellers with 25 properties across 5 Indian cities.
 * Some sellers have 1 property, some have 2, to reach 25 total.
 * Mix of pre-supplied coordinates and text-only locality for geocoding tests.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const DEFAULT_PASSWORD = 'seller123';

interface PropertyDef {
    title: string;
    locality: string;
    bhk: number;
    area: number;
    price: number;
    propertyType: string;
    amenities: string[];
    /** Pre-geocoded — if absent, matching service will geocode the locality */
    coordinates?: { lat: number; lon: number };
}

interface DemoSellerDef {
    name: string;
    email: string;
    phone: string;
    sellerType: string;
    city: string;
    properties: PropertyDef[];
}

const DEMO_SELLERS: DemoSellerDef[] = [
    // ═══════════════════ HYDERABAD (3 sellers, 5 properties) ═══════════════════
    {
        name: 'Srinivas Builders', email: 'srinivas.hyd@demo.com', phone: '9200000001',
        sellerType: 'builder', city: 'Hyderabad',
        properties: [
            {
                title: 'Srinivas Heights 3BHK Gachibowli', locality: 'Gachibowli, Hyderabad', bhk: 3, area: 1550, price: 8500000, propertyType: 'apartment', amenities: ['parking', 'gym', 'power backup', 'lift'],
                coordinates: { lat: 17.4410, lon: 78.3495 }
            },
            {
                title: 'Srinivas Towers 2BHK Kondapur', locality: 'Kondapur, Hyderabad', bhk: 2, area: 1050, price: 4800000, propertyType: 'apartment', amenities: ['parking', 'lift', 'security'],
                coordinates: { lat: 17.4600, lon: 78.3575 }
            },
        ],
    },
    {
        name: 'Rajesh Kumar (Owner)', email: 'rajesh.hyd@demo.com', phone: '9200000002',
        sellerType: 'owner', city: 'Hyderabad',
        properties: [
            {
                title: 'Premium 3BHK Madhapur', locality: 'Madhapur, Hyderabad', bhk: 3, area: 1700, price: 11000000, propertyType: 'apartment', amenities: ['swimming pool', 'gym', 'clubhouse', 'garden', 'parking'],
                coordinates: { lat: 17.4490, lon: 78.3915 }
            },
        ],
    },
    {
        name: 'Sai Realtors', email: 'sai.hyd@demo.com', phone: '9200000003',
        sellerType: 'agent', city: 'Hyderabad',
        properties: [
            // TEXT-ONLY locality — will be geocoded
            { title: 'Spacious 2BHK Kukatpally', locality: 'Kukatpally, Hyderabad', bhk: 2, area: 950, price: 4200000, propertyType: 'apartment', amenities: ['parking', 'lift', 'power backup'] },
            {
                title: 'Luxury Villa Jubilee Hills', locality: 'Jubilee Hills, Hyderabad', bhk: 3, area: 2200, price: 18000000, propertyType: 'villa', amenities: ['swimming pool', 'gym', 'clubhouse', 'garden', 'parking', 'security'],
                coordinates: { lat: 17.4330, lon: 78.4078 }
            },
        ],
    },

    // ═══════════════════ BANGALORE (3 sellers, 5 properties) ═══════════════════
    {
        name: 'Prestige Group BLR', email: 'prestige.blr@demo.com', phone: '9200000004',
        sellerType: 'builder', city: 'Bangalore',
        properties: [
            {
                title: 'Prestige Lakeside 2BHK Whitefield', locality: 'Whitefield, Bangalore', bhk: 2, area: 1150, price: 7200000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'],
                coordinates: { lat: 12.9705, lon: 77.7510 }
            },
            {
                title: 'Prestige Ozone 3BHK Whitefield', locality: 'Whitefield, Bangalore', bhk: 3, area: 1680, price: 12500000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'clubhouse', 'garden'],
                coordinates: { lat: 12.9690, lon: 77.7485 }
            },
        ],
    },
    {
        name: 'Anand Murthy (Owner)', email: 'anand.blr@demo.com', phone: '9200000005',
        sellerType: 'owner', city: 'Bangalore',
        properties: [
            {
                title: 'Cozy 2BHK HSR Layout', locality: 'HSR Layout, Bangalore', bhk: 2, area: 1000, price: 6800000, propertyType: 'apartment', amenities: ['parking', 'lift', 'power backup'],
                coordinates: { lat: 12.9120, lon: 77.6395 }
            },
        ],
    },
    {
        name: 'Brigade Realty', email: 'brigade.blr@demo.com', phone: '9200000006',
        sellerType: 'agent', city: 'Bangalore',
        properties: [
            // TEXT-ONLY
            { title: 'Modern 3BHK Koramangala', locality: 'Koramangala, Bangalore', bhk: 3, area: 1600, price: 14000000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'] },
            {
                title: 'Budget 2BHK Electronic City', locality: 'Electronic City, Bangalore', bhk: 2, area: 900, price: 4500000, propertyType: 'apartment', amenities: ['lift', 'power backup', 'security'],
                coordinates: { lat: 12.8399, lon: 77.6770 }
            },
        ],
    },

    // ═══════════════════ MUMBAI (3 sellers, 5 properties) ═══════════════════
    {
        name: 'Lodha Group MUM', email: 'lodha.mum@demo.com', phone: '9200000007',
        sellerType: 'builder', city: 'Mumbai',
        properties: [
            {
                title: 'Lodha Luxuria 2BHK Andheri West', locality: 'Andheri West, Mumbai', bhk: 2, area: 780, price: 13500000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'security'],
                coordinates: { lat: 19.1370, lon: 72.8300 }
            },
            {
                title: 'Lodha Supremus 3BHK Powai', locality: 'Powai, Mumbai', bhk: 3, area: 1350, price: 22000000, propertyType: 'apartment', amenities: ['swimming pool', 'gym', 'clubhouse', 'garden', 'parking', 'security'],
                coordinates: { lat: 19.1180, lon: 72.9065 }
            },
        ],
    },
    {
        name: 'Sunita Verma (Owner)', email: 'sunita.mum@demo.com', phone: '9200000008',
        sellerType: 'owner', city: 'Mumbai',
        properties: [
            // TEXT-ONLY
            { title: 'Compact 1BHK Thane West', locality: 'Thane West, Mumbai', bhk: 1, area: 550, price: 5500000, propertyType: 'apartment', amenities: ['lift', 'security'] },
        ],
    },
    {
        name: 'Hiranandani Agents', email: 'hiranandani.mum@demo.com', phone: '9200000009',
        sellerType: 'agent', city: 'Mumbai',
        properties: [
            {
                title: 'Elegant 2BHK Goregaon East', locality: 'Goregaon East, Mumbai', bhk: 2, area: 850, price: 11000000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool'],
                coordinates: { lat: 19.1640, lon: 72.8500 }
            },
            {
                title: 'Premium 3BHK Worli Sea Face', locality: 'Worli, Mumbai', bhk: 3, area: 1500, price: 32000000, propertyType: 'apartment', amenities: ['swimming pool', 'gym', 'clubhouse', 'garden', 'parking', 'security'],
                coordinates: { lat: 19.0180, lon: 72.8180 }
            },
        ],
    },

    // ═══════════════════ PUNE (3 sellers, 5 properties) ═══════════════════
    {
        name: 'Kolte Patil Developers', email: 'kolte.pun@demo.com', phone: '9200000010',
        sellerType: 'builder', city: 'Pune',
        properties: [
            {
                title: 'Life Republic 2BHK Hinjewadi', locality: 'Hinjewadi, Pune', bhk: 2, area: 1050, price: 5200000, propertyType: 'apartment', amenities: ['parking', 'gym', 'clubhouse'],
                coordinates: { lat: 18.5918, lon: 73.7395 }
            },
            {
                title: 'Ivy Estate 3BHK Wagholi', locality: 'Wagholi, Pune', bhk: 3, area: 1450, price: 7800000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'garden'],
                coordinates: { lat: 18.5815, lon: 73.9728 }
            },
        ],
    },
    {
        name: 'Amit Shah (Owner)', email: 'amit.pun@demo.com', phone: '9200000011',
        sellerType: 'owner', city: 'Pune',
        properties: [
            {
                title: 'Sunny 2BHK Kharadi', locality: 'Kharadi, Pune', bhk: 2, area: 980, price: 5800000, propertyType: 'apartment', amenities: ['parking', 'lift', 'power backup'],
                coordinates: { lat: 18.5515, lon: 73.9410 }
            },
        ],
    },
    {
        name: 'Kumar Properties Pune', email: 'kumar.pun@demo.com', phone: '9200000012',
        sellerType: 'agent', city: 'Pune',
        properties: [
            // TEXT-ONLY
            { title: 'Modern 3BHK Baner', locality: 'Baner, Pune', bhk: 3, area: 1550, price: 9500000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'] },
            {
                title: 'Budget 2BHK Hadapsar', locality: 'Hadapsar, Pune', bhk: 2, area: 850, price: 3800000, propertyType: 'apartment', amenities: ['lift', 'security', 'power backup'],
                coordinates: { lat: 18.5089, lon: 73.9260 }
            },
        ],
    },

    // ═══════════════════ CHENNAI (3 sellers, 5 properties) ═══════════════════
    {
        name: 'Casagrand Group', email: 'casagrand.chn@demo.com', phone: '9200000013',
        sellerType: 'builder', city: 'Chennai',
        properties: [
            {
                title: 'Casagrand First City 3BHK OMR', locality: 'OMR Perungudi, Chennai', bhk: 3, area: 1400, price: 8500000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'clubhouse', 'power backup'],
                coordinates: { lat: 12.9630, lon: 80.2418 }
            },
            {
                title: 'Casagrand Aristo 2BHK OMR', locality: 'Sholinganallur, Chennai', bhk: 2, area: 1000, price: 5500000, propertyType: 'apartment', amenities: ['parking', 'gym', 'lift'],
                coordinates: { lat: 12.9015, lon: 80.2285 }
            },
        ],
    },
    {
        name: 'Ramesh Iyer (Owner)', email: 'ramesh.chn@demo.com', phone: '9200000014',
        sellerType: 'owner', city: 'Chennai',
        properties: [
            {
                title: 'Charming 2BHK Velachery', locality: 'Velachery, Chennai', bhk: 2, area: 950, price: 5800000, propertyType: 'apartment', amenities: ['parking', 'lift', 'power backup'],
                coordinates: { lat: 12.9820, lon: 80.2185 }
            },
        ],
    },
    {
        name: 'Alliance Realtors CHN', email: 'alliance.chn@demo.com', phone: '9200000015',
        sellerType: 'agent', city: 'Chennai',
        properties: [
            // TEXT-ONLY
            { title: 'Spacious 2BHK Anna Nagar', locality: 'Anna Nagar, Chennai', bhk: 2, area: 1100, price: 6200000, propertyType: 'apartment', amenities: ['parking', 'lift', 'security'] },
            {
                title: 'Premium 3BHK Adyar', locality: 'Adyar, Chennai', bhk: 3, area: 1650, price: 11500000, propertyType: 'apartment', amenities: ['parking', 'gym', 'swimming pool', 'garden'],
                coordinates: { lat: 13.0070, lon: 80.2550 }
            },
        ],
    },
];

export async function seedDemoSellers(prisma: PrismaClient): Promise<{
    created: number;
    skipped: number;
    sellers: Array<{ name: string; email: string; password: string }>;
}> {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    let created = 0;
    let skipped = 0;
    const sellers: Array<{ name: string; email: string; password: string }> = [];

    for (const def of DEMO_SELLERS) {
        const existing = await prisma.seller.findUnique({ where: { email: def.email } });
        if (existing) { skipped++; continue; }

        const sellerMeta: Record<string, any> = { source: 'demo-seeder', city: def.city };

        const seller = await prisma.seller.create({
            data: {
                name: def.name, email: def.email, phone: def.phone, passwordHash,
                sellerType: def.sellerType,
                rating: 3.5 + Math.random() * 1.5,      // 3.5 – 5.0
                ratingCount: Math.floor(Math.random() * 20) + 1,
                metadata: JSON.stringify(sellerMeta),
            },
        });

        // Create properties for this seller
        for (const prop of def.properties) {
            const propMeta: Record<string, any> = { source: 'demo-seeder' };

            if (prop.coordinates) {
                propMeta.coordinates = prop.coordinates;
            } else {
                // Attempt geocoding for text-only properties
                try {
                    const query = encodeURIComponent(prop.locality + ', India');
                    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
                    const response = await fetch(url, {
                        headers: { 'User-Agent': 'HubletSeeder/1.0 (hublet@iiit.ac.in)', 'Accept-Language': 'en' },
                    });
                    const data = await response.json() as any[];
                    if (data && data.length > 0) {
                        propMeta.coordinates = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
                        console.log(`  ✓ Geocoded "${prop.locality}" → ${data[0].lat}, ${data[0].lon}`);
                    } else {
                        console.warn(`  ✗ No geocode result for "${prop.locality}"`);
                    }
                    await new Promise(r => setTimeout(r, 1100));
                } catch (e) {
                    console.warn(`  ✗ Geocoding failed for "${prop.locality}":`, e);
                }
            }

            await prisma.property.create({
                data: {
                    sellerId: seller.id,
                    title: prop.title,
                    locality: prop.locality,
                    area: prop.area,
                    bhk: prop.bhk,
                    price: prop.price,
                    propertyType: prop.propertyType,
                    amenities: JSON.stringify(prop.amenities),
                    metadata: JSON.stringify(propMeta),
                },
            });
        }

        created++;
        sellers.push({ name: def.name, email: def.email, password: DEFAULT_PASSWORD });
    }

    console.log(`[seed-demo-sellers] Created ${created} sellers with properties, skipped ${skipped}`);
    return { created, skipped, sellers };
}
