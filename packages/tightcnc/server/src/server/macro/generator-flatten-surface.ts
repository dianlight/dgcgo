// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'macroMeta'.
macroMeta({
	params: {
		start: {
			type: 'array',
			elements: { type: 'number', default: 0 },
			default: [ 0, 0, 0 ],
			required: true,
			isCoordinates: true,
			description: 'Starting position for surface clear'
		},
		end: {
			type: 'array',
			elements: { type: 'number', default: 0 },
			default: [ 0, 0, 0 ],
			required: true,
			isCoordinates: true,
			description: 'Ending position for surface clear'
		},
		passDepth: {
			type: 'number',
			default: 1,
			required: true,
			description: 'Maximum Z depth per pass'
		},
		feed: {
			type: 'number',
			default: 150,
			required: true,
			description: 'Feed rate'
		},
		downFeed: {
			type: 'number',
			default: 50,
			required: true,
			description: 'Downward feed rate'
		},
		cutterDiameter: {
			type: 'number',
			default: 3.12,
			required: true,
			description: 'Diameter of milling cutter'
		},
		overlap: {
			type: 'number',
			default: 0.1,
			required: true,
			description: 'Overlap fraction'
		},
		clearance: {
			type: 'number',
			default: 2,
			required: true,
			description: 'Clearance amount over start Z position'
		}
	},
	mergeParams: [ 'begin-generator', 'end-generator' ]
});

// Move to above starting position and start spindle
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G0 Z${start.z + clearance}`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G0 X${start.x} Y${start.y}`);

// @ts-expect-error ts-migrate(1375) FIXME: 'await' expressions are only allowed at the top le... Remove this comment to see the full error message
await runMacro('begin-generator', allparams);

// Move to starting position
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G1 Z${start.z} F${downFeed}`);

// Flatten the surface
let yctr = 0;
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'start'.
for (let z = start.z; z >= end.z; ) {
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
	push(`G1 Z${z} F${downFeed}`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'start'.
	for (let y = start.y; y <= end.y; ) {
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
		push(`G1 Y${y} F${feed}`);
		// Alternate (zig zag)
		if (yctr % 2 === 0) {
// @ts-expect-error ts-migrate(1375) FIXME: 'await' expressions are only allowed at the top le... Remove this comment to see the full error message
			await push(`G1 X${end.x} F${feed}`);
		} else {
// @ts-expect-error ts-migrate(1375) FIXME: 'await' expressions are only allowed at the top le... Remove this comment to see the full error message
			await push(`G1 X${start.x} F${feed}`);
		}
		yctr++;
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'end'.
		if (y >= end.y) break;
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'cutterDiameter'.
		y += cutterDiameter * (1 - overlap);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'end'.
		if (y > end.y) y = end.y;
	}
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'end'.
	if (z <= end.z) break;
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'passDepth'.
	z -= passDepth;
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'end'.
	if (z < end.z) z = end.z;
}

// Move back to clearance position and stop spindle
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G0 Z${start.z + clearance}`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G0 X${start.x} Y${start.y}`);

// @ts-expect-error ts-migrate(1375) FIXME: 'await' expressions are only allowed at the top le... Remove this comment to see the full error message
await runMacro('end-generator', allparams);
