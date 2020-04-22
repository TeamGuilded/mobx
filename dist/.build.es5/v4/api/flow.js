import { action, fail, noop } from "../internal"
var generatorId = 0
export function FlowCancellationError() {
    this.message = "FLOW_CANCELLED"
}
FlowCancellationError.prototype = Object.create(Error.prototype)
export function isFlowCancellationError(error) {
    return error instanceof FlowCancellationError
}
export function flow(generator) {
    if (arguments.length !== 1)
        fail(
            !!process.env.NODE_ENV && "Flow expects one 1 argument and cannot be used as decorator"
        )
    var name = generator.name || "<unnamed flow>"
    // Implementation based on https://github.com/tj/co/blob/master/index.js
    return function() {
        var ctx = this
        var args = arguments
        var runId = ++generatorId
        var gen = action(name + " - runid: " + runId + " - init", generator).apply(ctx, args)
        var rejector
        var pendingPromise = undefined
        var res = new Promise(function(resolve, reject) {
            var stepId = 0
            rejector = reject
            function onFulfilled(res) {
                pendingPromise = undefined
                var ret
                try {
                    ret = action(
                        name + " - runid: " + runId + " - yield " + stepId++,
                        gen.next
                    ).call(gen, res)
                } catch (e) {
                    return reject(e)
                }
                next(ret)
            }
            function onRejected(err) {
                pendingPromise = undefined
                var ret
                try {
                    ret = action(
                        name + " - runid: " + runId + " - yield " + stepId++,
                        gen.throw
                    ).call(gen, err)
                } catch (e) {
                    return reject(e)
                }
                next(ret)
            }
            function next(ret) {
                if (ret && typeof ret.then === "function") {
                    // an async iterator
                    ret.then(next, reject)
                    return
                }
                if (ret.done) return resolve(ret.value)
                pendingPromise = Promise.resolve(ret.value)
                return pendingPromise.then(onFulfilled, onRejected)
            }
            onFulfilled(undefined) // kick off the process
        })
        res.cancel = action(name + " - runid: " + runId + " - cancel", function() {
            try {
                if (pendingPromise) cancelPromise(pendingPromise)
                // Finally block can return (or yield) stuff..
                var res_1 = gen.return(undefined)
                // eat anything that promise would do, it's cancelled!
                var yieldedPromise = Promise.resolve(res_1.value)
                yieldedPromise.then(noop, noop)
                cancelPromise(yieldedPromise) // maybe it can be cancelled :)
                // reject our original promise
                rejector(new FlowCancellationError())
            } catch (e) {
                rejector(e) // there could be a throwing finally block
            }
        })
        return res
    }
}
function cancelPromise(promise) {
    if (typeof promise.cancel === "function") promise.cancel()
}
