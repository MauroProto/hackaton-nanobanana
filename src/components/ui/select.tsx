import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

// Select Context
interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined);

// Main Select Component
export interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value = '', onValueChange = () => {}, children }: SelectProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

// Select Trigger
export interface SelectTriggerProps {
  className?: string;
  children?: React.ReactNode;
}

export function SelectTrigger({ className, children }: SelectTriggerProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectTrigger must be used within Select');
  
  const { open, setOpen } = context;
  
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={clsx(
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      aria-expanded={open}
    >
      {children}
      <ChevronDown className={clsx('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
    </button>
  );
}

// Select Value
export function SelectValue({ placeholder = 'Select...' }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectValue must be used within Select');
  
  return <span>{context.value || placeholder}</span>;
}

// Select Content
export interface SelectContentProps {
  className?: string;
  children: React.ReactNode;
}

export function SelectContent({ className, children }: SelectContentProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectContent must be used within Select');
  
  const { open, setOpen } = context;
  const ref = useRef<HTMLDivElement>(null);
  
  // Close on click outside
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, setOpen]);
  
  if (!open) return null;
  
  return (
    <div
      ref={ref}
      className={clsx(
        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}

// Select Item
export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className }: SelectItemProps) {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error('SelectItem must be used within Select');
  
  const { value: selectedValue, onValueChange, setOpen } = context;
  const isSelected = selectedValue === value;
  
  return (
    <div
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={clsx(
        'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
        isSelected && 'bg-accent text-accent-foreground',
        className
      )}
    >
      {children}
    </div>
  );
}