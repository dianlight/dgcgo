// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'macroMeta'.
macroMeta({ params: {
	spindle: {
		type: 'boolean',
		default: true,
		required: true,
		description: 'Whether to turn spindle on'
	},
	floodCoolant: {
		type: 'boolean',
		default: false,
		description: 'Flood coolant'
	},
	mistCoolant: {
		type: 'boolean',
		default: false,
		description: 'Mist coolant'
	}
} });

// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'spindle'.
if (spindle) push('M5');
// @ts-expect-error ts-migrate(2304) FIXME: Cannot find name 'floodCoolant'.
if (floodCoolant || mistCoolant) push('M9');

