import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const sellers = await prisma.seller.findMany();
  console.log("Found", sellers.length, "sellers");
  
  if (sellers.length > 0) {
      console.log("Seller IDs:", sellers.map(s => s.id));
  }
}
run();