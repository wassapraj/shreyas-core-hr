import { useState, useEffect, useCallback } from 'react';

interface DraftFormOptions<T> {
  key: string;
  initialValues: T;
  autoSaveDelay?: number;
}

export function useDraftForm<T extends Record<string, any>>({
  key,
  initialValues,
  autoSaveDelay = 1000
}: DraftFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(`draft_${key}`);
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setValues({ ...initialValues, ...parsedDraft });
        setHasUnsavedChanges(true);
      } catch (error) {
        console.error('Error parsing saved draft:', error);
        localStorage.removeItem(`draft_${key}`);
      }
    }
  }, [key, initialValues]);

  // Auto-save to localStorage with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasUnsavedChanges) {
        localStorage.setItem(`draft_${key}`, JSON.stringify(values));
      }
    }, autoSaveDelay);

    return () => clearTimeout(timer);
  }, [values, hasUnsavedChanges, key, autoSaveDelay]);

  const updateValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  }, []);

  const updateValues = useCallback((newValues: Partial<T>) => {
    setValues(prev => ({ ...prev, ...newValues }));
    setHasUnsavedChanges(true);
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(`draft_${key}`);
    setHasUnsavedChanges(false);
  }, [key]);

  const resetToInitial = useCallback(() => {
    setValues(initialValues);
    clearDraft();
  }, [initialValues, clearDraft]);

  const isDirty = useCallback((field?: keyof T) => {
    if (field) {
      return values[field] !== initialValues[field];
    }
    return Object.keys(values).some(k => values[k] !== initialValues[k]);
  }, [values, initialValues]);

  return {
    values,
    updateValue,
    updateValues,
    hasUnsavedChanges,
    clearDraft,
    resetToInitial,
    isDirty
  };
}