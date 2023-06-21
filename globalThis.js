globalThis.lastInstructions = [];

globalThis.$$CI_f = (moduleId, functionId) => {
	if (globalThis.lastInstructions.length < 100_000) {
		globalThis.lastInstructions.push(`f: ${moduleId} ${functionId}`);
	}
};

globalThis.$$CI_b = (blockId) => {
	if (globalThis.lastInstructions.length < 100_000) {
		globalThis.lastInstructions.push(`b: ${blockId}`);
	}
};

globalThis.$$CI_r = () => {
	if (globalThis.lastInstructions.length < 100_000) {
		globalThis.lastInstructions.push(`r`);
	}
};
