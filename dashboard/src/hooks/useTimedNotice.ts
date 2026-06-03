import { useCallback, useState } from 'react';

export function useTimedNotice(durationMs = 2500) {
  const [message, setMessage] = useState('');

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      window.setTimeout(() => setMessage(''), durationMs);
    },
    [durationMs],
  );

  const clear = useCallback(() => setMessage(''), []);

  return { message, show, clear };
}
