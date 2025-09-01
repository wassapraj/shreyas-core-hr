import React, { createContext, useContext, useState, useCallback } from 'react';

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  markAsClean: () => void;
  markAsDirty: () => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export const useUnsavedChanges = () => {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
};

export const UnsavedChangesProvider = ({ children }: { children: React.ReactNode }) => {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const markAsClean = useCallback(() => {
    setHasUnsavedChanges(false);
  }, []);

  const markAsDirty = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  return (
    <UnsavedChangesContext.Provider 
      value={{ 
        hasUnsavedChanges, 
        setHasUnsavedChanges, 
        markAsClean, 
        markAsDirty 
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
};