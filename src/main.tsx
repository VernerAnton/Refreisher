import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import RefreisherApp from '../refreisher-app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RefreisherApp />
  </StrictMode>,
);
