class Foo {
	test() {
		console.log("test", () => this);
	}
}

function main() {
	console.log("start", () => { });
	const arr = new Array<number>();
	arr.push(1);
	arr.push(2);
	bar(arr);
	console.log("x = ", arr);
}
function bar(arr: number[]) {
	for (let j = 0; j < 5; j++) {
		arr.push(j);
	}
}
main();
