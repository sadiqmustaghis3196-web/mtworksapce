const fs = require('fs');
let content = fs.readFileSync('src/api/adminApi.ts', 'utf8');

const newCode = `
// ─────────────────────────────────────────────────
// POST /api/admin/users/invite
// ─────────────────────────────────────────────────
export async function inviteTeamMember(email: string, role: string): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
  const headers = await getAuthHeaders();
  const response = await axios.post(
    \`\${API_BASE_URL}/api/admin/users/invite\`,
    { email, role },
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to invite team member');
  }
  return response.data;
}

// ─────────────────────────────────────────────────
// GET /api/admin/users/invite/:id/token
// ─────────────────────────────────────────────────
export async function getInviteToken(inviteId: string): Promise<string> {
  const headers = await getAuthHeaders();
  const response = await axios.get(
    \`\${API_BASE_URL}/api/admin/users/invite/\${inviteId}/token\`,
    { headers }
  );
  if (!response.data.success) {
    throw new Error(response.data.error || 'Failed to get invite token');
  }
  return response.data.data.token;
}
`;

fs.writeFileSync('src/api/adminApi.ts', content + newCode, 'utf8');
console.log('Appended safely.');
