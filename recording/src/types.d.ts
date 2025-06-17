declare module "*.wasm" {
    export default function (): Promise<Buffer>;
}