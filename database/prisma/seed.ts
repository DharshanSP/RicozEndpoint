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

  const complianceRulesData = [
    { name: 'Disk Encryption (BitLocker / FileVault)', ruleType: 'ENCRYPTION', condition: JSON.stringify({ encrypted: true }) },
    { name: 'Host Firewall Active', ruleType: 'FIREWALL', condition: JSON.stringify({ firewallEnabled: true }) },
    { name: 'EDR Agent Running', ruleType: 'PROCESS', condition: JSON.stringify({ processName: 'edr-agent' }) },
    { name: 'Critical Security Patches Up-to-Date', ruleType: 'PATCH', condition: JSON.stringify({ criticalPatches: 0 }) },
    { name: 'Antivirus Real-Time Protection', ruleType: 'PROCESS', condition: JSON.stringify({ realTimeProtection: true }) },
    { name: 'Auto-Lock Timeout Configured', ruleType: 'CONFIGURATION', condition: JSON.stringify({ autoLockTimeout: 900 }) },
  ];

  const complianceRules = [];
  for (const ruleData of complianceRulesData) {
    const rule = await prisma.complianceRule.create({
      data: {
        organizationId: organization.id,
        name: ruleData.name,
        description: `${ruleData.name} compliance evaluation`,
        ruleType: ruleData.ruleType,
        condition: ruleData.condition,
      },
    });
    complianceRules.push(rule);

    for (const device of await prisma.device.findMany({ where: { organizationId: organization.id } })) {
      const isCompliant = device.status === 'ONLINE' || device.status === 'OFFLINE';
      await prisma.complianceResult.create({
        data: {
          deviceId: device.id,
          ruleId: rule.id,
          status: isCompliant ? 'COMPLIANT' : 'NON_COMPLIANT',
          reason: isCompliant ? 'Rule condition satisfied' : 'Rule condition not satisfied',
          evaluatedAt: new Date(),
        },
      });
    }
  }

  console.log(`Created ${complianceRules.length} compliance rules with results`);

  const alertSeeds = [
    { severity: 'CRITICAL', title: 'EDR Agent Terminated Unexpectedly', message: 'Endpoint protection agent stopped responding on device', status: 'OPEN', timeOffset: 12 * 60_000 },
    { severity: 'WARNING', title: 'Pending OS Security Update > 14 Days', message: 'Critical operating system update is overdue on device', status: 'OPEN', timeOffset: 3 * 60 * 60_000 },
    { severity: 'WARNING', title: 'Firewall Configuration Drift Detected', message: 'Host firewall rules deviate from organizational baseline', status: 'OPEN', timeOffset: 26 * 60_000 },
    { severity: 'INFO', title: 'Software Inventory Stale', message: 'Software inventory collection has not reported for 24 hours', status: 'OPEN', timeOffset: 5 * 60 * 60_000 },
  ];

  const seededDevices = await prisma.device.findMany({
    where: { organizationId: organization.id, status: { not: 'PENDING' } },
    orderBy: { registeredAt: 'asc' },
  });

  const alerts = [];
  for (let i = 0; i < alertSeeds.length; i++) {
    const seed = alertSeeds[i];
    const device = seededDevices[i % seededDevices.length];
    const alert = await prisma.alert.create({
      data: {
        organizationId: organization.id,
        deviceId: device?.id ?? null,
        severity: seed.severity,
        title: seed.title,
        message: seed.message,
        status: seed.status,
        createdAt: new Date(Date.now() - seed.timeOffset),
      },
    });
    alerts.push(alert);
  }

  console.log(`Created ${alerts.length} security alerts`);

  const auditEvents = [
    { action: 'DEVICE_ENROLLED', resource: 'DEVICE', resourceId: 'fleet', ipAddress: '127.0.0.1', metadata: { count: 5 }, timeOffset: 2 * 60 * 60_000 },
    { action: 'POLICY_CREATED', resource: 'POLICY', resourceId: 'corporate-security', ipAddress: '127.0.0.1', metadata: { name: 'Corporate Security Baseline' }, timeOffset: 4 * 60 * 60_000 },
    { action: 'USER_LOGIN', resource: 'AUTH', resourceId: 'system', ipAddress: '127.0.0.1', metadata: { email: 'admin@ricoz.local' }, timeOffset: 6 * 60 * 60_000 },
    { action: 'COMPLIANCE_EVALUATED', resource: 'COMPLIANCE', resourceId: 'fleet', ipAddress: '127.0.0.1', metadata: { scope: 'organization' }, timeOffset: 8 * 60 * 60_000 },
    { action: 'ALERT_ACKNOWLEDGED', resource: 'ALERT', resourceId: 'triage', ipAddress: '127.0.0.1', metadata: { count: 1 }, timeOffset: 10 * 60 * 60_000 },
    { action: 'SEED_COMPLETE', resource: 'SYSTEM', resourceId: organization.id, ipAddress: '127.0.0.1', metadata: { message: 'Database seeded successfully' }, timeOffset: 12 * 60 * 60_000 },
  ];

  for (const event of auditEvents) {
    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        actorId: adminUser.id,
        action: event.action,
        resource: event.resource,
        resourceId: event.resourceId,
        ipAddress: event.ipAddress,
        metadata: JSON.stringify(event.metadata),
        timestamp: new Date(Date.now() - event.timeOffset),
      },
    });
  }

  console.log(`Created ${auditEvents.length} audit log entries`);

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
