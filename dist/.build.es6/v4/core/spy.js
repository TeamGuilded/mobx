import { once, globalState } from "../internal"
export function isSpyEnabled() {
    return !!globalState.spyListeners.length
}
export function spyReport(event) {
    if (!globalState.spyListeners.length) return
    const listeners = globalState.spyListeners
    for (let i = 0, l = listeners.length; i < l; i++) listeners[i](event)
}
export function spyReportStart(event) {
    const change = Object.assign(Object.assign({}, event), { spyReportStart: true })
    spyReport(change)
}
const END_EVENT = { spyReportEnd: true }
export function spyReportEnd(change) {
    if (change) spyReport(Object.assign(Object.assign({}, change), { spyReportEnd: true }))
    else spyReport(END_EVENT)
}
export function spy(listener) {
    globalState.spyListeners.push(listener)
    return once(() => {
        globalState.spyListeners = globalState.spyListeners.filter(l => l !== listener)
    })
}
