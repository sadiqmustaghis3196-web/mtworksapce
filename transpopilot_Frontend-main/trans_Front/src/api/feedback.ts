import { supabase } from '../lib/supabase';

export interface FeedbackSubmission {
  id?: string;
  user_id?: string;
  feedback_type: 'general' | 'technical' | 'feature_request';
  category: 'ui_ux' | 'performance' | 'bug' | 'feature' | 'other';
  rating?: number;
  title: string;
  message: string;
  status?: string;
  admin_response?: string;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Testimonial {
  id?: string;
  user_id?: string;
  name: string;
  company: string;
  fleet_size?: string;
  position?: string;
  quote: string;
  savings_metric?: string;
  avatar_initials: string;
  approval_status?: string;
  is_featured?: boolean;
  display_order?: number;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppPerformanceFeedback {
  id?: string;
  user_id?: string;
  issue_type: 'bug' | 'crash' | 'slow_performance' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  page_url: string;
  browser?: string;
  device?: string;
  description: string;
  steps_to_reproduce?: string;
  error_message?: string;
  status?: string;
  resolved_at?: string;
  created_at?: string;
  updated_at?: string;
}

export const createFeedback = async (data: FeedbackSubmission): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('feedback_submissions').insert([
      {
        user_id: user?.id,
        feedback_type: data.feedback_type,
        category: data.category,
        rating: data.rating,
        title: data.title,
        message: data.message,
        metadata: data.metadata || {},
        status: 'new',
      },
    ]);

    if (error) {
      console.error('Error creating feedback:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating feedback:', error);
    return { success: false, error: 'Failed to submit feedback' };
  }
};

export const createTestimonial = async (data: Testimonial): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('testimonials').insert([
      {
        user_id: user?.id,
        name: data.name,
        company: data.company,
        fleet_size: data.fleet_size,
        position: data.position,
        quote: data.quote,
        savings_metric: data.savings_metric,
        avatar_initials: data.avatar_initials,
        approval_status: 'pending',
      },
    ]);

    if (error) {
      console.error('Error creating testimonial:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating testimonial:', error);
    return { success: false, error: 'Failed to submit testimonial' };
  }
};

export const createPerformanceFeedback = async (data: AppPerformanceFeedback): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('app_performance_feedback').insert([
      {
        user_id: user?.id,
        issue_type: data.issue_type,
        severity: data.severity,
        page_url: data.page_url,
        browser: data.browser,
        device: data.device,
        description: data.description,
        steps_to_reproduce: data.steps_to_reproduce,
        error_message: data.error_message,
        status: 'new',
      },
    ]);

    if (error) {
      console.error('Error creating performance feedback:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error creating performance feedback:', error);
    return { success: false, error: 'Failed to submit performance feedback' };
  }
};

export const getApprovedTestimonials = async (): Promise<{ data: Testimonial[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('approval_status', 'approved')
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching testimonials:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return { data: [], error: 'Failed to fetch testimonials' };
  }
};

export const getAllFeedback = async (): Promise<{ data: FeedbackSubmission[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('feedback_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching feedback:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return { data: [], error: 'Failed to fetch feedback' };
  }
};

export const getAllTestimonials = async (): Promise<{ data: Testimonial[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching testimonials:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return { data: [], error: 'Failed to fetch testimonials' };
  }
};

export const getAllPerformanceFeedback = async (): Promise<{ data: AppPerformanceFeedback[]; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('app_performance_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching performance feedback:', error);
      return { data: [], error: error.message };
    }

    return { data: data || [] };
  } catch (error) {
    console.error('Error fetching performance feedback:', error);
    return { data: [], error: 'Failed to fetch performance feedback' };
  }
};

export const updateFeedbackStatus = async (
  id: string,
  status: string,
  adminResponse?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('feedback_submissions')
      .update({
        status,
        admin_response: adminResponse,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating feedback:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating feedback:', error);
    return { success: false, error: 'Failed to update feedback' };
  }
};

export const updateTestimonialStatus = async (
  id: string,
  approvalStatus: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('testimonials')
      .update({
        approval_status: approvalStatus,
        approved_by: user?.id,
        approved_at: approvalStatus === 'approved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating testimonial:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating testimonial:', error);
    return { success: false, error: 'Failed to update testimonial' };
  }
};

export const updatePerformanceFeedbackStatus = async (
  id: string,
  status: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('app_performance_feedback')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating performance feedback:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating performance feedback:', error);
    return { success: false, error: 'Failed to update performance feedback' };
  }
};
