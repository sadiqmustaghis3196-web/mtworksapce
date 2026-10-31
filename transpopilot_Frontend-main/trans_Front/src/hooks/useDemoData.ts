import { useAuth } from '../contexts/AuthContext';
import { getDemoData } from '../lib/demoData';

export const useDemoData = () => {
  const { isGuestMode } = useAuth();
  const demoData = getDemoData();

  const wrapApiCall = async <T,>(
    apiCall: () => Promise<T>,
    demoDataFallback: T
  ): Promise<T> => {
    if (isGuestMode) {
      // Simulate a slight delay to make it feel like a real API call
      await new Promise(resolve => setTimeout(resolve, 100));
      return demoDataFallback;
    }
    return apiCall();
  };

  return {
    isGuestMode,
    demoData,
    wrapApiCall,
  };
};
