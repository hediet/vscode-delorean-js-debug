/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// This is a facade for the observable implementation. Only import from here!

export {
	IObservable,
	IObserver,
	IReader,
	ISettable,
	ISettableObservable,
	ITransaction,
	IChangeContext,
	IChangeTracker,
	observableValue,
	disposableObservableValue,
	transaction,
	subtransaction,
} from './observableInternal/base';
export {
	derived,
	derivedOpts,
	derivedHandleChanges,
	derivedWithStore,
} from './observableInternal/derived';
export {
	autorun,
	autorunDelta,
	autorunHandleChanges,
	autorunWithStore,
	autorunOpts,
	autorunWithStoreHandleChanges,
} from './observableInternal/autorun';
export {
	IObservableSignal,
	constObservable,
	debouncedObservable,
	derivedObservableWithCache,
	derivedObservableWithWritableCache,
	keepObserved,
	recomputeInitiallyAndOnChange,
	observableFromEvent,
	observableFromPromise,
	observableSignal,
	observableSignalFromEvent,
	wasEventTriggeredRecently,
} from './observableInternal/utils';
export {
	ObservableLazy,
	ObservableLazyPromise,
	ObservablePromise,
	PromiseResult,
	waitForState,
} from './observableInternal/promise';

import { ConsoleObservableLogger, setLogger } from './observableInternal/logging';

// Remove "//" in the next line to enable logging
const enableLogging = false
	// || Boolean("true") // done "weirdly" so that a lint warning prevents you from pushing this
	;

if (enableLogging) {
	setLogger(new ConsoleObservableLogger());
}
