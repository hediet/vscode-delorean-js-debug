import typescript from "@rollup/plugin-typescript";
import del from "rollup-plugin-delete";
import { wasm } from "@rollup/plugin-wasm";

export default {
	input: "src/index.ts",
	output: {
		file: "dist/index.js",
		format: "cjs",
		sourcemap: true,
	},
	plugins: [
		del({ targets: "dist/*" }),
		typescript({ sourceMap: true }),
		wasm(),
	],
};
