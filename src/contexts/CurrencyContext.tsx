import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  formatAmount: (amount: number) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({ children }) => {
  const [currency, setCurrency] = useState('EGP'); // Default to Egyptian Pound
  useEffect(()=>{const loaded=(event:Event)=>setCurrency((event as CustomEvent).detail.currency);window.addEventListener('crm-settings-loaded',loaded);return()=>window.removeEventListener('crm-settings-loaded',loaded);},[]);

  const formatAmount = (amount: number): string => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '0.00 EGP';
    }

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    try {
      return formatter.format(amount);
    } catch (error) {
      // Fallback formatting if currency is not supported
      return `${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} ${currency}`;
    }
  };

  const value = {
    currency,
    setCurrency,
    formatAmount,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
