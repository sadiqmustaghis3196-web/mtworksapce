import { API_BASE_URL } from '../lib/apiConfig';
import { supabase } from '../lib/supabase';

export async function getDocumentUrl(driverId: string, documentId: string): Promise<{ url: string | null; is_electronic?: boolean; message?: string } | null> {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/drivers/${driverId}/documents/${documentId}/view`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json : null;
  } catch (err) {
    console.error('Failed to fetch document URL:', err);
    return null;
  }
}
