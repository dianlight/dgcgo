// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'macroMeta'.
macroMeta({ params: {
	holeDiameter: {
		type: 'number',
		default: 3.175,
		required: true,
		description: 'Diameter of hole to mill'
	},
	toolDiameter: {
		type: 'number',
		default: 0.734,
		required: true,
		description: 'Diameter of milling tool'
	},
	depth: {
		type: 'number',
		default: 2,
		required: true,
		description: 'Depth of hole to mill'
	},
	pos: {
		type: [ 'number' ],
		default: null,
		description: 'Position to drill hole at (only x and y are used)',
		isCoordinates: true,
		coordinatesLength: 2
	},
	passDepth: {
		type: 'number',
		default: 0.5,
		required: true,
		description: 'Depth to cut per pass'
	},
	precision: {
		type: 'number',
		default: 0.02,
		required: true
	},
	zClearance: {
		type: 'number',
		default: 1,
		required: true
	},
	feed: {
		type: 'number',
		default: 100,
		required: true
	},
	zFeed: {
		type: 'number',
		default: 50,
		required: true
	},
	climbMill: {
		type: 'boolean',
		default: false,
		required: true
	}
} });

// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'pos'.
if (!pos) {
// @ts-expect-error ts-migrate(1375) FIXME: 'await' expressions are only allowed at the top le... Remove this comment to see the full error message
	await sync();
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'pos'.
	pos = controller.getPos();
}

// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G0 Z${zClearance}`);

// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'toolDiameter'.
if (toolDiameter >= holeDiameter) {
	// degenerate case of a normal drill
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
	push(`G0 X${pos[0]} Y${pos[1]}`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
	push(`G0 Z0`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
	push(`G1 Z${-depth} F${zFeed}`);
} else {
	// mill hole cycle
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'precision'.
	let angleInc = 2 * precision / holeDiameter; // radians
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'passDepth'.
	for (let z = -passDepth; z > -depth - passDepth; z -= passDepth) {
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'depth'.
		if (z < -depth) z = -depth;
		for (let a = 0; a <= 2 * Math.PI; a += angleInc) {
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'holeDiameter'.
			let r = (holeDiameter - toolDiameter) / 2;
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'pos'.
			let x = pos[0] + Math.cos(a) * r;
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'pos'.
			let y = pos[1] + Math.sin(a) * r * (climbMill ? 1 : -1);
			if (a === 0) {
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
				push(`G0 X${x} Y${y}`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
				push(`G0 Z${z + passDepth}`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
				push(`G1 Z${z} F${zFeed}`);
			} else {
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
				push(`G1 X${x} Y${y} F${feed}`);
			}
		}
	}
}

// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G0 Z${zClearance}`);
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'push'.
push(`G0 X${pos[0]} Y${pos[1]}`);


