import { useState, useEffect } from 'react';

interface UserTrackingData {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
}

export const useUserTracking = (): UserTrackingData => {
  const [userTracking, setUserTracking] = useState<UserTrackingData>({
    userId: null,
    userName: null,
    userEmail: null,
    isAuthenticated: false
  });

  useEffect(() => {
    // For demo purposes, we'll use mock user data
    // In a real implementation, this would connect to your auth system
    const mockUser = {
      userId: 'demo-user-123',
      userName: 'Demo User',
      userEmail: 'demo@spacecrm.com',
      isAuthenticated: true
    };

    setUserTracking(mockUser);
  }, []);

  return userTracking;
};