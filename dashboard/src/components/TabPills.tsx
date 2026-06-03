interface TabPill {
  id: string;
  label: string;
  count?: number;
}

interface TabPillsProps {
  tabs: TabPill[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabPills({ tabs, active, onChange }: TabPillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const isActive = active === t.id;
        const hasCount = (t.count ?? 0) > 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-4 py-2 rounded-xl text-sm border transition-all duration-200 flex items-center gap-2 ${
              isActive
                ? 'border-glow/40 bg-glow/10 text-glow shadow-[0_0_20px_rgba(0,174,239,0.08)]'
                : 'border-surface-border text-gray-400 hover:text-white hover:border-white/15'
            }`}
          >
            {t.label}
            {hasCount && (
              <span
                className={`text-[10px] min-w-[1.25rem] px-1.5 py-0.5 rounded-full font-semibold ${
                  isActive ? 'bg-glow/20 text-glow' : 'bg-white/5 text-gray-500'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
