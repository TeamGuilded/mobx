import { __assign } from "tslib"
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
var ObservableSetMarker = {}
var ObservableSet = /** @class */ (function() {
    function ObservableSet(initialData, enhancer, name) {
        if (enhancer === void 0) {
            enhancer = deepEnhancer
        }
        if (name === void 0) {
            name = "ObservableSet@" + getNextId()
        }
        this.name = name
        this.$mobx = ObservableSetMarker
        this._data = new Set()
        this._atom = createAtom(this.name)
        if (typeof Set !== "function") {
            throw new Error(
                "mobx.set requires Set polyfill for the current browser. Check babel-polyfill or core-js/es6/set.js"
            )
        }
        this.enhancer = function(newV, oldV) {
            return enhancer(newV, oldV, name)
        }
        if (initialData) {
            this.replace(initialData)
        }
    }
    ObservableSet.prototype.dehanceValue = function(value) {
        if (this.dehancer !== undefined) {
            return this.dehancer(value)
        }
        return value
    }
    ObservableSet.prototype.clear = function() {
        var _this = this
        transaction(function() {
            untracked(function() {
                _this._data.forEach(function(value) {
                    _this.delete(value)
                })
            })
        })
    }
    ObservableSet.prototype.forEach = function(callbackFn, thisArg) {
        var _this = this
        this._data.forEach(function(value) {
            callbackFn.call(thisArg, value, value, _this)
        })
    }
    Object.defineProperty(ObservableSet.prototype, "size", {
        get: function() {
            this._atom.reportObserved()
            return this._data.size
        },
        enumerable: true,
        configurable: true
    })
    ObservableSet.prototype.add = function(value) {
        var _this = this
        checkIfStateModificationsAreAllowed(this._atom)
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                type: "add",
                object: this,
                newValue: value
            })
            if (!change) return this
            // TODO: ideally, value = change.value would be done here, so that values can be
            // changed by interceptor. Same applies for other Set and Map api's.
        }
        if (!this.has(value)) {
            transaction(function() {
                _this._data.add(_this.enhancer(value, undefined))
                _this._atom.reportChanged()
            })
            var notifySpy = isSpyEnabled()
            var notify = hasListeners(this)
            var change =
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
    ObservableSet.prototype.delete = function(value) {
        var _this = this
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                type: "delete",
                object: this,
                oldValue: value
            })
            if (!change) return false
        }
        if (this.has(value)) {
            var notifySpy = isSpyEnabled()
            var notify = hasListeners(this)
            var change =
                notify || notifySpy
                    ? {
                          type: "delete",
                          object: this,
                          oldValue: value
                      }
                    : null
            if (notifySpy && process.env.NODE_ENV !== "production")
                spyReportStart(__assign(__assign({}, change), { name: this.name }))
            transaction(function() {
                _this._atom.reportChanged()
                _this._data.delete(value)
            })
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
            return true
        }
        return false
    }
    ObservableSet.prototype.has = function(value) {
        this._atom.reportObserved()
        return this._data.has(this.dehanceValue(value))
    }
    ObservableSet.prototype.entries = function() {
        var nextIndex = 0
        var keys = iteratorToArray(this.keys())
        var values = iteratorToArray(this.values())
        return makeIterable({
            next: function() {
                var index = nextIndex
                nextIndex += 1
                return index < values.length
                    ? { value: [keys[index], values[index]], done: false }
                    : { done: true }
            }
        })
    }
    ObservableSet.prototype.keys = function() {
        return this.values()
    }
    ObservableSet.prototype.values = function() {
        this._atom.reportObserved()
        var self = this
        var nextIndex = 0
        var observableValues
        if (this._data.values !== undefined) {
            observableValues = iteratorToArray(this._data.values())
        } else {
            // There is no values function in IE11
            observableValues = []
            this._data.forEach(function(e) {
                return observableValues.push(e)
            })
        }
        return makeIterable({
            next: function() {
                return nextIndex < observableValues.length
                    ? { value: self.dehanceValue(observableValues[nextIndex++]), done: false }
                    : { done: true }
            }
        })
    }
    ObservableSet.prototype.replace = function(other) {
        var _this = this
        if (isObservableSet(other)) {
            other = other.toJS()
        }
        transaction(function() {
            if (Array.isArray(other)) {
                _this.clear()
                other.forEach(function(value) {
                    return _this.add(value)
                })
            } else if (isES6Set(other)) {
                _this.clear()
                other.forEach(function(value) {
                    return _this.add(value)
                })
            } else if (other !== null && other !== undefined) {
                fail("Cannot initialize set from " + other)
            }
        })
        return this
    }
    ObservableSet.prototype.observe = function(listener, fireImmediately) {
        // TODO 'fireImmediately' can be true?
        process.env.NODE_ENV !== "production" &&
            invariant(
                fireImmediately !== true,
                "`observe` doesn't support fireImmediately=true in combination with sets."
            )
        return registerListener(this, listener)
    }
    ObservableSet.prototype.intercept = function(handler) {
        return registerInterceptor(this, handler)
    }
    ObservableSet.prototype.toJS = function() {
        return new Set(this)
    }
    ObservableSet.prototype.toString = function() {
        return this.name + "[ " + iteratorToArray(this.keys()).join(", ") + " ]"
    }
    return ObservableSet
})()
export { ObservableSet }
declareIterator(ObservableSet.prototype, function() {
    return this.values()
})
addHiddenFinalProp(ObservableSet.prototype, toStringTagSymbol(), "Set")
export var isObservableSet = createInstanceofPredicate("ObservableSet", ObservableSet)
