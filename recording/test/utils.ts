export abstract class Random {
    public static basicAlphabet: string = '      abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    public static basicAlphabetMultiline: string = '      \n\n\nabcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    public static create(seed: number): Random {
        return new MersenneTwister(seed);
    }

    public abstract nextIntRange(start: number, endExclusive: number): number;

    public nextString(length: number, alphabet = Random.basicAlphabet): string {
        let randomText: string = '';
        for (let i = 0; i < length; i++) {
            const characterIndex = this.nextIntRange(0, alphabet.length);
            randomText += alphabet.charAt(characterIndex);
        }
        return randomText;
    }
}

class MersenneTwister extends Random {
    private readonly mt = new Array(624);
    private index = 0;

    constructor(seed: number) {
        super();

        this.mt[0] = seed >>> 0;
        for (let i = 1; i < 624; i++) {
            const s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (((((s & 0xffff0000) >>> 16) * 0x6c078965) << 16) + (s & 0x0000ffff) * 0x6c078965 + i) >>> 0;
        }
    }

    private _nextInt() {
        if (this.index === 0) {
            this.generateNumbers();
        }

        let y = this.mt[this.index];
        y = y ^ (y >>> 11);
        y = y ^ ((y << 7) & 0x9d2c5680);
        y = y ^ ((y << 15) & 0xefc60000);
        y = y ^ (y >>> 18);

        this.index = (this.index + 1) % 624;

        return y >>> 0;
    }

    public nextIntRange(start: number, endExclusive: number) {
        const range = endExclusive - start;
        return Math.floor(this._nextInt() / (0x100000000 / range)) + start;
    }

    private generateNumbers() {
        for (let i = 0; i < 624; i++) {
            const y = (this.mt[i] & 0x80000000) + (this.mt[(i + 1) % 624] & 0x7fffffff);
            this.mt[i] = this.mt[(i + 397) % 624] ^ (y >>> 1);
            if ((y % 2) !== 0) {
                this.mt[i] = this.mt[i] ^ 0x9908b0df;
            }
        }
    }
}
