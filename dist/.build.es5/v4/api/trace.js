import { globalState, TraceMode, getAtom, fail } from "../internal"
export function trace() {
    var args = []
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i] = arguments[_i]
    }
    var enterBreakPoint = false
    if (typeof args[args.length - 1] === "boolean") enterBreakPoint = args.pop()
    var derivation = getAtomFromArgs(args)
    if (!derivation) {
        return fail(
            process.env.NODE_ENV !== "production" &&
                "'trace(break?)' can only be used inside a tracked computed value or a Reaction. Consider passing in the computed value or reaction explicitly"
        )
    }
    if (derivation.isTracing === TraceMode.NONE) {
        console.log("[mobx.trace] '" + derivation.name + "' tracing enabled")
    }
    derivation.isTracing = enterBreakPoint ? TraceMode.BREAK : TraceMode.LOG
}
function getAtomFromArgs(args) {
    switch (args.length) {
        case 0:
            return globalState.trackingDerivation
        case 1:
            return getAtom(args[0])
        case 2:
            return getAtom(args[0], args[1])
    }
}
