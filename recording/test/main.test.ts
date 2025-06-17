import { expect, test } from 'vitest';

import { ExecutionRecorder, Recording, TextPos } from "../src/index";
import { readFile } from "fs/promises";
import { join } from "path";
import { Random } from './utils';
import { InstructionWriter } from '../src/ExecutionRecorder';
import { CallFunctionInstruction, Instruction, ReachedBlockInstruction, ReturnFunctionInstruction, SetModuleIdInstruction } from '../src/Instruction';
import assert from 'assert';

test('main', async () => {
	console.log('main');

	const data = await readFile(join(__dirname, '..\\..\\out.exec-rec'));
	const r = await Recording.load(data);

	for (let i = 0; i < 100; i++) {
		console.log(r.getStack(i).toString());
		console.log('----------');
	}
});

test('recording', async () => {
	const random = Random.create(0);
	const functionCount = 5000;

	const writer = new InstructionWriter();

	let depth = 0;
	let instructions: Instruction[] = [];

	for (let i = 0; i < 100; i++) {
		const r = random.nextIntRange(0, 4);
		let i: Instruction;
		if (r === 0) {
			i = new ReachedBlockInstruction(random.nextIntRange(0, 100));
		} else if (r === 1 && depth < 30) {
			depth++;
			i = new CallFunctionInstruction(random.nextIntRange(0, functionCount));
		} else if (r === 2 && 0 < depth) {
			depth--;
			i = new ReturnFunctionInstruction();
		} else if (r === 4) {
			i = new SetModuleIdInstruction(random.nextIntRange(0, 10000));
		} else {
			continue;
		}

		instructions.push(i);
		i.writeInstruction(writer);
	}

	const r = await Recording.load(Buffer.from(writer.getBuffer()));
	const decodedInstructions = r.decode();

	assert.deepStrictEqual(
		decodedInstructions.map(i => i.toString()),
		instructions.map(i => i.toString())
	);
});
