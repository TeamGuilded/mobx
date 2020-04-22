import {
    propagateChanged,
    reportObserved,
    startBatch,
    endBatch,
    IDerivationState,
    getNextId,
    createInstanceofPredicate,
    noop,
    onBecomeObserved,
    onBecomeUnobserved
} from "../internal"
/**
 * Anything that can be used to _store_ state is an Atom in mobx. Atoms have two important jobs
 *
 * 1) detect when they are being _used_ and report this (using reportObserved). This allows mobx to make the connection between running functions and the data they used
 * 2) they should notify mobx whenever they have _changed_. This way mobx can re-run any functions (derivations) that are using this atom.
 */
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
        this.observers = []
        this.observersIndexes = {}
        this.diffValue = 0
        this.lastAccessedBy = 0
        this.lowestObserverState = IDerivationState.NOT_TRACKING
    }
    Atom.prototype.onBecomeUnobserved = function() {
        // noop
    }
    Atom.prototype.onBecomeObserved = function() {
        /* noop */
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
    onBecomeObserved(atom, onBecomeObservedHandler)
    onBecomeUnobserved(atom, onBecomeUnobservedHandler)
    return atom
}
