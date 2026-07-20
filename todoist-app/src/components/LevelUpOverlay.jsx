import { useEffect } from 'react';
import { useStore } from '../store/store.js';
import { bandLabel } from '../lib/xp.js';

export default function LevelUpOverlay() {
  const levelUp = useStore((s) => s.levelUp);
  const clearLevelUp = useStore((s) => s.clearLevelUp);

  useEffect(() => {
    if (!levelUp) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') clearLevelUp();
    };
    const t = setTimeout(clearLevelUp, 4200);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [levelUp, clearLevelUp]);

  if (!levelUp) return null;
  return (
    <div className="levelup-scrim" onClick={clearLevelUp} role="presentation">
      <div className="levelup-card">
        <div className="levelup-kicker">LEVEL UP</div>
        <div className="levelup-number">{levelUp.level}</div>
        <div className="levelup-band">{bandLabel(levelUp.level).toUpperCase()}</div>
      </div>
    </div>
  );
}
