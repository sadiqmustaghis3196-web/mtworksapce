/**
 * MT Nexus Global ERP — Database Seeding & Migration Utility
 * Safely imports existing prototype seed data (data.js, roles.js, client_ops_view.js)
 * into PostgreSQL with strict ID preservation, idempotent upserts, and zero duplication.
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Starting MT Nexus Global database seeding & data preservation...');

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { code: 'MT-NEXUS-HQ' },
    update: {},
    create: {
      name: 'MT Nexus Global',
      code: 'MT-NEXUS-HQ',
      currency: 'PKR',
    },
  });
  console.log(`✅ Organization verified: ${org.name} (${org.id})`);

  // 2. Roles (31 Enterprise Roles across 6 Tiers)
  const ROLES_DATA = [
    { name: 'Super Admin', tier: 'EXECUTIVE', desc: 'Complete organization-wide unrestricted authority' },
    { name: 'Owner / CEO', tier: 'EXECUTIVE', desc: 'Executive overview, finance, and company performance' },
    { name: 'Administrator', tier: 'EXECUTIVE', desc: 'System settings, user administration & department oversight' },
    { name: 'Admin', tier: 'EXECUTIVE', desc: 'Operational management & cross-department approvals' },
    { name: 'Operations Manager', tier: 'EXECUTIVE', desc: 'Workflow optimization, sprint health & resource allocation' },
    { name: 'Department Head', tier: 'MANAGEMENT', desc: 'Departmental team oversight, approvals & project allocation' },
    { name: 'Project Manager', tier: 'MANAGEMENT', desc: 'Agile sprints, task assignments, reviews & deliverables' },
    { name: 'Product Manager', tier: 'MANAGEMENT', desc: 'Roadmap planning, backlog prioritization & requirements' },
    { name: 'Team Lead', tier: 'MANAGEMENT', desc: 'Technical mentoring, daily task reviews & blocker resolution' },
    { name: 'Technical Lead', tier: 'MANAGEMENT', desc: 'Architecture decisions, code reviews & CI/CD standards' },
    { name: 'HR Manager', tier: 'HR', desc: 'Hiring ATS, employee lifecycle, leaves & attendance policies' },
    { name: 'HR Executive', tier: 'HR', desc: 'Daily attendance verification, onboarding & intern tracking' },
    { name: 'Recruiter', tier: 'HR', desc: 'Candidate sourcing, interviews & talent acquisition pipeline' },
    { name: 'Finance Manager', tier: 'FINANCE', desc: 'Cash flow, invoices, profit/loss & financial ledger' },
    { name: 'Accountant', tier: 'FINANCE', desc: 'Client invoicing, expense tracking & tax records' },
    { name: 'Payroll Officer', tier: 'FINANCE', desc: 'Employee compensation, salary slips & deductions' },
    { name: 'Senior Developer', tier: 'TECHNICAL', desc: 'Core feature engineering, API integrations & code review' },
    { name: 'Developer', tier: 'TECHNICAL', desc: 'Frontend & backend feature tasks and bug fixes' },
    { name: 'QA Engineer', tier: 'TECHNICAL', desc: 'Test plans, automated testing & bug reproduction' },
    { name: 'DevOps Engineer', tier: 'TECHNICAL', desc: 'Cloud infrastructure, Docker, CI/CD & server security' },
    { name: 'UI/UX Designer', tier: 'TECHNICAL', desc: 'Figma wireframes, UI kits & user journey designs' },
    { name: 'Graphic Designer', tier: 'TECHNICAL', desc: 'Branding, social media creatives & print graphics' },
    { name: 'Video Editor', tier: 'TECHNICAL', desc: 'Reels, promo cuts, color grading & motion graphics' },
    { name: 'Content Writer', tier: 'TECHNICAL', desc: 'Copywriting, blog posts & social media captions' },
    { name: 'SEO Specialist', tier: 'TECHNICAL', desc: 'On-page optimization, keyword ranking & site audits' },
    { name: 'Sales Manager', tier: 'BUSINESS', desc: 'Lead pipelines, sales revenue targets & client proposals' },
    { name: 'Business Development', tier: 'BUSINESS', desc: 'Prospect outreach, quotation generation & client conversion' },
    { name: 'Account Manager', tier: 'BUSINESS', desc: 'Key client relations, renewals & feedback collection' },
    { name: 'Customer Support', tier: 'BUSINESS', desc: 'SLA ticket resolution, bug triage & user assistance' },
    { name: 'Intern', tier: 'BUSINESS', desc: 'Learning roadmap, guided tasks & mentor feedback' },
    { name: 'Client', tier: 'BUSINESS', desc: 'Client portal view: project milestones, deliverables & invoices' }
  ];

  const roleMap = {};
  for (const r of ROLES_DATA) {
    const roleRecord = await prisma.role.upsert({
      where: { name: r.name },
      update: { tier: r.tier, description: r.desc },
      create: { name: r.name, tier: r.tier, description: r.desc },
    });
    roleMap[r.name] = roleRecord.id;
  }
  console.log(`✅ Seeded ${Object.keys(roleMap).length} Enterprise Roles`);

  // 3. Departments (15 Standard Departments)
  const DEPTS_DATA = [
    { id: 'dept_admin', name: 'Administration', code: 'ADM', icon: '🏢', desc: 'Executive leadership, company governance & operations' },
    { id: 'dept_hr', name: 'Human Resources', code: 'HRM', icon: '👥', desc: 'Recruitment, attendance, employee welfare & training' },
    { id: 'dept_dev', name: 'Software Development', code: 'DEV', icon: '💻', desc: 'Full-stack web architecture, APIs & microservices' },
    { id: 'dept_mob', name: 'Mobile Development', code: 'MOB', icon: '📱', desc: 'iOS, Android, React Native & Flutter applications' },
    { id: 'dept_uiux', name: 'UI/UX Design', code: 'UIX', icon: '🎨', desc: 'User research, Figma prototypes & design systems' },
    { id: 'dept_graph', name: 'Graphic Design', code: 'GRA', icon: '🖌️', desc: 'Brand kits, marketing banners & visual assets' },
    { id: 'dept_vid', name: 'Video Production', code: 'VID', icon: '🎬', desc: 'Video editing, motion graphics, promo reels & ads' },
    { id: 'dept_qa', name: 'QA & Testing', code: 'QA', icon: '🧪', desc: 'Automated test suites, manual testing & bug auditing' },
    { id: 'dept_devops', name: 'DevOps & Cloud', code: 'OPS', icon: '☁️', desc: 'Server infrastructure, Docker, CI/CD & security' },
    { id: 'dept_mkt', name: 'Digital Marketing', code: 'MKT', icon: '📣', desc: 'Ad campaigns, social media management & brand reach' },
    { id: 'dept_seo', name: 'SEO & Content', code: 'SEO', icon: '🔍', desc: 'Search engine ranking, keyword research & copy' },
    { id: 'dept_sales', name: 'Sales & BD', code: 'SLS', icon: '💼', desc: 'Lead conversion, proposals, client pitches & deals' },
    { id: 'dept_fin', name: 'Finance & Accounts', code: 'FIN', icon: '💰', desc: 'Client invoices, bookkeeping, taxes & employee payroll' },
    { id: 'dept_supp', name: 'Client Support', code: 'SUP', icon: '🛠️', desc: 'Customer tickets, technical troubleshooting & maintenance' },
    { id: 'dept_rd', name: 'Research & Development', code: 'RND', icon: '🔬', desc: 'Next-gen tech, AI automation & experimental features' }
  ];

  for (const d of DEPTS_DATA) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, icon: d.icon, description: d.desc },
      create: {
        id: d.id,
        organizationId: org.id,
        name: d.name,
        code: d.code,
        icon: d.icon,
        description: d.desc,
      },
    });
  }
  console.log(`✅ Seeded ${DEPTS_DATA.length} Departments`);

  // 4. Super Admin User Account (Unique Password)
  const superAdminPasswordHash = await bcrypt.hash('HamzaSuper@2026!', 10);
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'hamza@mtnexus.com' },
    update: { 
      isSuperAdmin: true,
      passwordHash: superAdminPasswordHash,
    },
    create: {
      organizationId: org.id,
      email: 'hamza@mtnexus.com',
      passwordHash: superAdminPasswordHash,
      isSuperAdmin: true,
    },
  });

  if (roleMap['Super Admin']) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: superAdminUser.id, roleId: roleMap['Super Admin'] } },
      update: {},
      create: { userId: superAdminUser.id, roleId: roleMap['Super Admin'] },
    });
  }
  if (roleMap['Owner / CEO']) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: superAdminUser.id, roleId: roleMap['Owner / CEO'] } },
      update: {},
      create: { userId: superAdminUser.id, roleId: roleMap['Owner / CEO'] },
    });
  }
  console.log(`✅ Super Admin account verified: hamza@mtnexus.com`);

  // Operational Admin Account (Admin role - Unique Password)
  const adminPasswordHash = await bcrypt.hash('AdminNexus@2026!', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mtnexus.com' },
    update: { 
      isSuperAdmin: false,
      passwordHash: adminPasswordHash,
    },
    create: {
      organizationId: org.id,
      email: 'admin@mtnexus.com',
      passwordHash: adminPasswordHash,
      isSuperAdmin: false,
    },
  });

  if (roleMap['Admin']) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: roleMap['Admin'] } },
      update: {},
      create: { userId: adminUser.id, roleId: roleMap['Admin'] },
    });
  }
  console.log(`✅ Operational Admin account verified: admin@mtnexus.com`);

  // Dedicated CEO Account (Unique Password)
  const ceoPasswordHash = await bcrypt.hash('CeoNexus@2026!', 10);
  const ceoUser = await prisma.user.upsert({
    where: { email: 'ceo@mtnexus.com' },
    update: { 
      isSuperAdmin: false,
      passwordHash: ceoPasswordHash,
    },
    create: {
      organizationId: org.id,
      email: 'ceo@mtnexus.com',
      passwordHash: ceoPasswordHash,
      isSuperAdmin: false,
    },
  });
  if (roleMap['Owner / CEO']) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: ceoUser.id, roleId: roleMap['Owner / CEO'] } },
      update: {},
      create: { userId: ceoUser.id, roleId: roleMap['Owner / CEO'] },
    });
  }
  console.log(`✅ CEO / Director account verified: ceo@mtnexus.com`);

  // 5. Employees (Each with individual unique password)
  const EMPLOYEES_DATA = [
    { id: 'EMP-101', name: 'Ali', role: 'Developer', deptId: 'dept_dev', mode: 'ONSITE', status: 'ACTIVE', color: '#6d3bd2', email: 'ali@mtnexus.com', password: 'AliDev@2026!', phone: '+92 300 1234567', salary: 140000, skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'] },
    { id: 'EMP-102', name: 'Sara', role: 'Senior Developer', deptId: 'dept_dev', mode: 'REMOTE', status: 'ACTIVE', color: '#12a37f', email: 'sara@mtnexus.com', password: 'SaraSenior@2026!', phone: '+92 301 2345678', salary: 185000, skills: ['Python', 'FastAPI', 'Database Architecture', 'Docker'] },
    { id: 'EMP-103', name: 'Zain', role: 'Project Manager', deptId: 'dept_admin', mode: 'HYBRID', status: 'ACTIVE', color: '#8b5cf6', email: 'zain@mtnexus.com', password: 'ZainPM@2026!', phone: '+92 302 3456789', salary: 170000, skills: ['Agile/Scrum', 'Jira', 'Risk Management', 'Client Relations'] },
    { id: 'EMP-104', name: 'Hina', role: 'Intern', deptId: 'dept_uiux', mode: 'INTERN', status: 'PROBATION', color: '#f59e0b', email: 'hina@mtnexus.com', password: 'HinaIntern@2026!', phone: '+92 303 4567890', salary: 35000, skills: ['Figma', 'Wireframing', 'Design Tokens'], mentorId: 'EMP-108', weekProgress: 6, evalPct: 78 },
    { id: 'EMP-105', name: 'Bilal', role: 'Intern', deptId: 'dept_qa', mode: 'INTERN', status: 'ONBOARDING', color: '#e5484d', email: 'bilal@mtnexus.com', password: 'BilalIntern@2026!', phone: '+92 304 5678901', salary: 35000, skills: ['Manual Testing', 'Test Cases', 'Postman API'], mentorId: 'EMP-102', weekProgress: 2, evalPct: 65 },
    { id: 'EMP-106', name: 'Maham', role: 'Video Editor', deptId: 'dept_vid', mode: 'REMOTE', status: 'ACTIVE', color: '#d6336c', email: 'maham@mtnexus.com', password: 'MahamVideo@2026!', phone: '+92 305 6789012', salary: 130000, skills: ['Premiere Pro', 'After Effects', 'Color Grading', 'Reels'] },
    { id: 'EMP-107', name: 'Kamran', role: 'Graphic Designer', deptId: 'dept_graph', mode: 'ONSITE', status: 'ACTIVE', color: '#7c3aed', email: 'kamran@mtnexus.com', password: 'KamranDesign@2026!', phone: '+92 306 7890123', salary: 125000, skills: ['Photoshop', 'Illustrator', 'Motion Graphics', '3D Blender'] },
    { id: 'EMP-108', name: 'Rida', role: 'UI/UX Designer', deptId: 'dept_uiux', mode: 'ONSITE', status: 'ACTIVE', color: '#0891b2', email: 'rida@mtnexus.com', password: 'RidaDesign@2026!', phone: '+92 307 8901234', salary: 145000, skills: ['Figma Master', 'Design Systems', 'User Journeys', 'CSS'] },
    { id: 'EMP-109', name: 'Imran', role: 'DevOps Engineer', deptId: 'dept_devops', mode: 'REMOTE', status: 'ACTIVE', color: '#0e7490', email: 'imran@mtnexus.com', password: 'ImranCloud@2026!', phone: '+92 308 9012345', salary: 175000, skills: ['AWS', 'Docker', 'Kubernetes', 'Linux', 'CI/CD'] },
    { id: 'EMP-110', name: 'Sana', role: 'SEO Specialist', deptId: 'dept_seo', mode: 'REMOTE', status: 'ACTIVE', color: '#15803d', email: 'sana@mtnexus.com', password: 'SanaSEO@2026!', phone: '+92 309 0123456', salary: 120000, skills: ['Technical SEO', 'Ahrefs', 'Copywriting', 'Keywords'] },
    { id: 'EMP-111', name: 'Adeel', role: 'Business Development', deptId: 'dept_sales', mode: 'ONSITE', status: 'ON_LEAVE', color: '#d97706', email: 'adeel@mtnexus.com', password: 'AdeelSales@2026!', phone: '+92 310 1234567', salary: 135000, skills: ['Lead Prospecting', 'Proposals', 'Client Pitching', 'CRM'] },
    { id: 'EMP-112', name: 'Fatima', role: 'HR Manager', deptId: 'dept_hr', mode: 'ONSITE', status: 'ACTIVE', color: '#be185d', email: 'fatima@mtnexus.com', password: 'FatimaHR@2026!', phone: '+92 311 2345678', salary: 155000, skills: ['Talent Acquisition', 'Employee Relations', 'Payroll Setup'] },
    { id: 'EMP-113', name: 'Owais', role: 'Customer Support', deptId: 'dept_supp', mode: 'HYBRID', status: 'OFFBOARDING', color: '#475569', email: 'owais@mtnexus.com', password: 'OwaisSupport@2026!', phone: '+92 312 3456789', salary: 115000, skills: ['Zendesk', 'SLA Monitoring', 'Bug Triage', 'Customer Success'] },
    { id: 'EMP-114', name: 'Nida', role: 'Developer', deptId: 'dept_mob', mode: 'REMOTE', status: 'PROBATION', color: '#4f46e5', email: 'nida@mtnexus.com', password: 'NidaApp@2026!', phone: '+92 313 4567890', salary: 150000, skills: ['Flutter', 'Dart', 'React Native', 'Firebase', 'App Store'] },
    { id: 'EMP-115', name: 'Usman', role: 'Team Lead', deptId: 'dept_dev', mode: 'ONSITE', status: 'ACTIVE', color: '#2563eb', email: 'teamlead@mtnexus.com', password: 'LeadNexus@2026!', phone: '+92 314 5678901', salary: 180000, skills: ['Sprint Planning', 'Code Review', 'Node.js', 'System Architecture'] },
    { id: 'EMP-116', name: 'Tariq', role: 'Finance Manager', deptId: 'dept_fin', mode: 'ONSITE', status: 'ACTIVE', color: '#16a34a', email: 'finance@mtnexus.com', password: 'FinanceNexus@2026!', phone: '+92 315 6789012', salary: 165000, skills: ['Financial Reporting', 'Payroll', 'Auditing', 'Invoicing'] }
  ];

  for (const emp of EMPLOYEES_DATA) {
    const userPasswordHash = await bcrypt.hash(emp.password, 10);
    // Create or link User account for staff with unique password
    const staffUser = await prisma.user.upsert({
      where: { email: emp.email },
      update: {
        passwordHash: userPasswordHash,
      },
      create: {
        organizationId: org.id,
        email: emp.email,
        passwordHash: userPasswordHash,
        isSuperAdmin: false,
      },
    });

    // Assign mapped role
    if (roleMap[emp.role]) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: staffUser.id, roleId: roleMap[emp.role] } },
        update: {},
        create: { userId: staffUser.id, roleId: roleMap[emp.role] },
      });
    }

    await prisma.employee.upsert({
      where: { id: emp.id },
      update: {
        fullName: emp.name,
        jobTitle: emp.role,
        departmentId: emp.deptId,
        colorCode: emp.color,
        workMode: emp.mode,
        status: emp.status,
        salaryMonthly: emp.salary,
        skills: emp.skills,
      },
      create: {
        id: emp.id,
        organizationId: org.id,
        userId: staffUser.id,
        departmentId: emp.deptId,
        employeeCode: emp.id,
        fullName: emp.name,
        jobTitle: emp.role,
        workMode: emp.mode,
        status: emp.status,
        colorCode: emp.color,
        email: emp.email,
        phone: emp.phone,
        salaryMonthly: emp.salary,
        leaveBalance: 14,
        skills: emp.skills,
      },
    });
  }

  // Pass 2: Intern profiles after all mentors exist
  for (const emp of EMPLOYEES_DATA) {
    if (emp.mentorId) {
      await prisma.internProfile.upsert({
        where: { employeeId: emp.id },
        update: {
          currentWeek: emp.weekProgress || 1,
          evaluationPct: emp.evalPct || 70,
          mentorId: emp.mentorId,
        },
        create: {
          employeeId: emp.id,
          mentorId: emp.mentorId,
          durationWeeks: 12,
          currentWeek: emp.weekProgress || 1,
          evaluationPct: emp.evalPct || 70,
        },
      });
    }
  }
  console.log(`✅ Seeded ${EMPLOYEES_DATA.length} Employees & Intern Profiles`);

  // 6. Clients & Projects
  const CLIENTS_DATA = [
    { id: 'CLI-01', name: 'Client A Enterprises', contact: 'Mr. Tariq', email: 'tariq@clienta.com' },
    { id: 'CLI-02', name: 'Zenith Corp', contact: 'Ayesha Malik', email: 'ayesha@zenithcorp.com' },
    { id: 'CLI-03', name: 'MT Nexus Internal', contact: 'Hamza Tariq', email: 'hamza@mtnexus.com' },
    { id: 'CLI-04', name: 'Retail Chain B', contact: 'Kashif Mehmood', email: 'kashif@retailchainb.com' },
    { id: 'LEAD-101', name: 'Metro Hypermarket', contact: 'Bilal Chaudhry', email: 'bilal@metro.com' },
    { id: 'LEAD-102', name: 'Al-Shifa Healthcare', contact: 'Dr. Munir', email: 'info@alshifa.com' },
    { id: 'LEAD-103', name: 'Express Freight Ltd', contact: 'Captain Asif', email: 'asif@expressfreight.com' }
  ];

  for (const c of CLIENTS_DATA) {
    await prisma.client.upsert({
      where: { id: c.id },
      update: { companyName: c.name, contactName: c.contact, email: c.email },
      create: {
        id: c.id,
        organizationId: org.id,
        companyName: c.name,
        contactName: c.contact,
        email: c.email,
        portalEnabled: true,
      },
    });
  }

  const PROJECTS_DATA = [
    { id: 'PRJ-01', name: 'Website', cat: 'Web App', clientId: 'CLI-01', budget: 450000, contractVal: 500000, status: 'Active', deadline: new Date('2026-11-30'), pm: 'Zain' },
    { id: 'PRJ-02', name: 'Brand Kit – Zenith', cat: 'Graphic Design', clientId: 'CLI-02', budget: 180000, contractVal: 200000, status: 'Active', deadline: new Date('2026-11-15'), pm: 'Kamran' },
    { id: 'PRJ-03', name: 'Nexus Promo Reel', cat: 'Video Editing', clientId: 'CLI-03', budget: 120000, contractVal: 120000, status: 'Active', deadline: new Date('2026-11-10'), pm: 'Maham' },
    { id: 'PRJ-04', name: 'Eid Sale Campaign', cat: 'Social Media Marketing', clientId: 'CLI-04', budget: 250000, contractVal: 280000, status: 'Active', deadline: new Date('2026-11-05'), pm: 'Sana' },
    { id: 'PRJ-05', name: 'SEO Audit – Client A', cat: 'SEO', clientId: 'CLI-01', budget: 95000, contractVal: 110000, status: 'Active', deadline: new Date('2026-11-20'), pm: 'Sana' }
  ];

  for (const p of PROJECTS_DATA) {
    await prisma.project.upsert({
      where: { id: p.id },
      update: { name: p.name, budget: p.budget, contractValue: p.contractVal, deadline: p.deadline },
      create: {
        id: p.id,
        organizationId: org.id,
        clientId: p.clientId,
        name: p.name,
        category: p.cat,
        budget: p.budget,
        contractValue: p.contractVal,
        deadline: p.deadline,
        projectManager: p.pm,
        status: p.status,
      },
    });
  }
  console.log(`✅ Seeded ${PROJECTS_DATA.length} Projects & Clients`);

  // 7. Tasks (8 Tasks from data.js, strictly preserving IDs 101..108)
  const TASKS_DATA = [
    {
      id: 101,
      projId: 'PRJ-01',
      deptId: 'dept_dev',
      t: 'Fix ChangeHistory content_id bug',
      cat: 'Web App',
      who: 'EMP-102', // Sara
      pr: 'High',
      stage: 2, // In Progress
      due: new Date('2026-10-30'),
      desc: 'Client A ki website mein ChangeHistory ka content_id sahi karna hai. Staging par test karke production par deploy karein.',
      tags: ['Bug', 'Urgent'],
      estHours: 8,
      actHours: 3.5,
      updates: [
        { author: 'Sara', content: 'Reproduced the issue on staging server with legacy posts.', empId: 'EMP-102' }
      ]
    },
    {
      id: 102,
      projId: 'PRJ-01',
      deptId: 'dept_uiux',
      t: 'Card template & responsive grid',
      cat: 'Web App',
      who: 'EMP-104', // Hina
      pr: 'Low',
      stage: 0, // Upcoming
      due: new Date('2026-11-02'),
      desc: 'Responsive card components with glassmorphism hover animations.',
      tags: ['Design', 'Intern'],
      estHours: 12,
      actHours: 4,
      updates: [
        { author: 'Hina', content: 'Card ka basic layout aur colors final kar diye.', empId: 'EMP-104' },
        { author: 'Hina', content: 'Labels aur avatar add kiye, client ko review ke liye bheja.', empId: 'EMP-104' }
      ]
    },
    {
      id: 103,
      projId: 'PRJ-01',
      deptId: 'dept_dev',
      t: 'SLI measurement & latency metrics',
      cat: 'Web App',
      who: 'EMP-101', // Ali
      pr: 'Medium',
      stage: 2,
      due: new Date('2026-11-04'),
      desc: 'Set up Prometheus & Grafana service level indicators for API endpoints.',
      tags: ['Feature'],
      estHours: 16,
      actHours: 6,
      updates: []
    },
    {
      id: 104,
      projId: 'PRJ-01',
      deptId: 'dept_mob',
      t: 'FoodApp – checkout screen UI & payment gateway',
      cat: 'Web App',
      who: 'EMP-114', // Nida
      pr: 'High',
      stage: 0,
      due: new Date('2026-11-08'),
      desc: 'Integration with Stripe and local payment gateway for mobile app checkout.',
      tags: ['App'],
      estHours: 20,
      actHours: 0,
      updates: []
    },
    {
      id: 105,
      projId: 'PRJ-01',
      deptId: 'dept_qa',
      t: 'Integration test for editions & releases',
      cat: 'Web App',
      who: 'EMP-105', // Bilal
      pr: 'Medium',
      stage: 3, // Review
      due: new Date('2026-10-29'),
      desc: 'Automated Cypress end-to-end integration tests for multi-tenant accounts.',
      tags: ['Feature'],
      estHours: 10,
      actHours: 8,
      updates: [
        { author: 'Bilal', content: 'Test suite written, 24 test cases passing on local branch.', empId: 'EMP-105' }
      ]
    },
    {
      id: 106,
      projId: 'PRJ-01',
      deptId: 'dept_dev',
      t: 'Database migration & zero-downtime indexing',
      cat: 'Web App',
      who: 'EMP-102', // Sara
      pr: 'Medium',
      stage: 4, // Done
      due: new Date('2026-10-25'),
      desc: 'PostgreSQL index creation and legacy tables backup before sprint deploy.',
      tags: ['Feature'],
      estHours: 6,
      actHours: 5.5,
      approvedBy: 'Project Manager · 25 Oct',
      updates: [
        { author: 'Sara', content: 'Migration script verified and executed on production successfully.', empId: 'EMP-102' }
      ]
    },
    {
      id: 107,
      projId: 'PRJ-03',
      deptId: 'dept_vid',
      t: 'Reel: Nexus Global intro 30s cut',
      cat: 'Video Editing',
      who: 'EMP-106', // Maham
      pr: 'High',
      stage: 2,
      due: new Date('2026-11-02'),
      desc: 'Nexus Global ka 30 second ka intro reel. Logo animation, background music aur Urdu subtitles lagana hai. Output: 1080x1920.',
      tags: ['Video', 'Urgent'],
      estHours: 14,
      actHours: 5,
      updates: [
        { author: 'Maham', content: 'Rough storyboard prepared and approved by Zain.', empId: 'EMP-106' }
      ]
    },
    {
      id: 108,
      projId: 'PRJ-02',
      deptId: 'dept_uiux',
      t: 'Logo variations & typography palette',
      cat: 'Graphic Design',
      who: 'EMP-108', // Rida
      pr: 'High',
      stage: 1, // Today To Do
      due: new Date('2026-10-31'),
      desc: 'Zenith brand logo options: dark, light, monochrome and favicon sizes.',
      tags: ['Design'],
      estHours: 8,
      actHours: 2,
      updates: []
    }
  ];

  for (const t of TASKS_DATA) {
    const task = await prisma.task.upsert({
      where: { id: t.id },
      update: {
        title: t.t,
        stage: t.stage,
        priority: t.pr,
        dueDate: t.due,
        estimatedHours: t.estHours,
        actualHours: t.actHours,
        tags: t.tags,
        approvedBy: t.approvedBy,
      },
      create: {
        id: t.id,
        projectId: t.projId,
        departmentId: t.deptId,
        title: t.t,
        description: t.desc,
        category: t.cat,
        stage: t.stage,
        priority: t.pr,
        dueDate: t.due,
        estimatedHours: t.estHours,
        actualHours: t.actHours,
        tags: t.tags,
        approvedBy: t.approvedBy,
      },
    });

    if (t.who) {
      await prisma.taskAssignee.upsert({
        where: { taskId_employeeId: { taskId: task.id, employeeId: t.who } },
        update: { isOwner: true },
        create: { taskId: task.id, employeeId: t.who, isOwner: true },
      });
    }

    for (const up of t.updates) {
      await prisma.taskUpdate.create({
        data: {
          taskId: task.id,
          employeeId: up.empId,
          authorName: up.author,
          content: up.content,
        },
      });
    }
  }
  console.log(`✅ Seeded ${TASKS_DATA.length} Tasks with assignees and updates`);

  // 8. CRM Leads
  const LEADS_DATA = [
    { id: 'LEAD-201', clientName: 'Retail Chain POS', company: 'Metro Hypermarket', budget: 'Rs 650,000', rep: 'EMP-111', repName: 'Adeel', stage: 'New Lead', prob: 30 },
    { id: 'LEAD-202', clientName: 'Clinic Appointment System', company: 'Al-Shifa Healthcare', budget: 'Rs 380,000', rep: 'EMP-111', repName: 'Adeel', stage: 'Contacted', prob: 50 },
    { id: 'LEAD-203', clientName: 'Logistics Tracking Portal', company: 'Express Freight Ltd', budget: 'Rs 850,000', rep: 'EMP-111', repName: 'Adeel', stage: 'Proposal Sent', prob: 75 },
    { id: 'LEAD-204', clientName: 'School Management ERP', company: 'Beacon Heights Academy', budget: 'Rs 520,000', rep: 'EMP-111', repName: 'Adeel', stage: 'Negotiation', prob: 85 },
    { id: 'LEAD-205', clientName: 'Client A – Website & App', company: 'Apex Enterprises', budget: 'Rs 450,000', rep: 'EMP-111', repName: 'Adeel', stage: 'Won', prob: 100, convertedProjectId: 'PRJ-01' }
  ];

  for (const l of LEADS_DATA) {
    await prisma.lead.upsert({
      where: { id: l.id },
      update: { stage: l.stage, probability: l.prob },
      create: {
        id: l.id,
        clientName: l.clientName,
        company: l.company,
        budget: l.budget,
        assignedEmployeeId: l.rep,
        repName: l.repName,
        stage: l.stage,
        probability: l.prob,
        convertedProjectId: l.convertedProjectId,
      },
    });
  }
  console.log(`✅ Seeded ${LEADS_DATA.length} CRM Leads`);

  // 9. Hiring Candidates
  const CANDIDATES_DATA = [
    { id: 'CAND-301', name: 'Usman Tariq', role: 'React Developer', exp: '3 Years', stage: 'Applied', rating: 4.2 },
    { id: 'CAND-302', name: 'Maria Khan', role: 'Node.js Developer', exp: '4 Years', stage: 'Screening', rating: 4.5 },
    { id: 'CAND-303', name: 'Zoya Ahmed', role: 'Video Editor', exp: '2 Years', stage: 'Technical Test', rating: 4.0 },
    { id: 'CAND-304', name: 'Hamza Siddiqui', role: 'UI Designer', exp: '3 Years', stage: 'Interview', rating: 4.8 },
    { id: 'CAND-305', name: 'Farhan Ali', role: 'DevOps Engineer', exp: '5 Years', stage: 'Offer', rating: 4.9 },
    { id: 'CAND-306', name: 'Noor Fatima', role: 'Flutter Developer', exp: '3 Years', stage: 'Hired', rating: 5.0 }
  ];

  for (const cand of CANDIDATES_DATA) {
    await prisma.candidate.upsert({
      where: { id: cand.id },
      update: { stage: cand.stage, rating: cand.rating },
      create: {
        id: cand.id,
        fullName: cand.name,
        appliedRole: cand.role,
        experience: cand.exp,
        stage: cand.stage,
        rating: cand.rating,
      },
    });
  }
  console.log(`✅ Seeded ${CANDIDATES_DATA.length} Candidates`);

  // 10. Support Tickets
  const TICKETS_DATA = [
    { id: 'TCK-401', title: 'Server response slow on checkout endpoint', client: 'Metro Hypermarket', priority: 'High', assigned: 'Owais', stage: 'New Ticket', sla: '4 Hours', clientId: 'LEAD-101' },
    { id: 'TCK-402', title: 'Password reset token expired too early', client: 'Apex Enterprises', priority: 'Medium', assigned: 'Owais', stage: 'Investigating', sla: '12 Hours', clientId: 'CLI-01' },
    { id: 'TCK-403', title: 'SSL certificate renewal for staging subdomains', client: 'Express Freight', priority: 'High', assigned: 'Imran', stage: 'Fixed', sla: 'Resolved', clientId: 'LEAD-103' },
    { id: 'TCK-404', title: 'DNS domain pointer verification', client: 'Beacon Heights', priority: 'Low', assigned: 'Imran', stage: 'Closed', sla: 'Resolved' }
  ];

  for (const tck of TICKETS_DATA) {
    await prisma.supportTicket.upsert({
      where: { id: tck.id },
      update: { stage: tck.stage, priority: tck.priority },
      create: {
        id: tck.id,
        clientId: tck.clientId,
        title: tck.title,
        clientName: tck.client,
        priority: tck.priority,
        assignedTo: tck.assigned,
        stage: tck.stage,
        sla: tck.sla,
      },
    });
  }
  console.log(`✅ Seeded ${TICKETS_DATA.length} Support Tickets`);

  // 11. Client Operations Retainer Contracts
  const CONTRACTS_DATA = [
    {
      id: 'CTR-2026-001',
      clientId: 'LEAD-101',
      name: '360° SEO & Organic Growth Retainer',
      category: 'SEO & Digital',
      services: ['Search Engine Optimization', 'Technical SEO', 'Google Ads (PPC)', 'Speed Optimization'],
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      durationMonths: 12,
      retainerAmount: 350000,
      manager: 'Sara (PM)',
      monthlyProgress: 75,
      daysRemaining: 64,
      status: 'Active',
      healthScore: 94
    },
    {
      id: 'CTR-2026-002',
      clientId: 'LEAD-102',
      name: 'Social Media & Creative Production Retainer',
      category: 'Creative & Content',
      services: ['Social Media Management', 'Short-Form Video (Reels)', 'Creative Graphic Design', 'Community Management'],
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-11-30'),
      durationMonths: 6,
      retainerAmount: 220000,
      manager: 'Hamza Tariq (Admin)',
      monthlyProgress: 88,
      daysRemaining: 33,
      status: 'Active',
      healthScore: 88
    }
  ];

  for (const ctr of CONTRACTS_DATA) {
    await prisma.contract.upsert({
      where: { id: ctr.id },
      update: { monthlyProgress: ctr.monthlyProgress, healthScore: ctr.healthScore },
      create: ctr,
    });
  }
  console.log(`✅ Seeded ${CONTRACTS_DATA.length} Client Retainer Contracts`);

  // 12. Initial Invoices & Audit Log
  await prisma.invoice.upsert({
    where: { invoiceNo: 'INV-2026-001' },
    update: {},
    create: {
      invoiceNo: 'INV-2026-001',
      clientId: 'CLI-01',
      description: 'Client A – Website Phase 1 Milestone',
      amount: 450000,
      status: 'Paid',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: superAdminUser.id,
      action: 'DATABASE_INITIALIZATION',
      userRole: 'Super Admin',
      detail: 'PostgreSQL 16 relational database initialized and synchronized via Prisma.',
      ipAddress: '127.0.0.1',
    },
  });

  console.log('🎉 Seeding successfully completed without data loss!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
