import React from 'react';
import { clsx } from 'clsx';

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value?: number[];
  onValueChange?: (value: number[]) => void;
}

export function Slider({ 
  className, 
  value = [50], 
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  ...props 
}: SliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (onValueChange) {
      onValueChange([newValue]);
    }
  };
  
  const percentage = ((value[0] - Number(min)) / (Number(max) - Number(min))) * 100;
  
  return (
    <div className={clsx('relative flex items-center', className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0]}
        onChange={handleChange}
        className={clsx(
          'w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer',
          'slider-thumb'
        )}
        style={{
          background: `linear-gradient(to right, rgb(99 102 241) 0%, rgb(99 102 241) ${percentage}%, rgb(229 231 235) ${percentage}%, rgb(229 231 235) 100%)`
        }}
        {...props}
      />
    </div>
  );
}