import { getAtom, fail } from "../internal"
export function onBecomeObserved(thing, arg2, arg3) {
    return interceptHook("onBecomeObserved", thing, arg2, arg3)
}
export function onBecomeUnobserved(thing, arg2, arg3) {
    return interceptHook("onBecomeUnobserved", thing, arg2, arg3)
}
function interceptHook(hook, thing, arg2, arg3) {
    var atom = typeof arg3 === "function" ? getAtom(thing, arg2) : getAtom(thing)
    var cb = typeof arg3 === "function" ? arg3 : arg2
    var orig = atom[hook]
    if (typeof orig !== "function")
        return fail(process.env.NODE_ENV !== "production" && "Not an atom that can be (un)observed")
    atom[hook] = function() {
        orig.call(this)
        cb.call(this)
    }
    return function() {
        atom[hook] = orig
    }
}
