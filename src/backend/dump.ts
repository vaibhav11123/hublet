import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log('Dumping SQLite Data...');
    
    const buyers = await prisma.buyer.findMany();
    const sellers = await prisma.seller.findMany();
    const properties = await prisma.property.findMany();
    const leads = await prisma.lead.findMany();
    const matches = await prisma.match.findMany();
    const workflowEvents = await prisma.workflowEvent.findMany();

    const dump = { buyers, sellers, properties, leads, matches, workflowEvents };

    fs.writeFileSync('data-dump.json', JSON.stringify(dump, null, 2));
    
    console.log('Data successfully saved to data-dump.json file!');
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })