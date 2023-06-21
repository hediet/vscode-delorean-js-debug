class Foo {
	test() {
		console.log("test", () => this);
	}
}

function main() {
	console.log("start", () => {});
	const arr = new Array<number>();
	arr.push(1);
	arr.push(2);
	bar(arr);
	console.log("x = ", arr);

	console.log(fib(5));
}

function fib(n: number): number {
	if (n < 2) {
		return n;
	}
	return fib(n - 1) + fib(n - 2);
}

function bar(arr: number[]) {
	for (let j = 0; j < 5; j++) {
		arr.push(j);
	}
}

main();
