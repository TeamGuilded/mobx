import {
    IDerivationState,
    trackDerivedFunction,
    clearObserving,
    shouldCompute,
    isCaughtException,
    TraceMode,
    getNextId,
    globalState,
    startBatch,
    isSpyEnabled,
    spyReport,
    endBatch,
    spyReportStart,
    spyReportEnd,
    trace,
    createInstanceofPredicate
} from "../internal"
var Reaction = /** @class */ (function() {
    function Reaction(name, onInvalidate, errorHandler, requiresObservable) {
        if (name === void 0) {
            name = "Reaction@" + getNextId()
        }
        if (requiresObservable === void 0) {
            requiresObservable = false
        }
        this.name = name
        this.onInvalidate = onInvalidate
        this.errorHandler = errorHandler
        this.requiresObservable = requiresObservable
        this.observing = [] // nodes we are looking at. Our value depends on these nodes
        this.newObserving = []
        this.dependenciesState = IDerivationState.NOT_TRACKING
        this.diffValue = 0
        this.runId = 0
        this.unboundDepsCount = 0
        this.__mapid = "#" + getNextId()
        this.isDisposed = false
        this._isScheduled = false
        this._isTrackPending = false
        this._isRunning = false
        this.isTracing = TraceMode.NONE
    }
    Reaction.prototype.onBecomeStale = function() {
        this.schedule()
    }
    Reaction.prototype.schedule = function() {
        if (!this._isScheduled) {
            this._isScheduled = true
            globalState.pendingReactions.push(this)
            runReactions()
        }
    }
    Reaction.prototype.isScheduled = function() {
        return this._isScheduled
    }
    /**
     * internal, use schedule() if you intend to kick off a reaction
     */
    Reaction.prototype.runReaction = function() {
        if (!this.isDisposed) {
            startBatch()
            this._isScheduled = false
            if (shouldCompute(this)) {
                this._isTrackPending = true
                try {
                    this.onInvalidate()
                    if (this._isTrackPending && isSpyEnabled()) {
                        // onInvalidate didn't trigger track right away..
                        spyReport({
                            name: this.name,
                            type: "scheduled-reaction"
                        })
                    }
                } catch (e) {
                    this.reportExceptionInDerivation(e)
                }
            }
            endBatch()
        }
    }
    Reaction.prototype.track = function(fn) {
        startBatch()
        var notify = isSpyEnabled()
        var startTime
        if (notify) {
            startTime = Date.now()
            spyReportStart({
                name: this.name,
                type: "reaction"
            })
        }
        this._isRunning = true
        var result = trackDerivedFunction(this, fn, undefined)
        this._isRunning = false
        this._isTrackPending = false
        if (this.isDisposed) {
            // disposed during last run. Clean up everything that was bound after the dispose call.
            clearObserving(this)
        }
        if (isCaughtException(result)) this.reportExceptionInDerivation(result.cause)
        if (notify) {
            spyReportEnd({
                time: Date.now() - startTime
            })
        }
        endBatch()
    }
    Reaction.prototype.reportExceptionInDerivation = function(error) {
        var _this = this
        if (this.errorHandler) {
            this.errorHandler(error, this)
            return
        }
        if (globalState.disableErrorBoundaries) throw error
        var message =
            "[mobx] Encountered an uncaught exception that was thrown by a reaction or observer component, in: '" +
            this +
            "'"
        if (globalState.suppressReactionErrors) {
            console.warn("[mobx] (error in reaction '" + this.name + "' suppressed, fix error of causing action below)"); // prettier-ignore
        } else {
            console.error(message, error)
            /** If debugging brought you here, please, read the above message :-). Tnx! */
        }
        if (isSpyEnabled()) {
            spyReport({
                type: "error",
                name: this.name,
                message: message,
                error: "" + error
            })
        }
        globalState.globalReactionErrorHandlers.forEach(function(f) {
            return f(error, _this)
        })
    }
    Reaction.prototype.dispose = function() {
        if (!this.isDisposed) {
            this.isDisposed = true
            if (!this._isRunning) {
                // if disposed while running, clean up later. Maybe not optimal, but rare case
                startBatch()
                clearObserving(this)
                endBatch()
            }
        }
    }
    Reaction.prototype.getDisposer = function() {
        var r = this.dispose.bind(this)
        r.$mobx = this
        return r
    }
    Reaction.prototype.toString = function() {
        return "Reaction[" + this.name + "]"
    }
    Reaction.prototype.trace = function(enterBreakPoint) {
        if (enterBreakPoint === void 0) {
            enterBreakPoint = false
        }
        trace(this, enterBreakPoint)
    }
    return Reaction
})()
export { Reaction }
export function onReactionError(handler) {
    globalState.globalReactionErrorHandlers.push(handler)
    return function() {
        var idx = globalState.globalReactionErrorHandlers.indexOf(handler)
        if (idx >= 0) globalState.globalReactionErrorHandlers.splice(idx, 1)
    }
}
/**
 * Magic number alert!
 * Defines within how many times a reaction is allowed to re-trigger itself
 * until it is assumed that this is gonna be a never ending loop...
 */
var MAX_REACTION_ITERATIONS = 100
var reactionScheduler = function(f) {
    return f()
}
export function runReactions() {
    // Trampolining, if runReactions are already running, new reactions will be picked up
    if (globalState.inBatch > 0 || globalState.isRunningReactions) return
    reactionScheduler(runReactionsHelper)
}
function runReactionsHelper() {
    globalState.isRunningReactions = true
    var allReactions = globalState.pendingReactions
    var iterations = 0
    // While running reactions, new reactions might be triggered.
    // Hence we work with two variables and check whether
    // we converge to no remaining reactions after a while.
    while (allReactions.length > 0) {
        if (++iterations === MAX_REACTION_ITERATIONS) {
            console.error(
                "Reaction doesn't converge to a stable state after " +
                    MAX_REACTION_ITERATIONS +
                    " iterations." +
                    (" Probably there is a cycle in the reactive function: " + allReactions[0])
            )
            allReactions.splice(0) // clear reactions
        }
        var remainingReactions = allReactions.splice(0)
        for (var i = 0, l = remainingReactions.length; i < l; i++)
            remainingReactions[i].runReaction()
    }
    globalState.isRunningReactions = false
}
export var isReaction = createInstanceofPredicate("Reaction", Reaction)
export function setReactionScheduler(fn) {
    var baseScheduler = reactionScheduler
    reactionScheduler = function(f) {
        return fn(function() {
            return baseScheduler(f)
        })
    }
}
