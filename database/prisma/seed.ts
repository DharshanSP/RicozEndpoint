import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

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
  const operatorPasswordHash = await bcrypt.hash('operator123', 10);
  const viewerPasswordHash = await bcrypt.hash('viewer123', 10);

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

  const operatorUser = await prisma.user.upsert({
    where: { email: 'operator@ricoz.local' },
    update: { passwordHash: operatorPasswordHash, role: 'OPERATOR' },
    create: {
      organizationId: organization.id,
      email: 'operator@ricoz.local',
      name: 'IT Operator',
      passwordHash: operatorPasswordHash,
      role: 'OPERATOR',
    },
  });

  await prisma.user.upsert({
    where: { email: 'viewer@ricoz.local' },
    update: { passwordHash: viewerPasswordHash, role: 'VIEWER' },
    create: {
      organizationId: organization.id,
      email: 'viewer@ricoz.local',
      name: 'Read Only User',
      passwordHash: viewerPasswordHash,
      role: 'VIEWER',
    },
  });

  console.log(`Upserted users: ${adminUser.email}, operator@ricoz.local, viewer@ricoz.local`);

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
    const device = await prisma.device.upsert({
      where: {
        organizationId_serialNumber: {
          organizationId: organization.id,
          serialNumber: deviceData.serialNumber,
        },
      },
      update: {
        ...deviceData,
      },
      create: {
        organizationId: organization.id,
        ...deviceData,
      },
    });

    await prisma.deviceHardware.upsert({
      where: { deviceId: device.id },
      update: {
        cpu: 'Intel Core i7-12700',
        cpuCores: 12,
        ramBytes: BigInt(16) * BigInt(1024) * BigInt(1024) * BigInt(1024),
        storageBytes: BigInt(512) * BigInt(1024) * BigInt(1024) * BigInt(1024),
        manufacturer: deviceData.manufacturer,
        model: deviceData.model,
        serialNumber: deviceData.serialNumber,
        biosVersion: '1.5.0',
      },
      create: {
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

    const swItems = [
      { name: 'Microsoft Office 365', version: '16.0.17126', publisher: 'Microsoft Corporation', installDate: new Date('2024-01-15'), architecture: 'x64' },
      { name: 'Google Chrome', version: '120.0.6099', publisher: 'Google LLC', installDate: new Date('2024-02-01'), architecture: 'x64' },
      { name: 'Mozilla Firefox', version: '121.0', publisher: 'Mozilla Foundation', installDate: new Date('2024-01-20'), architecture: 'x64' },
      { name: 'Visual Studio Code', version: '1.85.1', publisher: 'Microsoft Corporation', installDate: new Date('2024-03-01'), architecture: 'x64' },
    ];

    for (const sw of swItems) {
      const existingSw = await prisma.deviceSoftware.findFirst({
        where: { deviceId: device.id, name: sw.name },
      });
      if (!existingSw) {
        await prisma.deviceSoftware.create({
          data: { deviceId: device.id, ...sw },
        });
      }
    }
  }

  console.log(`Seeded demo devices with hardware and software`);

  const existingPolicy = await prisma.policy.findFirst({
    where: { organizationId: organization.id, name: 'Corporate Security Baseline' },
  });

  if (!existingPolicy) {
    await prisma.policy.create({
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
  }

  // Seed audit logs for the organization (tied to admin user)
  const auditLogCount = await prisma.auditLog.count({
    where: { organizationId: organization.id, actorId: adminUser.id },
  });

  if (auditLogCount < 6) {
    const auditActions = [
      { action: 'USER_LOGIN', resource: 'USER', resourceId: adminUser.id },
      { action: 'DEVICE_ENROLLED', resource: 'DEVICE', resourceId: adminUser.id },
      { action: 'POLICY_CREATED', resource: 'POLICY', resourceId: adminUser.id },
      { action: 'POLICY_UPDATED', resource: 'POLICY', resourceId: adminUser.id },
      { action: 'DEVICE_SCANNED', resource: 'DEVICE', resourceId: adminUser.id },
      { action: 'ALERT_RESOLVED', resource: 'ALERT', resourceId: adminUser.id },
    ];

    for (const entry of auditActions) {
      await prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: adminUser.id,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          ipAddress: '127.0.0.1',
          metadata: JSON.stringify({ seeded: true }),
        },
      });
    }
    console.log('Seeded audit log entries');
  }

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
