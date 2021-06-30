import { Disposable } from "@hediet/std/disposable";
import { EventEmitter } from "@hediet/std/events";
import { readFileSync } from "fs";
import Cdp from "./api";
import { CdpSession } from "./CdpSession";

export class StepBackFeature {
	public readonly dispose = Disposable.fn();

	private readonly onPauseEmitter =
		new EventEmitter<Cdp.Debugger.PausedEvent>();
	private readonly onPaused = this.onPauseEmitter.asEvent();

	constructor(private readonly session: CdpSession) {
		this.dispose.track(
			session.api.Debugger.on("paused", (event) => {
				this.onPauseEmitter.emit(event);
			})
		);
	}

	public async stepBack(): Promise<void> {
		const lastPausedEvent = this.session.lastPausedEvent;
		if (!lastPausedEvent) {
			throw new Error("not paused");
		}
		const lastFrame = lastPausedEvent.callFrames[0];
		const lastCallFrameId = lastFrame.callFrameId;

		const restartableFrames = await this.getRestartableFrames(
			lastPausedEvent
		);

		await this.session.api.Runtime.addBinding({
			name: "$$DLRN_send",
		});
		const beforeBusyLoop = new Promise((resolve) => {
			this.session.api.Runtime.on("bindingCalled", (e) => {
				if (e.payload === "beforeBusyLoop") {
					resolve(e);
				}
			});
		});

		const script = readFileSync(
			require.resolve("../resources/stepBackScript-content"),
			{ encoding: "utf-8" }
		);
		const result = await this.session.api.Debugger.evaluateOnCallFrame({
			callFrameId: lastCallFrameId,
			expression: script,
		});
		if (!result) {
			throw new Error();
		}
		if (result.result.type !== "string") {
			throw new Error();
		}
		const data = JSON.parse(result.result.value) as {
			targetLevel: number;
			currentLevel: number;
		};

		// highest level first
		restartableFrames.sort((a, b) => b.level - a.level);
		const frameToRestart = restartableFrames.find(
			(f) => f.level <= data.targetLevel
		);
		if (!frameToRestart) {
			await this.session.api.Runtime.evaluate({
				expression: `globalThis.$$DLRN_clear()`,
			});
			throw new Error("No frame to restart");
		}

		await this.session.api.Debugger.evaluateOnCallFrame({
			callFrameId: lastCallFrameId,
			expression: `globalThis.$$DLRN_l_base = ${frameToRestart.level};`,
		});

		await this.session.api.Debugger.restartFrame({
			callFrameId: frameToRestart.callFrameId,
		});

		await this.session.api.Debugger.setBreakpointsActive({ active: false });

		await this.session.api.Debugger.resume({});

		await beforeBusyLoop;
		await this.session.api.Debugger.setBreakpointsActive({
			active: true,
		});

		await this.doAndWaitForPaused(async () => {
			await this.session.api.Runtime.evaluate({
				expression: `globalThis.$$DLRN_breakpointsEnabled = true`,
			});
		});

		await this.doAndWaitForPaused(() =>
			this.session.api.Debugger.stepOut({})
		);
	}

	private async getRestartableFrames(
		lastPausedEvent: Cdp.Debugger.PausedEvent
	): Promise<RestartableFrame[]> {
		const restartableFrames = new Array<RestartableFrame>();
		await Promise.all(
			lastPausedEvent.callFrames.map(async (frame) => {
				const callFrameId = frame.callFrameId;
				if (!callFrameId) {
					return undefined;
				}
				const result =
					await this.session.api.Debugger.evaluateOnCallFrame({
						callFrameId,
						expression: `${varCanRestart} ? ${varLocalLevel} : -1`,
					});
				if (!result) {
					return;
				}
				if (result.result.type === "number") {
					restartableFrames.push({
						level: result.result.value,
						callFrameId,
						frame,
					});
				}
			})
		);

		if (restartableFrames.length === 0) {
			await Promise.all(
				lastPausedEvent.callFrames.map(async (frame) => {
					const callFrameId = frame.callFrameId;
					if (!callFrameId) {
						return undefined;
					}
					const result =
						await this.session.api.Debugger.evaluateOnCallFrame({
							callFrameId,
							expression: varLocalLevel,
						});
					if (!result) {
						return;
					}

					if (result.result.type === "number") {
						restartableFrames.push({
							level: result.result.value,
							callFrameId,
							frame,
						});
					}
				})
			);
		}

		return restartableFrames;
	}

	private async doAndWaitForPaused<T>(body: () => Promise<T>): Promise<T> {
		const paused = this.onPaused.waitOne();
		const result = await body();
		await paused;
		return result;
	}
}

export interface RestartableFrame {
	level: number;
	callFrameId: string;
	frame: Cdp.Debugger.CallFrame;
}

const varGlobalLevel = "$$DLRN_l";
const varLocalLevel = "$$DLRN_k";
const varElements = "$$DLRN_e";
const varInstructionCounts = "$$DLRN_i";
const varCanRestart = "$$DLRN_r";
