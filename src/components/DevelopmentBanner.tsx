import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DevelopmentBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/60 rounded-xl p-4 mb-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center mr-3">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-800">
              Development Environment
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              This is a development version of the SPACE CRM system. Some features may be in testing mode.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(false)}
          className="text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-lg transition-colors p-2"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
