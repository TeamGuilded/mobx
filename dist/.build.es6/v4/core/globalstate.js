import { getGlobal, fail } from "../internal"
/**
 * These values will persist if global state is reset
 */
const persistentKeys = [
    "mobxGuid",
    "spyListeners",
    "enforceActions",
    "computedRequiresReaction",
    "reactionRequiresObservable",
    "observableRequiresReaction",
    "allowStateReads",
    "disableErrorBoundaries",
    "runId",
    "UNCHANGED"
]
export class MobXGlobals {
    constructor() {
        /**
         * MobXGlobals version.
         * MobX compatiblity with other versions loaded in memory as long as this version matches.
         * It indicates that the global state still stores similar information
         *
         * N.B: this version is unrelated to the package version of MobX, and is only the version of the
         * internal state storage of MobX, and can be the same across many different package versions
         */
        this.version = 4
        /**
         * globally unique token to signal unchanged
         */
        this.UNCHANGED = {}
        /**
         * Currently running derivation
         */
        this.trackingDerivation = null
        /**
         * Are we running a computation currently? (not a reaction)
         */
        this.computationDepth = 0
        /**
         * Each time a derivation is tracked, it is assigned a unique run-id
         */
        this.runId = 0
        /**
         * 'guid' for general purpose. Will be persisted amongst resets.
         */
        this.mobxGuid = 0
        /**
         * Are we in a batch block? (and how many of them)
         */
        this.inBatch = 0
        /**
         * Observables that don't have observers anymore, and are about to be
         * suspended, unless somebody else accesses it in the same batch
         *
         * @type {IObservable[]}
         */
        this.pendingUnobservations = []
        /**
         * List of scheduled, not yet executed, reactions.
         */
        this.pendingReactions = []
        /**
         * Are we currently processing reactions?
         */
        this.isRunningReactions = false
        /**
         * Is it allowed to change observables at this point?
         * In general, MobX doesn't allow that when running computations and React.render.
         * To ensure that those functions stay pure.
         */
        this.allowStateChanges = true
        /**
         * Is it allowed to read observables at this point?
         * Used to hold the state needed for `observableRequiresReaction`
         */
        this.allowStateReads = true
        /**
         * If strict mode is enabled, state changes are by default not allowed
         */
        this.enforceActions = false
        /**
         * Spy callbacks
         */
        this.spyListeners = []
        /**
         * Globally attached error handlers that react specifically to errors in reactions
         */
        this.globalReactionErrorHandlers = []
        /**
         * Warn if computed values are accessed outside a reactive context
         */
        this.computedRequiresReaction = false
        /**
         * (Experimental)
         * Warn if you try to create to derivation / reactive context without accessing any observable.
         */
        this.reactionRequiresObservable = false
        /**
         * (Experimental)
         * Warn if observables are accessed outside a reactive context
         */
        this.observableRequiresReaction = false
        /**
         * Allows overwriting of computed properties, useful in tests but not prod as it can cause
         * memory leaks. See https://github.com/mobxjs/mobx/issues/1867
         */
        this.computedConfigurable = false
        /*
         * Don't catch and rethrow exceptions. This is useful for inspecting the state of
         * the stack when an exception occurs while debugging.
         */
        this.disableErrorBoundaries = false
        /*
         * If true, we are already handling an exception in an action. Any errors in reactions should be supressed, as
         * they are not the cause, see: https://github.com/mobxjs/mobx/issues/1836
         */
        this.suppressReactionErrors = false
    }
}
let canMergeGlobalState = true
let isolateCalled = false
export let globalState = (function() {
    const global = getGlobal()
    if (global.__mobxInstanceCount > 0 && !global.__mobxGlobals) canMergeGlobalState = false
    if (global.__mobxGlobals && global.__mobxGlobals.version !== new MobXGlobals().version)
        canMergeGlobalState = false
    if (!canMergeGlobalState) {
        setTimeout(() => {
            if (!isolateCalled) {
                fail(
                    "There are multiple, different versions of MobX active. Make sure MobX is loaded only once or use `configure({ isolateGlobalState: true })`"
                )
            }
        }, 1)
        return new MobXGlobals()
    } else if (global.__mobxGlobals) {
        global.__mobxInstanceCount += 1
        if (!global.__mobxGlobals.UNCHANGED) global.__mobxGlobals.UNCHANGED = {} // make merge backward compatible
        return global.__mobxGlobals
    } else {
        global.__mobxInstanceCount = 1
        return (global.__mobxGlobals = new MobXGlobals())
    }
})()
export function isolateGlobalState() {
    if (
        globalState.pendingReactions.length ||
        globalState.inBatch ||
        globalState.isRunningReactions
    )
        fail("isolateGlobalState should be called before MobX is running any reactions")
    isolateCalled = true
    if (canMergeGlobalState) {
        if (--getGlobal().__mobxInstanceCount === 0) getGlobal().__mobxGlobals = undefined
        globalState = new MobXGlobals()
    }
}
export function getGlobalState() {
    return globalState
}
/**
 * For testing purposes only; this will break the internal state of existing observables,
 * but can be used to get back at a stable state after throwing errors
 */
export function resetGlobalState() {
    const defaultGlobals = new MobXGlobals()
    for (let key in defaultGlobals)
        if (persistentKeys.indexOf(key) === -1) globalState[key] = defaultGlobals[key]
    globalState.allowStateChanges = !globalState.enforceActions
}
