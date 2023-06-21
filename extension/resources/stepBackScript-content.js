(() => {
	const currentLevel = globalThis.$$DLRN_l - 1;
	const currentElements = [];
	const currentIc = [];
	for (let i = 0; i <= currentLevel; i++) {
		currentElements[i] = globalThis.$$DLRN_e[i];
		currentIc[i] = globalThis.$$DLRN_i[i];
	}

	const targetElements = [...currentElements];
	const targetIc = [...currentIc];
	let targetLevel = currentLevel;
	targetIc[targetLevel]--;

	if (targetIc[targetLevel] <= 0 && targetLevel > 0) {
		targetLevel--;
	}

	function isAtOrAfterTarget() {
		for (let i = 0; i <= targetLevel && i < globalThis.$$DLRN_l; i++) {
			if (globalThis.$$DLRN_e[i] !== targetElements[i]) {
				return false;
			}
			if (globalThis.$$DLRN_i[i] < targetIc[i]) {
				return false;
			}
			if (globalThis.$$DLRN_i[i] > targetIc[i]) {
				return true;
			}
		}
		const result = globalThis.$$DLRN_l - 1 >= targetLevel;
		return result;
	}

	globalThis.$$DLRN_clear = () => {
		globalThis.$$DLRN_i = [...globalThis.$$DLRN_i];
		Object.defineProperty(globalThis, "$$DLRN_l", {
			configurable: true,
			writable: true,
			value: globalThis.$$DLRN_l,
		});
	};

	function notifyDebuggerBeforeBusyLoop() {
		$$DLRN_clear();

		globalThis.$$DLRN_breakpointsEnabled = false;
		globalThis.$$DLRN_send("beforeBusyLoop");
	}

	let ic = [...globalThis.$$DLRN_i];
	for (let i = 0; i <= currentLevel; i++) {
		const lvl = i;
		Object.defineProperty(globalThis.$$DLRN_i, lvl, {
			configurable: true,
			get: function () {
				return ic[lvl];
			},
			set: function (value) {
				ic[lvl] = value;
				if (isAtOrAfterTarget()) {
					let i = 0;
					notifyDebuggerBeforeBusyLoop();
					console.log("before busy loop 1");
					while (!globalThis.$$DLRN_breakpointsEnabled) {
						i++;
					}
					console.log("after busy loop 1");
				}
			},
		});
	}

	globalThis.$$DLRN_l_base = globalThis.$$DLRN_l;
	Object.defineProperty(globalThis, "$$DLRN_l", {
		configurable: true,
		get: function () {
			return globalThis.$$DLRN_l_base;
		},
		set: function (value) {
			if (value < globalThis.$$DLRN_l_base && isAtOrAfterTarget()) {
				notifyDebuggerBeforeBusyLoop();
				let i = 0;
				console.log("before busy loop 2");
				while (!globalThis.$$DLRN_breakpointsEnabled) {
					i++;
				}
				console.log("after busy loop 2");
			}
			globalThis.$$DLRN_l_base = value;
		},
	});

	// return JSON.stringify({ targetLevel, targetIc, targetElements, currentLevel });
	return JSON.stringify({ targetLevel, currentLevel });
})();
