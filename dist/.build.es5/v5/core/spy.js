import { __assign } from "tslib"
import { globalState, once } from "../internal"
export function isSpyEnabled() {
    return process.env.NODE_ENV !== "production" && !!globalState.spyListeners.length
}
export function spyReport(event) {
    if (process.env.NODE_ENV === "production") return // dead code elimination can do the rest
    if (!globalState.spyListeners.length) return
    var listeners = globalState.spyListeners
    for (var i = 0, l = listeners.length; i < l; i++) listeners[i](event)
}
export function spyReportStart(event) {
    if (process.env.NODE_ENV === "production") return
    var change = __assign(__assign({}, event), { spyReportStart: true })
    spyReport(change)
}
var END_EVENT = { spyReportEnd: true }
export function spyReportEnd(change) {
    if (process.env.NODE_ENV === "production") return
    if (change) spyReport(__assign(__assign({}, change), { spyReportEnd: true }))
    else spyReport(END_EVENT)
}
export function spy(listener) {
    if (process.env.NODE_ENV === "production") {
        console.warn("[mobx.spy] Is a no-op in production builds")
        return function() {}
    } else {
        globalState.spyListeners.push(listener)
        return once(function() {
            globalState.spyListeners = globalState.spyListeners.filter(function(l) {
                return l !== listener
            })
        })
    }
}
