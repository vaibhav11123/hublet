/**
 * seed-demo-buyers.ts
 *
 * Seeds 40 demo buyers across 5 Indian cities (8 per city).
 * Mix of pre-supplied lat/lon and text-only addresses for geocoding tests.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const DEFAULT_PASSWORD = 'buyer123';

interface DemoBuyerDef {
    name: string;
    email: string;
    phone: string;
    bhk: number;
    budgetMin: number;
    budgetMax: number;
    areaMin: number;
    areaMax: number;
    amenities: string[];
    localityCoords?: Array<{ name: string; lat: number; lon: number }>;
    localityText?: string;
    city: string;
}

const DEMO_BUYERS: DemoBuyerDef[] = [
    // ═══════════════════ HYDERABAD (8) ═══════════════════
    {
        name: 'Arjun Reddy', email: 'arjun.hyd@demo.com', phone: '9100000001', bhk: 3, budgetMin: 6000000, budgetMax: 9000000, areaMin: 1200, areaMax: 1800, amenities: ['parking', 'gym', 'power backup'], city: 'Hyderabad',
        localityCoords: [{ name: 'Gachibowli', lat: 17.4401, lon: 78.3489 }, { name: 'Kondapur', lat: 17.4593, lon: 78.3569 }]
    },
    {
        name: 'Priya Sharma', email: 'priya.hyd@demo.com', phone: '9100000002', bhk: 2, budgetMin: 3500000, budgetMax: 5500000, areaMin: 900, areaMax: 1300, amenities: ['parking', 'lift'], city: 'Hyderabad',
        localityCoords: [{ name: 'Madhapur', lat: 17.4484, lon: 78.3908 }]
    },
    {
        name: 'Vikram Rao', email: 'vikram.hyd@demo.com', phone: '9100000003', bhk: 3, budgetMin: 7000000, budgetMax: 12000000, areaMin: 1400, areaMax: 2000, amenities: ['swimming pool', 'gym', 'clubhouse'], city: 'Hyderabad',
        localityText: 'Hitech City, Hyderabad'
    },
    {
        name: 'Deepa Nair', email: 'deepa.hyd@demo.com', phone: '9100000016', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 800, areaMax: 1100, amenities: ['parking', 'security'], city: 'Hyderabad',
        localityCoords: [{ name: 'Kukatpally', lat: 17.4849, lon: 78.3997 }]
    },
    {
        name: 'Ravi Teja', email: 'ravi.hyd@demo.com', phone: '9100000017', bhk: 3, budgetMin: 8000000, budgetMax: 14000000, areaMin: 1500, areaMax: 2200, amenities: ['swimming pool', 'gym', 'clubhouse', 'garden'], city: 'Hyderabad',
        localityCoords: [{ name: 'Jubilee Hills', lat: 17.4325, lon: 78.4071 }, { name: 'Banjara Hills', lat: 17.4156, lon: 78.4347 }]
    },
    {
        name: 'Ananya Reddy', email: 'ananya.hyd@demo.com', phone: '9100000018', bhk: 2, budgetMin: 3000000, budgetMax: 5000000, areaMin: 700, areaMax: 1000, amenities: ['lift', 'power backup'], city: 'Hyderabad',
        localityText: 'Miyapur, Hyderabad'
    },
    {
        name: 'Sai Krishna', email: 'sai.hyd@demo.com', phone: '9100000019', bhk: 3, budgetMin: 5500000, budgetMax: 8500000, areaMin: 1100, areaMax: 1600, amenities: ['parking', 'gym'], city: 'Hyderabad',
        localityCoords: [{ name: 'Nallagandla', lat: 17.4612, lon: 78.3100 }]
    },
    {
        name: 'Kavya Reddy', email: 'kavya.hyd@demo.com', phone: '9100000020', bhk: 2, budgetMin: 4500000, budgetMax: 7000000, areaMin: 900, areaMax: 1300, amenities: ['parking', 'lift', 'security'], city: 'Hyderabad',
        localityCoords: [{ name: 'Manikonda', lat: 17.4052, lon: 78.3870 }]
    },

    // ═══════════════════ BANGALORE (8) ═══════════════════
    {
        name: 'Sneha Iyer', email: 'sneha.blr@demo.com', phone: '9100000004', bhk: 2, budgetMin: 5000000, budgetMax: 8000000, areaMin: 1000, areaMax: 1400, amenities: ['parking', 'gym'], city: 'Bangalore',
        localityCoords: [{ name: 'Whitefield', lat: 12.9698, lon: 77.7500 }, { name: 'Marathahalli', lat: 12.9591, lon: 77.6974 }]
    },
    {
        name: 'Rahul Nair', email: 'rahul.blr@demo.com', phone: '9100000005', bhk: 3, budgetMin: 8000000, budgetMax: 15000000, areaMin: 1500, areaMax: 2200, amenities: ['parking', 'swimming pool', 'gym', 'clubhouse'], city: 'Bangalore',
        localityCoords: [{ name: 'Koramangala', lat: 12.9352, lon: 77.6245 }]
    },
    {
        name: 'Divya Hegde', email: 'divya.blr@demo.com', phone: '9100000006', bhk: 2, budgetMin: 4000000, budgetMax: 6500000, areaMin: 800, areaMax: 1200, amenities: ['lift', 'power backup'], city: 'Bangalore',
        localityText: 'Electronic City, Bangalore'
    },
    {
        name: 'Prasad KV', email: 'prasad.blr@demo.com', phone: '9100000021', bhk: 3, budgetMin: 7000000, budgetMax: 11000000, areaMin: 1300, areaMax: 1900, amenities: ['parking', 'gym', 'garden'], city: 'Bangalore',
        localityCoords: [{ name: 'HSR Layout', lat: 12.9116, lon: 77.6389 }]
    },
    {
        name: 'Amrita Das', email: 'amrita.blr@demo.com', phone: '9100000022', bhk: 2, budgetMin: 5500000, budgetMax: 8500000, areaMin: 900, areaMax: 1300, amenities: ['parking', 'swimming pool'], city: 'Bangalore',
        localityCoords: [{ name: 'Sarjapur Road', lat: 12.9100, lon: 77.6846 }]
    },
    {
        name: 'Nikhil Gowda', email: 'nikhil.blr@demo.com', phone: '9100000023', bhk: 3, budgetMin: 10000000, budgetMax: 18000000, areaMin: 1600, areaMax: 2400, amenities: ['swimming pool', 'gym', 'clubhouse', 'garden'], city: 'Bangalore',
        localityText: 'Indiranagar, Bangalore'
    },
    {
        name: 'Meghana Rao', email: 'meghana.blr@demo.com', phone: '9100000024', bhk: 2, budgetMin: 4500000, budgetMax: 7000000, areaMin: 850, areaMax: 1200, amenities: ['parking', 'lift'], city: 'Bangalore',
        localityCoords: [{ name: 'Bellandur', lat: 12.9260, lon: 77.6762 }]
    },
    {
        name: 'Ajay Kumar BLR', email: 'ajay.blr@demo.com', phone: '9100000025', bhk: 2, budgetMin: 3500000, budgetMax: 5500000, areaMin: 750, areaMax: 1050, amenities: ['lift', 'security'], city: 'Bangalore',
        localityCoords: [{ name: 'BTM Layout', lat: 12.9166, lon: 77.6101 }]
    },

    // ═══════════════════ MUMBAI (8) ═══════════════════
    {
        name: 'Aditya Patil', email: 'aditya.mum@demo.com', phone: '9100000007', bhk: 2, budgetMin: 8000000, budgetMax: 15000000, areaMin: 600, areaMax: 900, amenities: ['parking', 'gym', 'security'], city: 'Mumbai',
        localityCoords: [{ name: 'Andheri West', lat: 19.1364, lon: 72.8296 }]
    },
    {
        name: 'Meera Shah', email: 'meera.mum@demo.com', phone: '9100000008', bhk: 3, budgetMin: 15000000, budgetMax: 25000000, areaMin: 1000, areaMax: 1600, amenities: ['swimming pool', 'gym', 'clubhouse', 'garden'], city: 'Mumbai',
        localityCoords: [{ name: 'Powai', lat: 19.1176, lon: 72.9060 }, { name: 'Vikhroli', lat: 19.1100, lon: 72.9274 }]
    },
    {
        name: 'Rohan Deshmukh', email: 'rohan.mum@demo.com', phone: '9100000009', bhk: 1, budgetMin: 4000000, budgetMax: 7000000, areaMin: 400, areaMax: 650, amenities: ['lift', 'security'], city: 'Mumbai',
        localityText: 'Thane West, Mumbai'
    },
    {
        name: 'Pooja Mehta', email: 'pooja.mum@demo.com', phone: '9100000026', bhk: 2, budgetMin: 10000000, budgetMax: 18000000, areaMin: 700, areaMax: 1000, amenities: ['parking', 'gym', 'swimming pool'], city: 'Mumbai',
        localityCoords: [{ name: 'Goregaon East', lat: 19.1636, lon: 72.8494 }]
    },
    {
        name: 'Sameer Khan', email: 'sameer.mum@demo.com', phone: '9100000027', bhk: 3, budgetMin: 20000000, budgetMax: 35000000, areaMin: 1200, areaMax: 1800, amenities: ['swimming pool', 'gym', 'clubhouse', 'garden', 'security'], city: 'Mumbai',
        localityCoords: [{ name: 'Worli', lat: 19.0176, lon: 72.8177 }]
    },
    {
        name: 'Tanvi Desai', email: 'tanvi.mum@demo.com', phone: '9100000028', bhk: 1, budgetMin: 5000000, budgetMax: 8000000, areaMin: 450, areaMax: 700, amenities: ['lift', 'parking'], city: 'Mumbai',
        localityText: 'Malad West, Mumbai'
    },
    {
        name: 'Varun Joshi MUM', email: 'varun.mum@demo.com', phone: '9100000029', bhk: 2, budgetMin: 9000000, budgetMax: 14000000, areaMin: 650, areaMax: 950, amenities: ['parking', 'gym', 'security'], city: 'Mumbai',
        localityCoords: [{ name: 'Kandivali East', lat: 19.2047, lon: 72.8567 }]
    },
    {
        name: 'Swati Kulkarni MUM', email: 'swati.mum@demo.com', phone: '9100000030', bhk: 2, budgetMin: 7000000, budgetMax: 12000000, areaMin: 600, areaMax: 900, amenities: ['parking', 'lift', 'power backup'], city: 'Mumbai',
        localityCoords: [{ name: 'Borivali West', lat: 19.2307, lon: 72.8567 }]
    },

    // ═══════════════════ PUNE (8) ═══════════════════
    {
        name: 'Anjali Kulkarni', email: 'anjali.pun@demo.com', phone: '9100000010', bhk: 2, budgetMin: 4000000, budgetMax: 6500000, areaMin: 800, areaMax: 1200, amenities: ['parking', 'gym'], city: 'Pune',
        localityCoords: [{ name: 'Hinjewadi', lat: 18.5912, lon: 73.7389 }, { name: 'Wakad', lat: 18.5985, lon: 73.7639 }]
    },
    {
        name: 'Siddharth Joshi', email: 'siddharth.pun@demo.com', phone: '9100000011', bhk: 3, budgetMin: 6000000, budgetMax: 10000000, areaMin: 1200, areaMax: 1800, amenities: ['parking', 'swimming pool', 'clubhouse'], city: 'Pune',
        localityCoords: [{ name: 'Kharadi', lat: 18.5511, lon: 73.9406 }]
    },
    {
        name: 'Nisha Pawar', email: 'nisha.pun@demo.com', phone: '9100000012', bhk: 2, budgetMin: 3500000, budgetMax: 5500000, areaMin: 700, areaMax: 1100, amenities: ['lift', 'power backup'], city: 'Pune',
        localityText: 'Baner, Pune'
    },
    {
        name: 'Omkar Deshpande', email: 'omkar.pun@demo.com', phone: '9100000031', bhk: 3, budgetMin: 7000000, budgetMax: 12000000, areaMin: 1300, areaMax: 1900, amenities: ['parking', 'gym', 'clubhouse', 'garden'], city: 'Pune',
        localityCoords: [{ name: 'Aundh', lat: 18.5582, lon: 73.8069 }]
    },
    {
        name: 'Rashmi Patil', email: 'rashmi.pun@demo.com', phone: '9100000032', bhk: 2, budgetMin: 4500000, budgetMax: 7000000, areaMin: 850, areaMax: 1250, amenities: ['parking', 'lift'], city: 'Pune',
        localityCoords: [{ name: 'Viman Nagar', lat: 18.5679, lon: 73.9143 }]
    },
    {
        name: 'Tejas More', email: 'tejas.pun@demo.com', phone: '9100000033', bhk: 2, budgetMin: 3000000, budgetMax: 4500000, areaMin: 650, areaMax: 950, amenities: ['lift', 'security'], city: 'Pune',
        localityText: 'Hadapsar, Pune'
    },
    {
        name: 'Pooja Gaikwad', email: 'pooja.pun@demo.com', phone: '9100000034', bhk: 3, budgetMin: 5500000, budgetMax: 9000000, areaMin: 1100, areaMax: 1700, amenities: ['parking', 'gym', 'power backup'], city: 'Pune',
        localityCoords: [{ name: 'Balewadi', lat: 18.5748, lon: 73.7700 }]
    },
    {
        name: 'Akash Jadhav', email: 'akash.pun@demo.com', phone: '9100000035', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 800, areaMax: 1150, amenities: ['parking', 'lift', 'security'], city: 'Pune',
        localityCoords: [{ name: 'Pimple Saudagar', lat: 18.5985, lon: 73.7969 }]
    },

    // ═══════════════════ CHENNAI (8) ═══════════════════
    {
        name: 'Karthik Rajan', email: 'karthik.chn@demo.com', phone: '9100000013', bhk: 3, budgetMin: 6000000, budgetMax: 10000000, areaMin: 1200, areaMax: 1800, amenities: ['parking', 'gym', 'power backup'], city: 'Chennai',
        localityCoords: [{ name: 'OMR Perungudi', lat: 12.9625, lon: 80.2413 }, { name: 'Sholinganallur', lat: 12.9010, lon: 80.2279 }]
    },
    {
        name: 'Lakshmi Venkat', email: 'lakshmi.chn@demo.com', phone: '9100000014', bhk: 2, budgetMin: 4000000, budgetMax: 7000000, areaMin: 800, areaMax: 1200, amenities: ['parking', 'lift'], city: 'Chennai',
        localityCoords: [{ name: 'Velachery', lat: 12.9815, lon: 80.2180 }]
    },
    {
        name: 'Suresh Kumar', email: 'suresh.chn@demo.com', phone: '9100000015', bhk: 2, budgetMin: 3000000, budgetMax: 5000000, areaMin: 700, areaMax: 1000, amenities: ['security', 'power backup'], city: 'Chennai',
        localityText: 'Anna Nagar, Chennai'
    },
    {
        name: 'Priya Sundaram', email: 'priya.chn@demo.com', phone: '9100000036', bhk: 3, budgetMin: 7000000, budgetMax: 12000000, areaMin: 1300, areaMax: 1900, amenities: ['parking', 'gym', 'swimming pool'], city: 'Chennai',
        localityCoords: [{ name: 'Adyar', lat: 13.0067, lon: 80.2544 }]
    },
    {
        name: 'Ganesh Raman', email: 'ganesh.chn@demo.com', phone: '9100000037', bhk: 2, budgetMin: 4500000, budgetMax: 7500000, areaMin: 850, areaMax: 1250, amenities: ['parking', 'lift', 'security'], city: 'Chennai',
        localityCoords: [{ name: 'Thoraipakkam', lat: 12.9317, lon: 80.2291 }]
    },
    {
        name: 'Divya Krishnan', email: 'divya.chn@demo.com', phone: '9100000038', bhk: 2, budgetMin: 3500000, budgetMax: 5500000, areaMin: 750, areaMax: 1050, amenities: ['lift', 'power backup'], city: 'Chennai',
        localityText: 'Tambaram, Chennai'
    },
    {
        name: 'Arun Prasad', email: 'arun.chn@demo.com', phone: '9100000039', bhk: 3, budgetMin: 8000000, budgetMax: 14000000, areaMin: 1400, areaMax: 2000, amenities: ['swimming pool', 'gym', 'clubhouse', 'garden'], city: 'Chennai',
        localityCoords: [{ name: 'Nungambakkam', lat: 13.0604, lon: 80.2421 }]
    },
    {
        name: 'Shalini Iyer', email: 'shalini.chn@demo.com', phone: '9100000040', bhk: 2, budgetMin: 5000000, budgetMax: 8000000, areaMin: 800, areaMax: 1200, amenities: ['parking', 'gym'], city: 'Chennai',
        localityCoords: [{ name: 'Porur', lat: 13.0358, lon: 80.1577 }]
    },
];

export async function seedDemoBuyers(prisma: PrismaClient): Promise<{
    created: number;
    skipped: number;
    buyers: Array<{ name: string; email: string; password: string; city: string }>;
}> {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    let created = 0;
    let skipped = 0;
    const buyers: Array<{ name: string; email: string; password: string; city: string }> = [];

    for (const def of DEMO_BUYERS) {
        const existing = await prisma.buyer.findUnique({ where: { email: def.email } });
        if (existing) { skipped++; continue; }

        const metadata: Record<string, any> = { source: 'demo-seeder', city: def.city };

        if (def.localityCoords) {
            metadata.localityCoords = def.localityCoords;
        }

        if (def.localityText) {
            metadata.localityText = def.localityText;
            try {
                const query = encodeURIComponent(def.localityText + ', India');
                const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'HubletSeeder/1.0 (hublet@iiit.ac.in)', 'Accept-Language': 'en' },
                });
                const data = await response.json() as any[];
                if (data && data.length > 0) {
                    metadata.localityCoords = [{ name: def.localityText, lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }];
                    console.log(`  ✓ Geocoded "${def.localityText}" → ${data[0].lat}, ${data[0].lon}`);
                } else {
                    console.warn(`  ✗ No geocode result for "${def.localityText}"`);
                }
                await new Promise(r => setTimeout(r, 1100));
            } catch (e) {
                console.warn(`  ✗ Geocoding failed for "${def.localityText}":`, e);
            }
        }

        await prisma.buyer.create({
            data: {
                name: def.name, email: def.email, phone: def.phone, passwordHash,
                bhk: def.bhk, budgetMin: def.budgetMin, budgetMax: def.budgetMax,
                areaMin: def.areaMin, areaMax: def.areaMax,
                amenities: JSON.stringify(def.amenities),
                metadata: JSON.stringify(metadata),
            },
        });

        created++;
        buyers.push({ name: def.name, email: def.email, password: DEFAULT_PASSWORD, city: def.city });
    }

    console.log(`[seed-demo-buyers] Created ${created}, skipped ${skipped}`);
    return { created, skipped, buyers };
}
