import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EmployeeAvatarProps {
  avatarUrl?: string;
  firstName: string;
  lastName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base'
};

const colorClasses = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-yellow-500',
  'bg-red-500',
  'bg-teal-500'
];

export const EmployeeAvatar = ({ 
  avatarUrl, 
  firstName, 
  lastName = '', 
  size = 'md', 
  className = '',
  onClick 
}: EmployeeAvatarProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (avatarUrl && !imageError) {
      getSignedUrl();
    }
  }, [avatarUrl, imageError]);

  const getSignedUrl = async () => {
    if (!avatarUrl) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('get-signed-url', {
        body: { key: avatarUrl }
      });

      if (error) {
        console.error('Error getting signed URL:', error);
        setImageError(true);
        return;
      }

      setSignedUrl(data.signedUrl);
    } catch (error) {
      console.error('Error getting signed URL:', error);
      setImageError(true);
    }
  };

  const getInitials = () => {
    const firstInitial = firstName?.charAt(0)?.toUpperCase() || '';
    const lastInitial = lastName?.charAt(0)?.toUpperCase() || '';
    return firstInitial + lastInitial;
  };

  const getColorClass = () => {
    // Generate consistent color based on name
    const nameString = firstName + lastName;
    let hash = 0;
    for (let i = 0; i < nameString.length; i++) {
      hash = nameString.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colorClasses[Math.abs(hash) % colorClasses.length];
  };

  const baseClasses = `
    rounded-full flex items-center justify-center font-medium text-white
    ${sizeClasses[size]} ${className}
    ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}
  `;

  if (signedUrl && !imageError) {
    return (
      <img
        src={signedUrl}
        alt={`${firstName} ${lastName}`}
        className={baseClasses}
        onClick={onClick}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div
      className={`${baseClasses} ${getColorClass()}`}
      onClick={onClick}
      title={`${firstName} ${lastName}`}
    >
      {getInitials()}
    </div>
  );
};