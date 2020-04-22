import {
    Atom,
    checkIfStateModificationsAreAllowed,
    comparer,
    createInstanceofPredicate,
    getNextId,
    hasInterceptors,
    hasListeners,
    interceptChange,
    isSpyEnabled,
    notifyListeners,
    registerInterceptor,
    registerListener,
    spyReport,
    spyReportEnd,
    spyReportStart,
    toPrimitive,
    globalState
} from "../internal"
export class ObservableValue extends Atom {
    constructor(
        value,
        enhancer,
        name = "ObservableValue@" + getNextId(),
        notifySpy = true,
        equals = comparer.default
    ) {
        super(name)
        this.enhancer = enhancer
        this.name = name
        this.equals = equals
        this.hasUnreportedChange = false
        this.value = enhancer(value, undefined, name)
        if (notifySpy && isSpyEnabled() && process.env.NODE_ENV !== "production") {
            // only notify spy if this is a stand-alone observable
            spyReport({ type: "create", name: this.name, newValue: "" + this.value })
        }
    }
    dehanceValue(value) {
        if (this.dehancer !== undefined) return this.dehancer(value)
        return value
    }
    set(newValue) {
        const oldValue = this.value
        newValue = this.prepareNewValue(newValue)
        if (newValue !== globalState.UNCHANGED) {
            const notifySpy = isSpyEnabled()
            if (notifySpy && process.env.NODE_ENV !== "production") {
                spyReportStart({
                    type: "update",
                    name: this.name,
                    newValue,
                    oldValue
                })
            }
            this.setNewValue(newValue)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        }
    }
    prepareNewValue(newValue) {
        checkIfStateModificationsAreAllowed(this)
        if (hasInterceptors(this)) {
            const change = interceptChange(this, {
                object: this,
                type: "update",
                newValue
            })
            if (!change) return globalState.UNCHANGED
            newValue = change.newValue
        }
        // apply modifier
        newValue = this.enhancer(newValue, this.value, this.name)
        return this.equals(this.value, newValue) ? globalState.UNCHANGED : newValue
    }
    setNewValue(newValue) {
        const oldValue = this.value
        this.value = newValue
        this.reportChanged()
        if (hasListeners(this)) {
            notifyListeners(this, {
                type: "update",
                object: this,
                newValue,
                oldValue
            })
        }
    }
    get() {
        this.reportObserved()
        return this.dehanceValue(this.value)
    }
    intercept(handler) {
        return registerInterceptor(this, handler)
    }
    observe(listener, fireImmediately) {
        if (fireImmediately)
            listener({
                object: this,
                type: "update",
                newValue: this.value,
                oldValue: undefined
            })
        return registerListener(this, listener)
    }
    toJSON() {
        return this.get()
    }
    toString() {
        return `${this.name}[${this.value}]`
    }
    valueOf() {
        return toPrimitive(this.get())
    }
    [Symbol.toPrimitive]() {
        return this.valueOf()
    }
}
export const isObservableValue = createInstanceofPredicate("ObservableValue", ObservableValue)
