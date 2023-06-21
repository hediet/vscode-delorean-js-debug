#!/usr/bin/env node

import { resolve } from "path";
import { ExecutionRecorder } from "@hediet/code-insight-recording";
import { writeFileSync } from "fs";

process.argv = [...process.argv.slice(0, 1), ...process.argv.slice(2)];

const script = process.argv[1];

interface Global {
	$$CI_f(moduleId: number, functionId: number): void;
	$$CI_b(blockId: number): void;
	$$CI_r(): void;
	$$CI_modules: { [moduleId: number]: string };
}

const global = globalThis as unknown as Global;
const recorder = new ExecutionRecorder((m) => ({
	modulePath: global.$$CI_modules[m],
}));

global.$$CI_f = function (moduleId, functionId) {
	recorder.recordFunction(moduleId, functionId);
};
global.$$CI_b = function (blockId) {
	recorder.recordBlock(blockId);
};
global.$$CI_r = function () {
	recorder.recordReturn();
};

require(resolve(script));

// write recorder.getBuffer() to `out.exec-rec`

writeFileSync(
	resolve(process.cwd(), "out.exec-rec"),
	Buffer.from(recorder.getBuffer())
);
