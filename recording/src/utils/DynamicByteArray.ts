export class DynamicByteArray {
    private _buffer: Int8Array = new Int8Array(1024);
    private _length: number = 0;

    constructor() { }

    public push(byte: number): void {
        if (this._length >= this._buffer.length) {
            const oldBuffer = this._buffer;
            this._buffer = new Int8Array(this._buffer.length * 2);
            this._buffer.set(oldBuffer);
        }
        this._buffer[this._length++] = byte;
    }

    public pushU32(value: number): void {
        this.push((value >>> 24) & 0xff);
        this.push((value >>> 16) & 0xff);
        this.push((value >>> 8) & 0xff);
        this.push(value & 0xff);
    }

    public getBuffer(): Int8Array {
        return this._buffer.slice(0, this._length);
    }
}
