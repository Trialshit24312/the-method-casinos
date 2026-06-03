import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Ban, ShieldCheck, ShieldAlert, HelpCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import type { SiteReport, UrlCheckResult } from '../types';
import { BLOCK_REASON_LABELS } from '../types';

interface Props {
  report: SiteReport;
  onDismiss: () => void;
  onBlock: () => void;
  onPromote?: () => void;
}

export default function ReportRow({ report, onDismiss, onBlock, onPromote }: Props) {
  const [check, setCheck] = useState<UrlCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    setChecking(true);
    api.checkUrl(report.url)
      .then(setCheck)
      .catch(() => setCheck(null))
      .finally(() => setChecking(false));
  }, [report.url]);

  const statusLabel = check?.blocked
    ? 'Blocked / scam'
    : check?.pendingReview
      ? 'In DB — pending review'
      : check?.safe
        ? 'Verified in catalog'
        : check?.casino
          ? 'In DB — unverified'
          : 'Unknown URL';

  return (
    <motion.div layout className="glass-glow p-4 space-y-3 border-gradient">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-amber-400 text-sm mb-1">
            <Flag className="w-4 h-4" />
            {report.reportedBy === 'discovery' ? 'Discovery rejection — review for blocklist' : `Reported by ${report.reportedBy}`}
          </div>
          <a href={report.url} target="_blank" rel="noreferrer" className="text-glow hover:underline break-all">
            {report.url}
          </a>
          <p className="text-xs text-gray-500 mt-1">{report.reason}</p>
          <p className="text-[10px] text-gray-600 mt-1">{new Date(report.createdAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap items-start">
          {onPromote && report.reportedBy === 'discovery' && (
            <button
              type="button"
              onClick={onPromote}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm"
            >
              Save as pending
            </button>
          )}
          <button type="button" onClick={onBlock} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-accent-red/20 text-accent-red border border-accent-red/30 text-sm">
            <Ban className="w-4 h-4" /> Block
          </button>
          <button type="button" onClick={onDismiss} className="btn-secondary text-sm">
            Dismiss
          </button>
        </div>
      </div>

      <div className="pt-2 border-t border-surface-border/60 flex items-start gap-2 text-sm">
        {checking ? (
          <span className="text-gray-500 flex items-center gap-1.5 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking URL…
          </span>
        ) : check ? (
          <>
            {check.blocked ? (
              <ShieldAlert className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
            ) : check.safe ? (
              <ShieldCheck className="w-4 h-4 text-accent-green shrink-0 mt-0.5" />
            ) : (
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-xs text-gray-300">{statusLabel}</p>
              {check.blockedSite && (
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {check.blockedSite.name} — {BLOCK_REASON_LABELS[check.blockedSite.reason]}
                </p>
              )}
              {check.casino && !check.blocked && (
                <p className="text-[10px] text-gray-500 mt-0.5">{check.casino.name}</p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  );
}
