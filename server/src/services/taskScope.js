function taskScope(user) {
  const roles = user.roles.map((r) => r.toUpperCase().replaceAll(" ", "_"));
  const organization = [
    { project: { organizationId: user.organizationId } },
    { department: { organizationId: user.organizationId } },
    {
      assignees: {
        some: { employee: { organizationId: user.organizationId } },
      },
    },
  ];
  if (
    user.isSuperAdmin ||
    roles.some((r) => ["ADMIN", "ADMINISTRATOR", "OWNER_/_CEO"].includes(r))
  )
    return { OR: organization };
  const access = [
    { assignees: { some: { employeeId: user.employeeId || "__none__" } } },
    {
      project: {
        members: { some: { employeeId: user.employeeId || "__none__" } },
      },
    },
  ];
  if (
    roles.some((r) => ["DEPARTMENT_HEAD", "DEPARTMENT_MANAGER"].includes(r)) &&
    user.departmentId
  )
    access.push({ departmentId: user.departmentId });
  return { AND: [{ OR: organization }, { OR: access }] };
}
module.exports = { taskScope };
