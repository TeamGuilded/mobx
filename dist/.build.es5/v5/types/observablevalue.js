import { __extends } from "tslib"
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
var ObservableValue = /** @class */ (function(_super) {
    __extends(ObservableValue, _super)
    function ObservableValue(value, enhancer, name, notifySpy, equals) {
        if (name === void 0) {
            name = "ObservableValue@" + getNextId()
        }
        if (notifySpy === void 0) {
            notifySpy = true
        }
        if (equals === void 0) {
            equals = comparer.default
        }
        var _this = _super.call(this, name) || this
        _this.enhancer = enhancer
        _this.name = name
        _this.equals = equals
        _this.hasUnreportedChange = false
        _this.value = enhancer(value, undefined, name)
        if (notifySpy && isSpyEnabled() && process.env.NODE_ENV !== "production") {
            // only notify spy if this is a stand-alone observable
            spyReport({ type: "create", name: _this.name, newValue: "" + _this.value })
        }
        return _this
    }
    ObservableValue.prototype.dehanceValue = function(value) {
        if (this.dehancer !== undefined) return this.dehancer(value)
        return value
    }
    ObservableValue.prototype.set = function(newValue) {
        var oldValue = this.value
        newValue = this.prepareNewValue(newValue)
        if (newValue !== globalState.UNCHANGED) {
            var notifySpy = isSpyEnabled()
            if (notifySpy && process.env.NODE_ENV !== "production") {
                spyReportStart({
                    type: "update",
                    name: this.name,
                    newValue: newValue,
                    oldValue: oldValue
                })
            }
            this.setNewValue(newValue)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        }
    }
    ObservableValue.prototype.prepareNewValue = function(newValue) {
        checkIfStateModificationsAreAllowed(this)
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                object: this,
                type: "update",
                newValue: newValue
            })
            if (!change) return globalState.UNCHANGED
            newValue = change.newValue
        }
        // apply modifier
        newValue = this.enhancer(newValue, this.value, this.name)
        return this.equals(this.value, newValue) ? globalState.UNCHANGED : newValue
    }
    ObservableValue.prototype.setNewValue = function(newValue) {
        var oldValue = this.value
        this.value = newValue
        this.reportChanged()
        if (hasListeners(this)) {
            notifyListeners(this, {
                type: "update",
                object: this,
                newValue: newValue,
                oldValue: oldValue
            })
        }
    }
    ObservableValue.prototype.get = function() {
        this.reportObserved()
        return this.dehanceValue(this.value)
    }
    ObservableValue.prototype.intercept = function(handler) {
        return registerInterceptor(this, handler)
    }
    ObservableValue.prototype.observe = function(listener, fireImmediately) {
        if (fireImmediately)
            listener({
                object: this,
                type: "update",
                newValue: this.value,
                oldValue: undefined
            })
        return registerListener(this, listener)
    }
    ObservableValue.prototype.toJSON = function() {
        return this.get()
    }
    ObservableValue.prototype.toString = function() {
        return this.name + "[" + this.value + "]"
    }
    ObservableValue.prototype.valueOf = function() {
        return toPrimitive(this.get())
    }
    ObservableValue.prototype[Symbol.toPrimitive] = function() {
        return this.valueOf()
    }
    return ObservableValue
})(Atom)
export { ObservableValue }
export var isObservableValue = createInstanceofPredicate("ObservableValue", ObservableValue)
