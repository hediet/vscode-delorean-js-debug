export class ExecutionRecorder {
	private readonly _buffer = new DynamicByteArray();
	private lastModuleId: number = -1;

	private readonly resolvedModules = new Set<number>();

	constructor(
		private readonly resolveModuleId: (moduleId: number) => {
			modulePath: string;
		}
	) {}

	public getBuffer(): Int8Array {
		return this._buffer.getBuffer();
	}

	public recordFunction(moduleId: number, functionId: number): void {
		if (moduleId !== this.lastModuleId) {
			writeInstruction(Instruction.SetModuleId, moduleId, this._buffer);
			this.writeModuleIdPath(moduleId);
			this.lastModuleId = moduleId;
		}

		writeInstruction(Instruction.CallFunction, functionId, this._buffer);
	}

	private writeModuleIdPath(moduleId: number): void {
		if (this.resolvedModules.has(moduleId)) {
			return;
		}
		this.resolvedModules.add(moduleId);

		const { modulePath } = this.resolveModuleId(moduleId);
		const modulePathBytes = new TextEncoder().encode(modulePath);

		this._buffer.push(Instruction.SetModulePath);
		// write length
		this._buffer.push((modulePathBytes.length >>> 24) & 0b111111);
		this._buffer.push((modulePathBytes.length >>> 16) & 0b111111);
		this._buffer.push((modulePathBytes.length >>> 8) & 0b111111);
		this._buffer.push(modulePathBytes.length & 0b111111);

		// write path
		for (let i = 0; i < modulePathBytes.length; i++) {
			this._buffer.push(modulePathBytes[i]);
		}
	}

	public recordBlock(blockId: number): void {
		writeInstruction(Instruction.Block, blockId, this._buffer);
	}

	public recordReturn(): void {
		this._buffer.push(Instruction.Return);
	}
}

const enum Instruction {
	SetModuleId = 0b00000000,
	CallFunction = 0b01000000,
	Block = 0b10000000,
	Return = 0b11000000,
	SetModulePath = 0b11000001,
}

function writeInstruction(
	instruction: Instruction,
	n: number,
	buffer: DynamicByteArray
): void {
	if (n < 62) {
		buffer.push(instruction | n);
	} else if (n < 256) {
		buffer.push(instruction | 0b111101);
		buffer.push(n);
	} else if (n < 256 * 256) {
		buffer.push(instruction | 0b111110);
		buffer.push((n >>> 8) & 0b111111);
		buffer.push(n & 0b111111);
	} else if (n < 256 * 256 * 256) {
		buffer.push(instruction | 0b111111);
		buffer.push((n >>> 16) & 0b111111);
		buffer.push((n >>> 8) & 0b111111);
		buffer.push(n & 0b111111);
	} else {
		throw new Error("value is too big");
	}
}

class DynamicByteArray {
	private _buffer: Int8Array = new Int8Array(1024);
	private _length: number = 0;

	constructor() {}

	public push(byte: number): void {
		if (this._length >= this._buffer.length) {
			const oldBuffer = this._buffer;
			this._buffer = new Int8Array(this._buffer.length * 2);
			this._buffer.set(oldBuffer);
		}
		this._buffer[this._length++] = byte;
	}

	public getBuffer(): Int8Array {
		console.log(this._length);
		return this._buffer.slice(0, this._length);
	}
}

/*

Instructions:
* Set module id
	* 00[xx.xxxx byte*]
* Call function
	* 01[xx.xxxx byte*]
* Block
	* 10[xx.xxxx byte*]
* Return
	* 1100.0000
* Module Id Info:
	* 1100.0001
	* [32bit length bytes]
	* module path

[xx.xxxx byte*]:
	* For values in [0 .. 61): [00.0000 .. 11.1101), 0 bytes
	* they use 1,2 or 3 bytes:
		11.1101: 1 byte
		11.1110: 2 bytes
		11.1111: 3 bytes

*/
