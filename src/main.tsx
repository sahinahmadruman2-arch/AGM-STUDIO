import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

function showFatalStartupBanner(reason: string) {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) return;

  const box = document.createElement('div');
  box.style.cssText =
    'min-height:100vh;background:#060911;color:#f1f5f9;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px;';
  const card = document.createElement('div');
  card.style.cssText =
    'max-width:460px;width:100%;background:#0B1120;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:24px;';
  const title = document.createElement('h1');
  title.textContent = 'AGM Studio Failed to Start';
  title.style.cssText = 'font-size:18px;font-weight:600;margin:0 0 10px 0;';
  const msg = document.createElement('p');
  msg.textContent = reason;
  msg.style.cssText = 'font-size:13px;line-height:1.5;color:#cbd5e1;margin:0 0 16px 0;word-break:break-word;';
  const btn = document.createElement('button');
  btn.textContent = 'Reload Application';
  btn.style.cssText =
    'background:#059669;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;cursor:pointer;';
  btn.onclick = () => window.location.reload();
  card.append(title, msg, btn);
  box.append(card);
  root.append(box);
}

window.addEventListener('error', (event) => {
  console.error('Global runtime error:', event.error ?? event.message);
  showFatalStartupBanner(event.message || 'An unexpected JavaScript error occurred.');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Root mount element (#root) was not found in the document.');
  }
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} catch (err) {
  showFatalStartupBanner(err instanceof Error ? err.message : 'Unable to mount AGM Studio.');
}
