import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';

interface ModernDeleteButtonProps {
  onDelete: () => Promise<void>;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'text';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  title: string;
  itemName: string;
  itemDetails?: React.ReactNode;
  dangerLevel?: 'low' | 'medium' | 'high';
  className?: string;
  children?: React.ReactNode;
}

const ModernDeleteButton: React.FC<ModernDeleteButtonProps> = ({
  onDelete,
  variant = 'destructive',
  size = 'default',
  title,
  itemName,
  itemDetails,
  dangerLevel = 'medium',
  className = '',
  children
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
      setIsOpen(false);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getDangerConfig = () => {
    switch (dangerLevel) {
      case 'high':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: AlertTriangle,
          description: 'This action cannot be undone and will permanently delete'
        };
      case 'low':
        return {
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          icon: AlertTriangle,
          description: 'This action will remove'
        };
      default:
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: AlertTriangle,
          description: 'This action cannot be undone. This will permanently delete'
        };
    }
  };

  const config = getDangerConfig();
  const IconComponent = config.icon;

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          disabled={isDeleting}
        >
          {children || (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${config.bgColor} ${config.borderColor} border`}>
              <IconComponent className={`h-5 w-5 ${config.color}`} />
            </div>
            <AlertDialogTitle className="text-left">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-left">
            {config.description} <strong>{itemName}</strong>.
            {itemDetails && (
              <div className="mt-3 p-3 bg-gray-50 rounded-md border">
                {itemDetails}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ModernDeleteButton;