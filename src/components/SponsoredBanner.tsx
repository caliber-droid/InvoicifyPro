import React from 'react';

interface SponsoredBannerProps {
  className?: string;
}

export const SponsoredBanner: React.FC<SponsoredBannerProps> = ({ className = '' }) => {
  return (
    <div className={`w-full px-4 sm:px-6 py-3 bg-[#F5F7FA] border-b border-slate-200/80 ${className}`}>
      <a
        href="https://26d2do3927nbb7bhwet66u-jjo.hop.clickbank.net"
        target="_blank"
        rel="noopener sponsored nofollow"
        className="block max-w-[970px] mx-auto rounded-lg overflow-hidden"
      >
        <img
          src="/assets/aistudio/slimcrystal-banner-970x250_360e4dcd.png"
          alt="SlimCrystal - The Slimming Crystal Water Bottle - Save up to $200"
          width={970}
          height={250}
          className="block mx-auto max-w-full h-auto border-0"
        />
      </a>
    </div>
  );
};

export const SponsoredLeaderboardBanner: React.FC<SponsoredBannerProps> = ({ className = '' }) => {
  return (
    <div className={`w-full px-4 sm:px-6 py-4 flex justify-center ${className}`}>
      <a
        href="https://d1382nx7s1gyp9fmvhh4ziof3n.hop.clickbank.net"
        target="_blank"
        rel="noopener sponsored nofollow"
        className="block max-w-[970px] mx-auto rounded-lg overflow-hidden"
      >
        <img
          src="/assets/aistudio/prodentim-banner-970x90_1f82319a.png"
          alt="ProDentim - Want a Healthier Smile? Try ProDentim Today"
          width={970}
          height={90}
          className="block mx-auto max-w-full h-auto border-0"
        />
      </a>
    </div>
  );
};
