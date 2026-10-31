import { supabase } from '../lib/supabase';

export const createContactSubmission = async (data: any) => {
  try {
    const { error } = await supabase
      .from('contact_submissions')
      .insert([{
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        company: data.company || 'N/A',
        fleet_size: data.fleetSize || 'N/A',
        message: data.message || 'No message provided',
        inquiry_type: data.inquiryType || 'demo'
        // Note: status is removed to avoid constraint errors
      }]);

    if (error) {
      console.error("Supabase Insert Error:", error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('API Catch Error:', error.message);
    return { success: false, error: error.message };
  }
};

export const getContactSubmissions = async () => {
  try {
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Error fetching submissions:', error.message);
    return [];
  }
};