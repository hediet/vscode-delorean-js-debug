function main() {
	console.log("start", function () {});
	var arr = new Array();
	arr.push(1);
	arr.push(2);
	bar(arr);
	console.log("x = ", arr);
}
function bar(arr) {
	for (var j = 0; j < 5; j++) {
		arr.push(j);
	}
}
main();
