/** Segment identifiers, in the order they are normally rendered. */
export type SegmentId =
	| "model"
	| "thinking"
	| "dir"
	| "git"
	| "diff"
	| "context"
	| "cache"
	| "tps"
	| "duration"
	| "statuses";

/**
 * Color roles. `accent`/`path`/`vcs`/`speed` are identity colors for the model,
 * directory, branch and throughput; the rest describe state.
 */
export type Role =
	| "accent"
	| "path"
	| "vcs"
	| "speed"
	| "text"
	| "muted"
	| "dim"
	| "success"
	| "error"
	| "warning";

/** A run of text with one color. Segments are made of parts so an icon can share
 * its value's color, and `+12 −3` can be green and red inside one segment. */
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
	/** False for quiet facts that read better as plain colored text than as a block. */
	chip?: boolean;
}
