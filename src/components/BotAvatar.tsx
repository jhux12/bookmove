import React, { useState } from 'react';
import { BotProfile } from '../types/chess';

interface BotAvatarProps {
  bot: BotProfile;
  sizeClass?: string;
  className?: string;
}

export const BotAvatar: React.FC<BotAvatarProps> = ({
  bot,
  sizeClass = 'w-11 h-11',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-[#0F151E] border border-slate-400/15 flex items-center justify-center ${sizeClass} ${className}`}
    >
      {!imgFailed ? (
        <img
          src={bot.avatarUrl}
          alt={`${bot.name} (${bot.elo} Elo) chess bot portrait`}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-display font-bold text-white/90 text-base select-none"
          style={{
            background: `linear-gradient(135deg, ${bot.accentColor}44 0%, #0F151E 100%)`,
          }}
        >
          {bot.name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
};
