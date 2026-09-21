import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const organization = await prisma.organization.create({
    data: {
      name: 'Ricoz Demo Organization',
    },
  });

  console.log(`Created organization: ${organization.name} (${organization.id})`);

  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const operatorPasswordHash = await bcrypt.hash('operator123', 10);
  const viewerPasswordHash = await bcrypt.hash('viewer123', 10);

  const adminUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'admin@ricoz.local',
      name: 'System Admin',
      passwordHash: adminPasswordHash,
      role: 'SUPER_ADMIN',
    },
  });

  const operatorUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'operator@ricoz.local',
      name: 'IT Operator',
      passwordHash: operatorPasswordHash,
      role: 'OPERATOR',
    },
  });

  const viewerUser = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'viewer@ricoz.local',
      name: 'Read Only User',
      passwordHash: viewerPasswordHash,
      role: 'VIEWER',
    },
  });

  console.log(`Created users: ${adminUser.email}, ${operatorUser.email}, ${viewerUser.email}`);

  const demoDevices = [
    {
      deviceName: 'DESKTOP-WKS-001',
      hostname: 'DESKTOP-WKS-001',
      serialNumber: 'SN-DEMO-001',
      manufacturer: 'Dell',
      model: 'OptiPlex 7090',
      os: 'Windows',
      osVersion: 'Windows 11 Pro 23H2',
      architecture: 'x64',
      ipAddress: '192.168.1.101',
      agentVersion: '0.1.0',
      status: 'ONLINE',
      lastSeenAt: new Date(),
    },
    {
      deviceName: 'DESKTOP-WKS-002',
      hostname: 'DESKTOP-WKS-002',
      serialNumber: 'SN-DEMO-002',
      manufacturer: 'HP',
      model: 'EliteDesk 800 G9',
      os: 'Windows',
      osVersion: 'Windows 11 Enterprise 23H2',
      architecture: 'x64',
      ipAddress: '192.168.1.102',
      agentVersion: '0.1.0',
      status: 'ONLINE',
      lastSeenAt: new Date(Date.now() - 60_000),
    },
    {
      deviceName: 'LAPTOP-SALES-003',
      hostname: 'LAPTOP-SALES-003',
      serialNumber: 'SN-DEMO-003',
      manufacturer: 'Lenovo',
      model: 'ThinkPad X1 Carbon Gen 11',
      os: 'Windows',
      osVersion: 'Windows 10 Pro 22H2',
      architecture: 'x64',
      ipAddress: '192.168.1.103',
      agentVersion: '0.1.0',
      status: 'OFFLINE',
      lastSeenAt: new Date(Date.now() - 3_600_000),
    },
    {
      deviceName: 'SRV-APPS-004',
      hostname: 'SRV-APPS-004',
      serialNumber: 'SN-DEMO-004',
      manufacturer: 'Dell',
      model: 'PowerEdge R750',
      os: 'Windows Server',
      osVersion: 'Windows Server 2022 Datacenter',
      architecture: 'x64',
      ipAddress: '192.168.1.200',
      agentVersion: '0.1.0',
      status: 'ONLINE',
      lastSeenAt: new Date(Date.now() - 120_000),
    },
    {
      deviceName: 'DESKTOP-HR-005',
      hostname: 'DESKTOP-HR-005',
      serialNumber: 'SN-DEMO-005',
      manufacturer: 'HP',
      model: 'ProBook 450 G10',
      os: 'Windows',
      osVersion: 'Windows 11 Home 23H2',
      architecture: 'x64',
      ipAddress: '192.168.1.105',
      agentVersion: '0.1.0',
      status: 'PENDING',
      lastSeenAt: null,
    },
  ];

  for (const deviceData of demoDevices) {
    const device = await prisma.device.create({
      data: {
        organizationId: organization.id,
        ...deviceData,
      },
    });

    await prisma.deviceHardware.create({
      data: {
        deviceId: device.id,
        cpu: 'Intel Core i7-12700',
        cpuCores: 12,
        ramBytes: BigInt(16) * BigInt(1024) * BigInt(1024) * BigInt(1024),
        storageBytes: BigInt(512) * BigInt(1024) * BigInt(1024) * BigInt(1024),
        manufacturer: deviceData.manufacturer,
        model: deviceData.model,
        serialNumber: deviceData.serialNumber,
        biosVersion: '1.5.0',
      },
    });

    await prisma.deviceSoftware.createMany({
      data: [
        { deviceId: device.id, name: 'Microsoft Office 365', version: '16.0.17126', publisher: 'Microsoft Corporation', installDate: new Date('2024-01-15'), architecture: 'x64' },
        { deviceId: device.id, name: 'Google Chrome', version: '120.0.6099', publisher: 'Google LLC', installDate: new Date('2024-02-01'), architecture: 'x64' },
        { deviceId: device.id, name: 'Mozilla Firefox', version: '121.0', publisher: 'Mozilla Foundation', installDate: new Date('2024-01-20'), architecture: 'x64' },
        { deviceId: device.id, name: 'Visual Studio Code', version: '1.85.1', publisher: 'Microsoft Corporation', installDate: new Date('2024-03-01'), architecture: 'x64' },
      ],
    });
  }

  console.log(`Created ${demoDevices.length} demo devices with hardware and software`);

  const policy = await prisma.policy.create({
    data: {
      organizationId: organization.id,
      name: 'Corporate Security Baseline',
      type: 'SECURITY',
      description: 'Standard security policy for all managed devices',
      settings: JSON.stringify({
        firewallRequired: true,
        antivirusRequired: true,
        autoLockTimeout: 900,
        minimumPasswordLength: 12,
        requirePasswordComplexity: true,
      }),
    },
  });

  console.log(`Created policy: ${policy.name}`);

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      actorId: adminUser.id,
      action: 'SEED_COMPLETE',
      resource: 'SYSTEM',
      resourceId: organization.id,
      ipAddress: '127.0.0.1',
      metadata: JSON.stringify({ message: 'Database seeded successfully' }),
    },
  });

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
