/** Number, duration and cost formatting. Kept pure so tests do not need pi. */

export function fmtTokens(n: number): string {
	if (!Number.isFinite(n) || n <= 0) return "0";
	if (n < 1000) return String(Math.round(n));
	if (n < 10_000) return `${trimZero((n / 1000).toFixed(1))}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	return `${trimZero((n / 1_000_000).toFixed(1))}M`;
}

export function fmtDuration(ms: number): string {
	const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
	if (total < 60) return `${total}s`;
	const minutes = Math.floor(total / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return minutes % 60 ? `${hours}h${minutes % 60}m` : `${hours}h`;
	const days = Math.floor(hours / 24);
	return hours % 24 ? `${days}d${hours % 24}h` : `${days}d`;
}

export function fmtCost(usd: number): string {
	if (!Number.isFinite(usd) || usd <= 0) return "$0";
	if (usd < 0.01) return "<$0.01";
	if (usd < 10) return `$${usd.toFixed(2)}`;
	return `$${usd.toFixed(1)}`;
}

export function fmtPercent(percent: number | null | undefined): string {
	if (percent === null || percent === undefined || !Number.isFinite(percent)) return "?";
	return percent >= 10 ? `${Math.round(percent)}%` : `${percent.toFixed(1)}%`;
}

/** Last path component, tolerating Windows separators and trailing slashes. */
export function basename(path: string): string {
	const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
	const cut = normalized.slice(normalized.lastIndexOf("/") + 1);
	return cut || normalized || "/";
}

/**
 * Short model label: drops a vendor prefix and a trailing snapshot date, then
 * cuts to `max` columns. `~/.pi/agent/statusline.json` can override names.
 */
export function shortModel(id: string | undefined, max = 24): string {
	if (!id) return "no-model";
	const tail = id.split("/").filter(Boolean).pop() ?? id;
	let name = tail.replace(/-\d{8}$/, "");
	if (name.length > max) name = `${name.slice(0, max - 1)}…`;
	return name;
}

function trimZero(value: string): string {
	return value.replace(/\.0$/, "");
}
