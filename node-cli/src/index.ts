#!/usr/bin/env node

import { ExecutionRecorder, ISerializedModuleInfo } from "@hediet/code-insight-recording";
import { SourceMapLocation, SourceMapV3WithPath, sourceMapApplyEdit } from "@hediet/sourcemap";
import { existsSync, writeFileSync } from "fs";
import { Module } from "module";
import { dirname, resolve } from "path";
import { createInstrumentationEditsTs } from "./createInstrumentationEditsTs";

const originalCompile = (Module.prototype as any)._compile;
(Module.prototype as any)._compile = function (content: string, filename: string): any {

	let map: SourceMapV3WithPath | undefined = undefined;
	const loc = SourceMapLocation.find(content);
	if (loc) {
		const sourceMappingPath = resolve(dirname(filename), loc.sourceMappingUrl);
		if (existsSync(sourceMappingPath)) {
			map = SourceMapV3WithPath.fromFile(sourceMappingPath);
		}
	}
	const edit = createInstrumentationEditsTs(content, filename, map);

	const updatedMap = map ? sourceMapApplyEdit(map.sourceMap, edit) : undefined;
	const updatedLoc = updatedMap ? SourceMapLocation.createInline(updatedMap) : undefined;

	content = SourceMapLocation.set(content, updatedLoc);
	content = edit.applyToString(content);

	writeFileSync(filename + ".instrumented.js", content);

	console.log('finished transpiling');
	const result = originalCompile.call(this, content, filename);
	return result;
};

process.argv = [...process.argv.slice(0, 1), ...process.argv.slice(2)];

const script = process.argv[1];

interface Global {
	$$CI_f(moduleId: number, functionId: number): void;
	$$CI_b(blockId: number): void;
	$$CI_r(): void;
	$$CI_modules: { [moduleId: number]: ISerializedModuleInfo };
}

const global = globalThis as unknown as Global;
const recorder = new ExecutionRecorder((m) => global.$$CI_modules[m]);

global.$$CI_f = function (moduleId, functionId) {
	recorder.recordFunctionEnter(moduleId, functionId);
};
global.$$CI_b = function (blockId) {
	recorder.recordBlockExecution(blockId);
};
global.$$CI_r = function () {
	recorder.recordFunctionReturn();
};

const e = process.exit;
process.exit = function (...args) {
	console.log('<<< end recording');
	const path = resolve(process.cwd(), "out.exec-rec");
	writeFileSync(path, Buffer.from(recorder.getBuffer()));
	console.log('path', path);

	return e.call(process, ...args);
};

console.log('>>> start recording');

require(resolve(script));

process.exit(0);
