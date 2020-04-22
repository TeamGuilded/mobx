import { __assign } from "tslib"
import { $mobx, autorun, createAction, fail, getNextId } from "../internal"
export function when(predicate, arg1, arg2) {
    if (arguments.length === 1 || (arg1 && typeof arg1 === "object"))
        return whenPromise(predicate, arg1)
    return _when(predicate, arg1, arg2 || {})
}
function _when(predicate, effect, opts) {
    var timeoutHandle
    if (typeof opts.timeout === "number") {
        timeoutHandle = setTimeout(function() {
            if (!disposer[$mobx].isDisposed) {
                disposer()
                var error = new Error("WHEN_TIMEOUT")
                if (opts.onError) opts.onError(error)
                else throw error
            }
        }, opts.timeout)
    }
    opts.name = opts.name || "When@" + getNextId()
    var effectAction = createAction(opts.name + "-effect", effect)
    var disposer = autorun(function(r) {
        if (predicate()) {
            r.dispose()
            if (timeoutHandle) clearTimeout(timeoutHandle)
            effectAction()
        }
    }, opts)
    return disposer
}
function whenPromise(predicate, opts) {
    if (process.env.NODE_ENV !== "production" && opts && opts.onError)
        return fail("the options 'onError' and 'promise' cannot be combined")
    var cancel
    var res = new Promise(function(resolve, reject) {
        var disposer = _when(predicate, resolve, __assign(__assign({}, opts), { onError: reject }))
        cancel = function() {
            disposer()
            reject("WHEN_CANCELLED")
        }
    })
    res.cancel = cancel
    return res
}
