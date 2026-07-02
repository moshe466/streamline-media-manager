import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'cyan' | 'green' | 'red' | 'yellow';
};

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color = 'cyan'
}: Props) {

  const colors = {
    cyan: "border-cyan-400/15 text-cyan-200",
    green: "border-emerald-400/15 text-emerald-200",
    red: "border-red-400/15 text-red-200",
    yellow: "border-yellow-400/15 text-yellow-200",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border bg-slate-950/80 backdrop-blur-sm p-5",
        "shadow-[0_0_30px_rgba(0,212,255,0.03)]",
        colors[color]
      )}
    >
      <div className="flex items-center justify-between">
        <div>{icon}</div>
        <div className="text-sm text-slate-400">{title}</div>
      </div>

      <div className="mt-4 text-4xl font-bold">
        {value}
      </div>

      {subtitle && (
        <div className="mt-2 text-xs text-slate-500">
          {subtitle}
        </div>
      )}
    </div>
  );
}
