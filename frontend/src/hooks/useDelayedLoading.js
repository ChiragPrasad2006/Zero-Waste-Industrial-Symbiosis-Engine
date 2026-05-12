import { useEffect, useState } from 'react';

export function useDelayedLoading(active, delay = 900) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timer;
    if (active) {
      timer = setTimeout(() => setShow(true), delay);
    } else {
      setShow(false);
    }
    return () => clearTimeout(timer);
  }, [active, delay]);

  return show;
}

