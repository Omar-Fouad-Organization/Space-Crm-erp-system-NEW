import React, { createContext, useContext, useState, useEffect } from 'react';

interface SystemSettings {
  companyName: string;
  isMaintenanceMode: boolean;
  theme: 'light' | 'dark';
  notifications: boolean;
}

interface SystemSettingsContextType {
  companyName: string;
  isMaintenanceMode: boolean;
  theme: 'light' | 'dark';
  notifications: boolean;
  updateSettings: (settings: Partial<SystemSettings>) => void;
}

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export function SystemSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>({
    companyName: 'SPACE Organizing',
    isMaintenanceMode: false,
    theme: 'light',
    notifications: true
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('systemSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Error loading system settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('systemSettings', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <SystemSettingsContext.Provider value={{
      ...settings,
      updateSettings
    }}>
      {children}
    </SystemSettingsContext.Provider>
  );
}

export function useSystemSettings() {
  const context = useContext(SystemSettingsContext);
  if (context === undefined) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
}
