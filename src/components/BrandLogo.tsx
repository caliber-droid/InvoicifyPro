import React from 'react';

interface BrandLogoProps {
  className?: string;
  lightText?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  lightText = false,
  showText = true,
  size = 'md',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };
  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl',
  };

  return (
    <span className={`inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0 ${className}`}>
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconSizes[size]} shrink-0`}
        aria-hidden="true"
      >
        <rect width="36" height="36" rx="9" fill="#172B4D" />
        <path
          d="M11 9.5C11 8.67157 11.6716 8 12.5 8H20.2L25 12.8V26.5C25 27.3284 24.3284 28 23.5 28H12.5C11.6716 28 11 27.3284 11 26.5V9.5Z"
          fill="#FFFFFF"
        />
        <path d="M20.2 8V12.8H25L20.2 8Z" fill="#38BDF8" />
        <path
          d="M14.5 16.5H21.5M14.5 20H19.5"
          stroke="#172B4D"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
        <path
          d="M14.5 23.5L17.2 23.5L21.5 19.5"
          stroke="#2563EB"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {showText && (
        <span
          className={`font-display font-bold tracking-tight ${textSizes[size]} ${
            lightText ? 'text-white' : 'text-[#172B4D]'
          }`}
        >
          Invoicify<span className={lightText ? 'text-[#38BDF8]' : 'text-[#2563EB]'}>Pro</span>
        </span>
      )}
    </span>
  );
};
