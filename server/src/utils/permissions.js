/**
 * MT Nexus Global ERP — Server-Side Permission & Effective RBAC Engine
 * Calculates effective module access and granular permission flags from PostgreSQL user roles.
 */

const MODULE_DEFINITIONS = {
  dash: 'Executive Dashboard',
  boards: 'Project Boards',
  clientops: 'Client Operations',
  hiring: 'Hiring & ATS',
  people: 'Employees',
  attendance: 'Attendance & Leaves',
  interns: 'Internship Program',
  finance: 'Finance & Payroll',
  creative: 'Creative Studio',
  sales: 'Sales CRM',
  support: 'Support Tickets',
  depts: 'Departments',
  access: 'Roles & Permissions',
};

const DEFAULT_ROLE_ACCESS = {
  'Super Admin': Object.keys(MODULE_DEFINITIONS),
  'Owner / CEO': ['dash', 'boards', 'clientops', 'sales', 'finance', 'people', 'attendance', 'depts', 'creative', 'support'],
  'Administrator': ['dash', 'boards', 'clientops', 'hiring', 'people', 'attendance', 'interns', 'creative', 'sales', 'support', 'depts', 'access'],
  'Admin': ['dash', 'boards', 'clientops', 'hiring', 'people', 'attendance', 'interns', 'creative', 'sales', 'support', 'depts'],
  'Operations Manager': ['dash', 'boards', 'clientops', 'people', 'attendance', 'interns', 'creative', 'support', 'depts'],
  'Department Head': ['dash', 'boards', 'clientops', 'people', 'attendance', 'interns', 'depts', 'support'],
  'Project Manager': ['dash', 'boards', 'clientops', 'creative', 'support', 'people', 'attendance', 'interns'],
  'Product Manager': ['dash', 'boards', 'clientops', 'creative', 'support', 'depts'],
  'Team Lead': ['dash', 'boards', 'clientops', 'support', 'attendance', 'interns'],
  'Technical Lead': ['dash', 'boards', 'clientops', 'support', 'attendance'],
  'HR Manager': ['dash', 'hiring', 'people', 'attendance', 'interns', 'depts'],
  'HR Executive': ['hiring', 'people', 'attendance', 'interns'],
  'Recruiter': ['hiring', 'people'],
  'Finance Manager': ['dash', 'finance', 'clientops', 'sales', 'people'],
  'Accountant': ['dash', 'finance', 'sales'],
  'Payroll Officer': ['finance', 'attendance', 'people'],
  'Senior Developer': ['boards', 'clientops', 'support', 'attendance'],
  'Developer': ['boards', 'clientops', 'support', 'attendance'],
  'QA Engineer': ['boards', 'clientops', 'support', 'attendance'],
  'DevOps Engineer': ['boards', 'support', 'attendance'],
  'UI/UX Designer': ['boards', 'creative', 'attendance'],
  'Graphic Designer': ['creative', 'clientops', 'boards', 'attendance'],
  'Video Editor': ['creative', 'clientops', 'boards', 'attendance'],
  'Content Writer': ['creative', 'clientops', 'attendance'],
  'SEO Specialist': ['creative', 'clientops', 'boards', 'attendance'],
  'Sales Manager': ['dash', 'sales', 'clientops', 'boards'],
  'Business Development': ['sales', 'clientops', 'boards'],
  'Account Manager': ['sales', 'clientops', 'boards', 'support'],
  'Customer Support': ['support', 'boards', 'attendance'],
  'Intern': ['boards', 'interns', 'attendance'],
  'Client': ['clientops'],
};

function calculateEffectivePermissions(user) {
  const roles = user.roles || [];
  const isSuperAdmin = !!user.isSuperAdmin;

  if (isSuperAdmin) {
    return {
      allowedModules: Object.keys(MODULE_DEFINITIONS),
      canManageUsers: true,
      canManageProtectedSuperAdmin: true,
      canManageRoles: true,
      canManageFinance: true,
      canManageHR: true,
      canManageTasks: true,
      canDeleteTasks: true,
    };
  }

  const moduleSet = new Set();
  roles.forEach(roleName => {
    const list = DEFAULT_ROLE_ACCESS[roleName] || [];
    list.forEach(m => moduleSet.add(m));
  });

  const canManageUsers = roles.some(r => ['Super Admin', 'Administrator', 'Admin'].includes(r));
  const canManageRoles = roles.some(r => ['Super Admin', 'Owner / CEO', 'Administrator'].includes(r));
  const canManageFinance = roles.some(r => ['Super Admin', 'Owner / CEO', 'Finance Manager', 'Accountant'].includes(r));
  const canManageHR = roles.some(r => ['Super Admin', 'Owner / CEO', 'HR Manager', 'HR Executive'].includes(r));
  const canManageTasks = roles.some(r => [
    'Super Admin', 'Owner / CEO', 'Administrator', 'Admin', 'Operations Manager',
    'Department Head', 'Project Manager', 'Product Manager', 'Team Lead', 'Technical Lead'
  ].includes(r));
  const canDeleteTasks = roles.some(r => ['Super Admin', 'Admin', 'Administrator'].includes(r));

  return {
    allowedModules: Array.from(moduleSet),
    canManageUsers,
    canManageProtectedSuperAdmin: false,
    canManageRoles,
    canManageFinance,
    canManageHR,
    canManageTasks,
    canDeleteTasks,
  };
}

module.exports = {
  MODULE_DEFINITIONS,
  DEFAULT_ROLE_ACCESS,
  calculateEffectivePermissions,
};
