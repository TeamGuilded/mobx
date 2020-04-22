import { once, untrackedStart, untrackedEnd } from "../internal"
export function hasListeners(listenable) {
    return listenable.changeListeners !== undefined && listenable.changeListeners.length > 0
}
export function registerListener(listenable, handler) {
    var listeners = listenable.changeListeners || (listenable.changeListeners = [])
    listeners.push(handler)
    return once(function() {
        var idx = listeners.indexOf(handler)
        if (idx !== -1) listeners.splice(idx, 1)
    })
}
export function notifyListeners(listenable, change) {
    var prevU = untrackedStart()
    var listeners = listenable.changeListeners
    if (!listeners) return
    listeners = listeners.slice()
    for (var i = 0, l = listeners.length; i < l; i++) {
        listeners[i](change)
    }
    untrackedEnd(prevU)
}
