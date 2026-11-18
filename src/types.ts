/** Segment identifiers, in the order they are normally rendered. */
export type SegmentId =
	| "model"
	| "thinking"
	| "dir"
	| "git"
	| "context"
	| "usage"
	| "duration"
	| "statuses";

/** Theme tokens used by the status line. All are foreground colors. */
export type Role = "accent" | "text" | "muted" | "dim" | "success" | "error" | "warning";

export interface Segment {
	id: SegmentId;
	text: string;
	role: Role;
	/** Optional segments are dropped first when the line does not fit. */
	optional: boolean;
}
