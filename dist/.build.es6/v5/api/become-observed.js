import { fail, getAtom } from "../internal"
export function onBecomeObserved(thing, arg2, arg3) {
    return interceptHook("onBecomeObserved", thing, arg2, arg3)
}
export function onBecomeUnobserved(thing, arg2, arg3) {
    return interceptHook("onBecomeUnobserved", thing, arg2, arg3)
}
function interceptHook(hook, thing, arg2, arg3) {
    const atom = typeof arg3 === "function" ? getAtom(thing, arg2) : getAtom(thing)
    const cb = typeof arg3 === "function" ? arg3 : arg2
    const listenersKey = `${hook}Listeners`
    if (atom[listenersKey]) {
        atom[listenersKey].add(cb)
    } else {
        atom[listenersKey] = new Set([cb])
    }
    const orig = atom[hook]
    if (typeof orig !== "function")
        return fail(process.env.NODE_ENV !== "production" && "Not an atom that can be (un)observed")
    return function() {
        const hookListeners = atom[listenersKey]
        if (hookListeners) {
            hookListeners.delete(cb)
            if (hookListeners.size === 0) {
                delete atom[listenersKey]
            }
        }
    }
}
