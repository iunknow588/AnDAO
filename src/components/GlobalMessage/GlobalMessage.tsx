import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { WalletMessageDetail } from '@/utils/errors';

const Toast = styled.div<{ $type: 'error' | 'success' }>`
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 2000;
  max-width: min(420px, calc(100vw - 32px));
  padding: 12px 14px;
  border-radius: 10px;
  color: #fff;
  font-size: 14px;
  line-height: 1.5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  background: ${(props) => (props.$type === 'error' ? '#d9480f' : '#2b8a3e')};
`;

export function GlobalMessage(): JSX.Element | null {
  const [message, setMessage] = useState<WalletMessageDetail | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMessage = (event: Event) => {
      const detail = (event as CustomEvent<WalletMessageDetail>).detail;
      if (!detail?.message) return;
      setMessage(detail);

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, 4500);
    };

    window.addEventListener('wallet:message', handleMessage as EventListener);
    return () => {
      window.removeEventListener('wallet:message', handleMessage as EventListener);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!message) return null;
  return <Toast $type={message.type}>{message.message}</Toast>;
}
