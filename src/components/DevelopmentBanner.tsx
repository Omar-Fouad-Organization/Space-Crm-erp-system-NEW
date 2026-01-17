import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DevelopmentBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
          <div>
            <h3 className="text-sm font-medium text-yellow-800">
              Development Environment
            </h3>
            <p className="text-sm text-yellow-700">
              This is a development version of the SPACE CRM system. Some features may be in testing mode.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(false)}
          className="text-yellow-600 hover:text-yellow-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
