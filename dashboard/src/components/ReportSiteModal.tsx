import { useState, useEffect } from 'react';
import { Flag, X } from 'lucide-react';
import { api } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  initialUrl?: string;
}

export default function ReportSiteModal({ open, onClose, initialUrl = '' }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (open) {
      setUrl(initialUrl);
      setStatus('idle');
      setMessage('');
    }
  }, [open, initialUrl]);

  if (!open) return null;

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setStatus('sending');
    setMessage('');
    try {
      await api.reportUrl(trimmed, reason.trim() || undefined);
      setStatus('done');
      setMessage('Report submitted — admins will review it.');
      setUrl('');
      setReason('');
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Failed to submit');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70" role="dialog" aria-modal>
      <div className="glass-glow w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-white"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-amber-400 mb-3">
          <Flag className="w-5 h-5" />
          <h2 className="font-display font-semibold text-lg text-white">Report a site</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Flag scams, phishing, or misleading sweepstakes sites. Reports go to the admin review queue.
        </p>
        <input
          className="input-field w-full mb-3"
          placeholder="https://suspicious-site.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <textarea
          className="input-field w-full mb-4 min-h-[80px]"
          placeholder="Optional reason (scam, clone, not a casino…)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {message && (
          <p className={`text-sm mb-3 ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{message}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={!url.trim() || status === 'sending'}
            onClick={() => void submit()}
            className="btn-primary text-sm disabled:opacity-40"
          >
            {status === 'sending' ? 'Sending…' : 'Submit report'}
          </button>
        </div>
      </div>
    </div>
  );
}
