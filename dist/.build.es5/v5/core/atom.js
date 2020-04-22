import {
    IDerivationState,
    createInstanceofPredicate,
    endBatch,
    getNextId,
    noop,
    onBecomeObserved,
    onBecomeUnobserved,
    propagateChanged,
    reportObserved,
    startBatch
} from "../internal"
export var $mobx = Symbol("mobx administration")
var Atom = /** @class */ (function() {
    /**
     * Create a new atom. For debugging purposes it is recommended to give it a name.
     * The onBecomeObserved and onBecomeUnobserved callbacks can be used for resource management.
     */
    function Atom(name) {
        if (name === void 0) {
            name = "Atom@" + getNextId()
        }
        this.name = name
        this.isPendingUnobservation = false // for effective unobserving. BaseAtom has true, for extra optimization, so its onBecomeUnobserved never gets called, because it's not needed
        this.isBeingObserved = false
        this.observers = new Set()
        this.diffValue = 0
        this.lastAccessedBy = 0
        this.lowestObserverState = IDerivationState.NOT_TRACKING
    }
    Atom.prototype.onBecomeObserved = function() {
        if (this.onBecomeObservedListeners) {
            this.onBecomeObservedListeners.forEach(function(listener) {
                return listener()
            })
        }
    }
    Atom.prototype.onBecomeUnobserved = function() {
        if (this.onBecomeUnobservedListeners) {
            this.onBecomeUnobservedListeners.forEach(function(listener) {
                return listener()
            })
        }
    }
    /**
     * Invoke this method to notify mobx that your atom has been used somehow.
     * Returns true if there is currently a reactive context.
     */
    Atom.prototype.reportObserved = function() {
        return reportObserved(this)
    }
    /**
     * Invoke this method _after_ this method has changed to signal mobx that all its observers should invalidate.
     */
    Atom.prototype.reportChanged = function() {
        startBatch()
        propagateChanged(this)
        endBatch()
    }
    Atom.prototype.toString = function() {
        return this.name
    }
    return Atom
})()
export { Atom }
export var isAtom = createInstanceofPredicate("Atom", Atom)
export function createAtom(name, onBecomeObservedHandler, onBecomeUnobservedHandler) {
    if (onBecomeObservedHandler === void 0) {
        onBecomeObservedHandler = noop
    }
    if (onBecomeUnobservedHandler === void 0) {
        onBecomeUnobservedHandler = noop
    }
    var atom = new Atom(name)
    // default `noop` listener will not initialize the hook Set
    if (onBecomeObservedHandler !== noop) {
        onBecomeObserved(atom, onBecomeObservedHandler)
    }
    if (onBecomeUnobservedHandler !== noop) {
        onBecomeUnobserved(atom, onBecomeUnobservedHandler)
    }
    return atom
}
