import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database (clean install: organization plus one login per role)...');

  let organization = await prisma.organization.findUnique({
    where: { name: 'Ricoz Demo Organization' },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'Ricoz Demo Organization',
      },
    });
  }

  console.log(`Using organization: ${organization.name} (${organization.id})`);

  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@ricoz.local' },
    update: { passwordHash: adminPasswordHash, role: 'SUPER_ADMIN' },
    create: {
      organizationId: organization.id,
      email: 'admin@ricoz.local',
      name: 'System Admin',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
    },
  });

  console.log(`Upserted admin user: ${adminUser.email}`);

  const operatorPasswordHash = await bcrypt.hash('operator123', 10);
  const viewerPasswordHash = await bcrypt.hash('viewer123', 10);
  const orgAdminPasswordHash = await bcrypt.hash('orgadmin123', 10);
  const itAdminPasswordHash = await bcrypt.hash('itadmin123', 10);

  await prisma.user.upsert({
    where: { email: 'orgadmin@ricoz.local' },
    update: { passwordHash: orgAdminPasswordHash, role: 'ORG_ADMIN' },
    create: {
      organizationId: organization.id,
      email: 'orgadmin@ricoz.local',
      name: 'Organization Admin',
      passwordHash: orgAdminPasswordHash,
      role: 'ORG_ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'itadmin@ricoz.local' },
    update: { passwordHash: itAdminPasswordHash, role: 'IT_ADMIN', isDemoAccount: true },
    create: {
      organizationId: organization.id,
      email: 'itadmin@ricoz.local',
      name: 'IT Administrator',
      passwordHash: itAdminPasswordHash,
      role: 'IT_ADMIN',
      isDemoAccount: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'operator@ricoz.local' },
    update: { passwordHash: operatorPasswordHash, role: 'OPERATOR', isDemoAccount: true },
    create: {
      organizationId: organization.id,
      email: 'operator@ricoz.local',
      name: 'IT Operator',
      passwordHash: operatorPasswordHash,
      role: 'OPERATOR',
      isDemoAccount: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@ricoz.local' },
    update: { passwordHash: viewerPasswordHash, role: 'VIEWER', isDemoAccount: true },
    create: {
      organizationId: organization.id,
      email: 'viewer@ricoz.local',
      name: 'Read Only User',
      passwordHash: viewerPasswordHash,
      role: 'VIEWER',
      isDemoAccount: true,
    },
  });

  console.log('Upserted role accounts: admin@ricoz.local, orgadmin@ricoz.local, itadmin@ricoz.local, operator@ricoz.local, viewer@ricoz.local');

  // Clean installs intentionally start with an empty operational dataset. Devices,
  // policies, alerts, commands, compliance results, enrollment tokens, and
  // audit entries appear only through normal API/agent activity.
  console.log('Database seeding complete: organization plus one login per role.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });