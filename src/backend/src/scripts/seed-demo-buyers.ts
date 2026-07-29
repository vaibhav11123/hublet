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

    // ═══════════════════ KOLKATA (8) ═══════════════════
    {
        name: 'Sourav Banerjee', email: 'sourav.kol@demo.com', phone: '9100000041', bhk: 2, budgetMin: 5000000, budgetMax: 8000000, areaMin: 900, areaMax: 1300, amenities: ['parking', 'gym'], city: 'Kolkata',
        localityCoords: [{ name: 'Salt Lake Sector V', lat: 22.5745, lon: 88.4335 }]
    },
    {
        name: 'Riya Chatterjee', email: 'riya.kol@demo.com', phone: '9100000042', bhk: 3, budgetMin: 8000000, budgetMax: 12000000, areaMin: 1300, areaMax: 1800, amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'], city: 'Kolkata',
        localityCoords: [{ name: 'New Town', lat: 22.5809, lon: 88.4831 }]
    },
    {
        name: 'Abhishek Das', email: 'abhishek.kol@demo.com', phone: '9100000043', bhk: 2, budgetMin: 6000000, budgetMax: 9000000, areaMin: 850, areaMax: 1200, amenities: ['lift', 'security'], city: 'Kolkata',
        localityText: 'Ballygunge, Kolkata'
    },
    {
        name: 'Sudipa Mukherjee', email: 'sudipa.kol@demo.com', phone: '9100000044', bhk: 3, budgetMin: 10000000, budgetMax: 14000000, areaMin: 1350, areaMax: 1900, amenities: ['parking', 'gym', 'security'], city: 'Kolkata',
        localityText: 'Park Street, Kolkata'
    },
    {
        name: 'Arindam Sen', email: 'arindam.kol@demo.com', phone: '9100000045', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 900, areaMax: 1250, amenities: ['parking', 'lift', 'power backup'], city: 'Kolkata',
        localityCoords: [{ name: 'Rajarhat', lat: 22.6160, lon: 88.4796 }]
    },
    {
        name: 'Piyali Roy', email: 'piyali.kol@demo.com', phone: '9100000046', bhk: 2, budgetMin: 5000000, budgetMax: 7500000, areaMin: 950, areaMax: 1300, amenities: ['parking', 'gym', 'power backup'], city: 'Kolkata',
        localityCoords: [{ name: 'Salt Lake Sector V', lat: 22.5745, lon: 88.4335 }]
    },
    {
        name: 'Debjit Chakraborty', email: 'debjit.kol@demo.com', phone: '9100000047', bhk: 3, budgetMin: 8000000, budgetMax: 11000000, areaMin: 1300, areaMax: 1800, amenities: ['parking', 'gym', 'swimming pool'], city: 'Kolkata',
        localityCoords: [{ name: 'New Town', lat: 22.5809, lon: 88.4831 }]
    },
    {
        name: 'Moumita Ghosh', email: 'moumita.kol@demo.com', phone: '9100000048', bhk: 2, budgetMin: 4500000, budgetMax: 7000000, areaMin: 850, areaMax: 1200, amenities: ['lift', 'security', 'power backup'], city: 'Kolkata',
        localityCoords: [{ name: 'Ballygunge', lat: 22.5301, lon: 88.3646 }]
    },

    // ═══════════════════ AHMEDABAD (8) ═══════════════════
    {
        name: 'Nikunj Shah', email: 'nikunj.amd@demo.com', phone: '9100000049', bhk: 3, budgetMin: 8000000, budgetMax: 11000000, areaMin: 1400, areaMax: 1900, amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'], city: 'Ahmedabad',
        localityCoords: [{ name: 'Satellite', lat: 23.0225, lon: 72.5150 }]
    },
    {
        name: 'Foram Trivedi', email: 'foram.amd@demo.com', phone: '9100000050', bhk: 2, budgetMin: 5000000, budgetMax: 7500000, areaMin: 950, areaMax: 1350, amenities: ['parking', 'gym'], city: 'Ahmedabad',
        localityCoords: [{ name: 'SG Highway', lat: 23.0396, lon: 72.5066 }]
    },
    {
        name: 'Jignesh Patel', email: 'jignesh.amd@demo.com', phone: '9100000051', bhk: 2, budgetMin: 5500000, budgetMax: 8000000, areaMin: 900, areaMax: 1300, amenities: ['parking', 'lift', 'security'], city: 'Ahmedabad',
        localityCoords: [{ name: 'Vastrapur', lat: 23.0367, lon: 72.5297 }]
    },
    {
        name: 'Payal Desai', email: 'payal.amd@demo.com', phone: '9100000052', bhk: 3, budgetMin: 7000000, budgetMax: 10000000, areaMin: 1400, areaMax: 1900, amenities: ['parking', 'gym', 'garden'], city: 'Ahmedabad',
        localityText: 'Bopal, Ahmedabad'
    },
    {
        name: 'Mitul Joshi', email: 'mitul.amd@demo.com', phone: '9100000053', bhk: 2, budgetMin: 6000000, budgetMax: 9000000, areaMin: 950, areaMax: 1350, amenities: ['parking', 'gym', 'swimming pool'], city: 'Ahmedabad',
        localityCoords: [{ name: 'Prahlad Nagar', lat: 23.0126, lon: 72.5075 }]
    },
    {
        name: 'Hardik Mehta', email: 'hardik.amd@demo.com', phone: '9100000054', bhk: 3, budgetMin: 8500000, budgetMax: 12000000, areaMin: 1450, areaMax: 2000, amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'], city: 'Ahmedabad',
        localityCoords: [{ name: 'Satellite', lat: 23.0225, lon: 72.5150 }]
    },
    {
        name: 'Bhavna Shah', email: 'bhavna.amd@demo.com', phone: '9100000055', bhk: 2, budgetMin: 4500000, budgetMax: 7000000, areaMin: 900, areaMax: 1250, amenities: ['parking', 'lift'], city: 'Ahmedabad',
        localityCoords: [{ name: 'SG Highway', lat: 23.0396, lon: 72.5066 }]
    },
    {
        name: 'Ketan Solanki', email: 'ketan.amd@demo.com', phone: '9100000056', bhk: 2, budgetMin: 5000000, budgetMax: 7500000, areaMin: 950, areaMax: 1300, amenities: ['parking', 'gym', 'swimming pool'], city: 'Ahmedabad',
        localityCoords: [{ name: 'Prahlad Nagar', lat: 23.0126, lon: 72.5075 }]
    },

    // ═══════════════════ JAIPUR (8) ═══════════════════
    {
        name: 'Rohit Agarwal', email: 'rohit.jai@demo.com', phone: '9100000057', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 900, areaMax: 1250, amenities: ['parking', 'gym', 'power backup'], city: 'Jaipur',
        localityCoords: [{ name: 'Vaishali Nagar', lat: 26.9123, lon: 75.7373 }]
    },
    {
        name: 'Neha Gupta', email: 'neha.jai@demo.com', phone: '9100000058', bhk: 3, budgetMin: 6500000, budgetMax: 9500000, areaMin: 1350, areaMax: 1850, amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'], city: 'Jaipur',
        localityCoords: [{ name: 'Jagatpura', lat: 26.8206, lon: 75.8280 }]
    },
    {
        name: 'Manish Sharma', email: 'manish.jai@demo.com', phone: '9100000059', bhk: 2, budgetMin: 4500000, budgetMax: 6500000, areaMin: 850, areaMax: 1200, amenities: ['parking', 'lift', 'security'], city: 'Jaipur',
        localityCoords: [{ name: 'Malviya Nagar', lat: 26.8535, lon: 75.8072 }]
    },
    {
        name: 'Sunita Rathore', email: 'sunita.jai@demo.com', phone: '9100000060', bhk: 3, budgetMin: 9000000, budgetMax: 13000000, areaMin: 1500, areaMax: 2000, amenities: ['parking', 'gym', 'security'], city: 'Jaipur',
        localityText: 'C-Scheme, Jaipur'
    },
    {
        name: 'Vikas Choudhary', email: 'vikas.jai@demo.com', phone: '9100000061', bhk: 2, budgetMin: 3500000, budgetMax: 5000000, areaMin: 750, areaMax: 1050, amenities: ['lift', 'power backup', 'security'], city: 'Jaipur',
        localityCoords: [{ name: 'Mansarovar', lat: 26.8505, lon: 75.7590 }]
    },
    {
        name: 'Pooja Sharma JAI', email: 'pooja.jai@demo.com', phone: '9100000062', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 900, areaMax: 1250, amenities: ['parking', 'gym', 'power backup'], city: 'Jaipur',
        localityCoords: [{ name: 'Vaishali Nagar', lat: 26.9123, lon: 75.7373 }]
    },
    {
        name: 'Anil Jain', email: 'anil.jai@demo.com', phone: '9100000063', bhk: 3, budgetMin: 7000000, budgetMax: 10000000, areaMin: 1350, areaMax: 1850, amenities: ['parking', 'gym', 'clubhouse'], city: 'Jaipur',
        localityCoords: [{ name: 'Jagatpura', lat: 26.8206, lon: 75.8280 }]
    },
    {
        name: 'Kavita Meena', email: 'kavita.jai@demo.com', phone: '9100000064', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 800, areaMax: 1100, amenities: ['lift', 'power backup'], city: 'Jaipur',
        localityCoords: [{ name: 'Mansarovar', lat: 26.8505, lon: 75.7590 }]
    },

    // ═══════════════════ KOCHI (8) ═══════════════════
    {
        name: 'Anoop Nair', email: 'anoop.koc@demo.com', phone: '9100000065', bhk: 2, budgetMin: 5000000, budgetMax: 7500000, areaMin: 950, areaMax: 1300, amenities: ['parking', 'gym', 'power backup'], city: 'Kochi',
        localityCoords: [{ name: 'Kakkanad', lat: 10.0159, lon: 76.3419 }]
    },
    {
        name: 'Sreelakshmi Menon', email: 'sreelakshmi.koc@demo.com', phone: '9100000066', bhk: 3, budgetMin: 8000000, budgetMax: 11000000, areaMin: 1350, areaMax: 1850, amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'], city: 'Kochi',
        localityCoords: [{ name: 'Edappally', lat: 10.0258, lon: 76.3086 }]
    },
    {
        name: 'Jose Thomas', email: 'jose.koc@demo.com', phone: '9100000067', bhk: 3, budgetMin: 10000000, budgetMax: 14000000, areaMin: 1350, areaMax: 1850, amenities: ['parking', 'gym', 'security', 'garden'], city: 'Kochi',
        localityCoords: [{ name: 'Panampilly Nagar', lat: 9.9658, lon: 76.2894 }]
    },
    {
        name: 'Anjali Pillai', email: 'anjali.koc@demo.com', phone: '9100000068', bhk: 2, budgetMin: 7000000, budgetMax: 9500000, areaMin: 900, areaMax: 1250, amenities: ['parking', 'security', 'lift'], city: 'Kochi',
        localityText: 'Marine Drive, Kochi'
    },
    {
        name: 'Bibin Varghese', email: 'bibin.koc@demo.com', phone: '9100000069', bhk: 2, budgetMin: 3500000, budgetMax: 5500000, areaMin: 800, areaMax: 1100, amenities: ['lift', 'power backup'], city: 'Kochi',
        localityCoords: [{ name: 'Vyttila', lat: 9.9668, lon: 76.3186 }]
    },
    {
        name: 'Divya Krishnan KOC', email: 'divyak.koc@demo.com', phone: '9100000070', bhk: 2, budgetMin: 5000000, budgetMax: 7500000, areaMin: 950, areaMax: 1300, amenities: ['parking', 'gym', 'power backup'], city: 'Kochi',
        localityCoords: [{ name: 'Kakkanad', lat: 10.0159, lon: 76.3419 }]
    },
    {
        name: 'Renjith Kumar', email: 'renjith.koc@demo.com', phone: '9100000071', bhk: 3, budgetMin: 8000000, budgetMax: 11000000, areaMin: 1350, areaMax: 1850, amenities: ['parking', 'gym', 'swimming pool'], city: 'Kochi',
        localityCoords: [{ name: 'Edappally', lat: 10.0258, lon: 76.3086 }]
    },
    {
        name: 'Athira Suresh', email: 'athira.koc@demo.com', phone: '9100000072', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 800, areaMax: 1100, amenities: ['lift', 'power backup'], city: 'Kochi',
        localityCoords: [{ name: 'Vyttila', lat: 9.9668, lon: 76.3186 }]
    },

    // ═══════════════════ LUCKNOW (8) ═══════════════════
    {
        name: 'Abhinav Srivastava', email: 'abhinav.lko@demo.com', phone: '9100000073', bhk: 3, budgetMin: 7000000, budgetMax: 10000000, areaMin: 1350, areaMax: 1850, amenities: ['parking', 'gym', 'swimming pool', 'clubhouse'], city: 'Lucknow',
        localityCoords: [{ name: 'Gomti Nagar', lat: 26.8467, lon: 80.9986 }]
    },
    {
        name: 'Shreya Tiwari', email: 'shreya.lko@demo.com', phone: '9100000074', bhk: 2, budgetMin: 4500000, budgetMax: 6500000, areaMin: 900, areaMax: 1300, amenities: ['parking', 'gym'], city: 'Lucknow',
        localityCoords: [{ name: 'Vibhuti Khand', lat: 26.8598, lon: 80.9982 }]
    },
    {
        name: 'Rahul Mishra', email: 'rahul.lko@demo.com', phone: '9100000075', bhk: 2, budgetMin: 3500000, budgetMax: 5500000, areaMin: 850, areaMax: 1200, amenities: ['parking', 'lift', 'security'], city: 'Lucknow',
        localityCoords: [{ name: 'Indira Nagar', lat: 26.8770, lon: 80.9740 }]
    },
    {
        name: 'Anjali Verma LKO', email: 'anjali.lko@demo.com', phone: '9100000076', bhk: 3, budgetMin: 8000000, budgetMax: 11000000, areaMin: 1300, areaMax: 1800, amenities: ['parking', 'security', 'power backup'], city: 'Lucknow',
        localityText: 'Hazratganj, Lucknow'
    },
    {
        name: 'Sanjay Pandey', email: 'sanjay.lko@demo.com', phone: '9100000077', bhk: 2, budgetMin: 3000000, budgetMax: 4500000, areaMin: 750, areaMax: 1000, amenities: ['lift', 'power backup'], city: 'Lucknow',
        localityCoords: [{ name: 'Alambagh', lat: 26.8028, lon: 80.9077 }]
    },
    {
        name: 'Priyanka Dubey', email: 'priyanka.lko@demo.com', phone: '9100000078', bhk: 3, budgetMin: 7000000, budgetMax: 10000000, areaMin: 1350, areaMax: 1850, amenities: ['parking', 'gym', 'swimming pool'], city: 'Lucknow',
        localityCoords: [{ name: 'Gomti Nagar', lat: 26.8467, lon: 80.9986 }]
    },
    {
        name: 'Ashish Tripathi', email: 'ashish.lko@demo.com', phone: '9100000079', bhk: 2, budgetMin: 4000000, budgetMax: 6000000, areaMin: 900, areaMax: 1300, amenities: ['parking', 'gym'], city: 'Lucknow',
        localityCoords: [{ name: 'Vibhuti Khand', lat: 26.8598, lon: 80.9982 }]
    },
    {
        name: 'Neelam Singh', email: 'neelam.lko@demo.com', phone: '9100000080', bhk: 2, budgetMin: 3000000, budgetMax: 4500000, areaMin: 750, areaMax: 1000, amenities: ['lift', 'power backup'], city: 'Lucknow',
        localityCoords: [{ name: 'Alambagh', lat: 26.8028, lon: 80.9077 }]
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
