import {
    getNextId,
    invariant,
    EMPTY_OBJECT,
    deprecated,
    isAction,
    Reaction,
    action,
    comparer
} from "../internal"
/**
 * Creates a named reactive view and keeps it alive, so that the view is always
 * updated if one of the dependencies changes, even when the view is not further used by something else.
 * @param view The reactive view
 * @returns disposer function, which can be used to stop the view from being updated in the future.
 */
export function autorun(view, opts) {
    if (opts === void 0) {
        opts = EMPTY_OBJECT
    }
    if (process.env.NODE_ENV !== "production") {
        invariant(typeof view === "function", "Autorun expects a function as first argument")
        invariant(
            isAction(view) === false,
            "Autorun does not accept actions since actions are untrackable"
        )
    }
    var name = (opts && opts.name) || view.name || "Autorun@" + getNextId()
    var runSync = !opts.scheduler && !opts.delay
    var reaction
    if (runSync) {
        // normal autorun
        reaction = new Reaction(
            name,
            function() {
                this.track(reactionRunner)
            },
            opts.onError,
            opts.requiresObservable
        )
    } else {
        var scheduler_1 = createSchedulerFromOptions(opts)
        // debounced autorun
        var isScheduled_1 = false
        reaction = new Reaction(
            name,
            function() {
                if (!isScheduled_1) {
                    isScheduled_1 = true
                    scheduler_1(function() {
                        isScheduled_1 = false
                        if (!reaction.isDisposed) reaction.track(reactionRunner)
                    })
                }
            },
            opts.onError,
            opts.requiresObservable
        )
    }
    function reactionRunner() {
        view(reaction)
    }
    reaction.schedule()
    return reaction.getDisposer()
}
var run = function(f) {
    return f()
}
function createSchedulerFromOptions(opts) {
    return opts.scheduler
        ? opts.scheduler
        : opts.delay
        ? function(f) {
              return setTimeout(f, opts.delay)
          }
        : run
}
export function reaction(expression, effect, opts) {
    if (opts === void 0) {
        opts = EMPTY_OBJECT
    }
    if (typeof opts === "boolean") {
        opts = { fireImmediately: opts }
        deprecated(
            "Using fireImmediately as argument is deprecated. Use '{ fireImmediately: true }' instead"
        )
    }
    if (process.env.NODE_ENV !== "production") {
        invariant(
            typeof expression === "function",
            "First argument to reaction should be a function"
        )
        invariant(typeof opts === "object", "Third argument of reactions should be an object")
    }
    var name = opts.name || "Reaction@" + getNextId()
    var effectAction = action(name, opts.onError ? wrapErrorHandler(opts.onError, effect) : effect)
    var runSync = !opts.scheduler && !opts.delay
    var scheduler = createSchedulerFromOptions(opts)
    var firstTime = true
    var isScheduled = false
    var value
    var equals = opts.compareStructural ? comparer.structural : opts.equals || comparer.default
    var r = new Reaction(
        name,
        function() {
            if (firstTime || runSync) {
                reactionRunner()
            } else if (!isScheduled) {
                isScheduled = true
                scheduler(reactionRunner)
            }
        },
        opts.onError,
        opts.requiresObservable
    )
    function reactionRunner() {
        isScheduled = false // Q: move into reaction runner?
        if (r.isDisposed) return
        var changed = false
        r.track(function() {
            var nextValue = expression(r)
            changed = firstTime || !equals(value, nextValue)
            value = nextValue
        })
        if (firstTime && opts.fireImmediately) effectAction(value, r)
        if (!firstTime && changed === true) effectAction(value, r)
        if (firstTime) firstTime = false
    }
    r.schedule()
    return r.getDisposer()
}
function wrapErrorHandler(errorHandler, baseFn) {
    return function() {
        try {
            return baseFn.apply(this, arguments)
        } catch (e) {
            errorHandler.call(this, e)
        }
    }
}
