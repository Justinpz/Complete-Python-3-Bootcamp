// Port of LEVELED's XPBar idiom: 12px track on ink, glowing cyan fill with a
// white leading-edge tip, "LABEL … Lv N" header row.

import { xpProgress, bandLabel } from '../lib/xp.js';

export default function XPBar({ xp, compact = false, label = 'LEVEL PROGRESS' }) {
  const p = xpProgress(xp);
  const pct = Math.round(p.pct * 100);
  return (
    <div className={`xpbar ${compact ? 'xpbar-compact' : ''}`}>
      <div className="xpbar-head">
        <span className="xpbar-label">{label}</span>
        <span className="xpbar-level">
          {compact ? `Lv ${p.level}` : `${bandLabel(p.level).toUpperCase()} ‧ Lv ${p.level}`}
        </span>
      </div>
      <div className="xpbar-track">
        <div className="xpbar-fill" style={{ width: `${pct}%` }}>
          <div className="xpbar-tip" />
        </div>
      </div>
      {!compact && (
        <div className="xpbar-foot">
          {p.needed > 0 ? `${p.into} / ${p.needed} XP to Lv ${p.level + 1}` : 'MAX LEVEL'}
        </div>
      )}
    </div>
  );
}
