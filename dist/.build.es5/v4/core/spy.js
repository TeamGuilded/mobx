import { __assign } from "tslib"
import { once, globalState } from "../internal"
export function isSpyEnabled() {
    return !!globalState.spyListeners.length
}
export function spyReport(event) {
    if (!globalState.spyListeners.length) return
    var listeners = globalState.spyListeners
    for (var i = 0, l = listeners.length; i < l; i++) listeners[i](event)
}
export function spyReportStart(event) {
    var change = __assign(__assign({}, event), { spyReportStart: true })
    spyReport(change)
}
var END_EVENT = { spyReportEnd: true }
export function spyReportEnd(change) {
    if (change) spyReport(__assign(__assign({}, change), { spyReportEnd: true }))
    else spyReport(END_EVENT)
}
export function spy(listener) {
    globalState.spyListeners.push(listener)
    return once(function() {
        globalState.spyListeners = globalState.spyListeners.filter(function(l) {
            return l !== listener
        })
    })
}
