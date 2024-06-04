import { expect, test } from 'vitest'
import { createInstrumentationEditsTs } from '../src/createInstrumentationEditsTs';

test('test1', () => {
	const src = `
class Foo {
	test() {
		console.log("test", () => this);
	}
}

function main() {
	console.log("start", () => {});
	const arr = new Array();
	arr.push(1);
	arr.push(2);
	bar(arr);
	console.log("x = ", arr);
}
function bar(arr) {
	for (let j = 0; j < 5; j++) {
		if (j % 2 === 0) {
			arr.push(j);
		}
	}
}
main();
`;
	const edits = createInstrumentationEditsTs(src);
	const src2 = edits.applyToString(src);
	console.log(src2);
});
