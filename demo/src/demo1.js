eval("\nglobalThis.$$CI_r = (\n\tmoduleId,\n\tmethodId,\n\tblockId\n) => {\n\tconsole.log(\"$$CI_r\", moduleId, methodId, blockId);\n};\n");
var Foo = /** @class */ (function () {
    function Foo() {
    }
    Foo.prototype.test = function () {
        var _this = this;
        console.log("test", function () { return _this; });
    };
    return Foo;
}());
function main() {
    console.log("start", function () { });
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
