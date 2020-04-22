import { __read, __spread } from "tslib"
import { invariant, once, untrackedEnd, untrackedStart } from "../internal"
export function hasInterceptors(interceptable) {
    return interceptable.interceptors !== undefined && interceptable.interceptors.length > 0
}
export function registerInterceptor(interceptable, handler) {
    var interceptors = interceptable.interceptors || (interceptable.interceptors = [])
    interceptors.push(handler)
    return once(function() {
        var idx = interceptors.indexOf(handler)
        if (idx !== -1) interceptors.splice(idx, 1)
    })
}
export function interceptChange(interceptable, change) {
    var prevU = untrackedStart()
    try {
        // Interceptor can modify the array, copy it to avoid concurrent modification, see #1950
        var interceptors = __spread(interceptable.interceptors || [])
        for (var i = 0, l = interceptors.length; i < l; i++) {
            change = interceptors[i](change)
            invariant(
                !change || change.type,
                "Intercept handlers should return nothing or a change object"
            )
            if (!change) break
        }
        return change
    } finally {
        untrackedEnd(prevU)
    }
}
