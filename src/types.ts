/** Segment identifiers, in the order they are normally rendered. */
export type SegmentId =
	| "model"
	| "thinking"
	| "dir"
	| "git"
	| "context"
	| "cache"
	| "tps"
	| "duration"
	| "statuses";

/** Theme tokens used by the status line. All are foreground colors. */
export type Role = "accent" | "text" | "muted" | "dim" | "success" | "error" | "warning";

/** A run of text with one color. Segments are made of parts so an icon can be
 * dim while its value is bright, and `+12 −3` can be green and red. */
export interface Part {
	text: string;
	role: Role;
	bold?: boolean;
}

export interface Segment {
	id: SegmentId;
	parts: Part[];
	/** Optional segments are dropped first when the line does not fit. */
	optional: boolean;
}
