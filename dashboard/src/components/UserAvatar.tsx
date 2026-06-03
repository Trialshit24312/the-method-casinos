import { useMemo, useState, useEffect } from 'react';
import type { User } from '../types';

interface Props {
  user: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  className?: string;
  alt?: string;
}

function defaultAvatarUrl(userId: string): string {
  const index = Number(BigInt(userId) >> 22n) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png?size=128`;
}

export default function UserAvatar({ user, className = '', alt }: Props) {
  const primary = user.avatarUrl || defaultAvatarUrl(user.id);
  const [src, setSrc] = useState(primary);

  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  const fallbacks = useMemo(() => {
    const urls = [primary];
    if (primary.includes('cdn.discordapp.com')) {
      urls.push(primary.replace('cdn.discordapp.com', 'cdn.discord.com'));
    }
    urls.push(defaultAvatarUrl(user.id));
    return [...new Set(urls)];
  }, [primary, user.id]);

  const handleError = () => {
    const current = fallbacks.indexOf(src);
    const next = fallbacks[current + 1];
    if (next) setSrc(next);
  };

  return (
    <img
      src={src}
      alt={alt ?? user.username}
      className={className}
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  );
}
