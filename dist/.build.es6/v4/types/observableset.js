import {
    createAtom,
    deepEnhancer,
    getNextId,
    isSpyEnabled,
    hasListeners,
    invariant,
    registerListener,
    fail,
    spyReportStart,
    notifyListeners,
    spyReportEnd,
    createInstanceofPredicate,
    hasInterceptors,
    interceptChange,
    registerInterceptor,
    checkIfStateModificationsAreAllowed,
    untracked,
    makeIterable,
    transaction,
    isES6Set,
    toStringTagSymbol,
    declareIterator,
    addHiddenFinalProp,
    iteratorToArray
} from "../internal"
const ObservableSetMarker = {}
export class ObservableSet {
    constructor(initialData, enhancer = deepEnhancer, name = "ObservableSet@" + getNextId()) {
        this.name = name
        this.$mobx = ObservableSetMarker
        this._data = new Set()
        this._atom = createAtom(this.name)
        if (typeof Set !== "function") {
            throw new Error(
                "mobx.set requires Set polyfill for the current browser. Check babel-polyfill or core-js/es6/set.js"
            )
        }
        this.enhancer = (newV, oldV) => enhancer(newV, oldV, name)
        if (initialData) {
            this.replace(initialData)
        }
    }
    dehanceValue(value) {
        if (this.dehancer !== undefined) {
            return this.dehancer(value)
        }
        return value
    }
    clear() {
        transaction(() => {
            untracked(() => {
                this._data.forEach(value => {
                    this.delete(value)
                })
            })
        })
    }
    forEach(callbackFn, thisArg) {
        this._data.forEach(value => {
            callbackFn.call(thisArg, value, value, this)
        })
    }
    get size() {
        this._atom.reportObserved()
        return this._data.size
    }
    add(value) {
        checkIfStateModificationsAreAllowed(this._atom)
        if (hasInterceptors(this)) {
            const change = interceptChange(this, {
                type: "add",
                object: this,
                newValue: value
            })
            if (!change) return this
            // TODO: ideally, value = change.value would be done here, so that values can be
            // changed by interceptor. Same applies for other Set and Map api's.
        }
        if (!this.has(value)) {
            transaction(() => {
                this._data.add(this.enhancer(value, undefined))
                this._atom.reportChanged()
            })
            const notifySpy = isSpyEnabled()
            const notify = hasListeners(this)
            const change =
                notify || notifySpy
                    ? {
                          type: "add",
                          object: this,
                          newValue: value
                      }
                    : null
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportStart(change)
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        }
        return this
    }
    delete(value) {
        if (hasInterceptors(this)) {
            const change = interceptChange(this, {
                type: "delete",
                object: this,
                oldValue: value
            })
            if (!change) return false
        }
        if (this.has(value)) {
            const notifySpy = isSpyEnabled()
            const notify = hasListeners(this)
            const change =
                notify || notifySpy
                    ? {
                          type: "delete",
                          object: this,
                          oldValue: value
                      }
                    : null
            if (notifySpy && process.env.NODE_ENV !== "production")
                spyReportStart(Object.assign(Object.assign({}, change), { name: this.name }))
            transaction(() => {
                this._atom.reportChanged()
                this._data.delete(value)
            })
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
            return true
        }
        return false
    }
    has(value) {
        this._atom.reportObserved()
        return this._data.has(this.dehanceValue(value))
    }
    entries() {
        let nextIndex = 0
        const keys = iteratorToArray(this.keys())
        const values = iteratorToArray(this.values())
        return makeIterable({
            next() {
                const index = nextIndex
                nextIndex += 1
                return index < values.length
                    ? { value: [keys[index], values[index]], done: false }
                    : { done: true }
            }
        })
    }
    keys() {
        return this.values()
    }
    values() {
        this._atom.reportObserved()
        const self = this
        let nextIndex = 0
        let observableValues
        if (this._data.values !== undefined) {
            observableValues = iteratorToArray(this._data.values())
        } else {
            // There is no values function in IE11
            observableValues = []
            this._data.forEach(e => observableValues.push(e))
        }
        return makeIterable({
            next() {
                return nextIndex < observableValues.length
                    ? { value: self.dehanceValue(observableValues[nextIndex++]), done: false }
                    : { done: true }
            }
        })
    }
    replace(other) {
        if (isObservableSet(other)) {
            other = other.toJS()
        }
        transaction(() => {
            if (Array.isArray(other)) {
                this.clear()
                other.forEach(value => this.add(value))
            } else if (isES6Set(other)) {
                this.clear()
                other.forEach(value => this.add(value))
            } else if (other !== null && other !== undefined) {
                fail("Cannot initialize set from " + other)
            }
        })
        return this
    }
    observe(listener, fireImmediately) {
        // TODO 'fireImmediately' can be true?
        process.env.NODE_ENV !== "production" &&
            invariant(
                fireImmediately !== true,
                "`observe` doesn't support fireImmediately=true in combination with sets."
            )
        return registerListener(this, listener)
    }
    intercept(handler) {
        return registerInterceptor(this, handler)
    }
    toJS() {
        return new Set(this)
    }
    toString() {
        return this.name + "[ " + iteratorToArray(this.keys()).join(", ") + " ]"
    }
}
declareIterator(ObservableSet.prototype, function() {
    return this.values()
})
addHiddenFinalProp(ObservableSet.prototype, toStringTagSymbol(), "Set")
export const isObservableSet = createInstanceofPredicate("ObservableSet", ObservableSet)
