var _a
import { __assign, __values } from "tslib"
import {
    $mobx,
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
    isES6Set
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
        this[_a] = ObservableSetMarker
        this._data = new Set()
        this._atom = createAtom(this.name)
        this[Symbol.toStringTag] = "Set"
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
                var e_1, _b
                try {
                    for (
                        var _c = __values(_this._data.values()), _d = _c.next();
                        !_d.done;
                        _d = _c.next()
                    ) {
                        var value = _d.value
                        _this.delete(value)
                    }
                } catch (e_1_1) {
                    e_1 = { error: e_1_1 }
                } finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c)
                    } finally {
                        if (e_1) throw e_1.error
                    }
                }
            })
        })
    }
    ObservableSet.prototype.forEach = function(callbackFn, thisArg) {
        var e_2, _b
        try {
            for (var _c = __values(this), _d = _c.next(); !_d.done; _d = _c.next()) {
                var value = _d.value
                callbackFn.call(thisArg, value, value, this)
            }
        } catch (e_2_1) {
            e_2 = { error: e_2_1 }
        } finally {
            try {
                if (_d && !_d.done && (_b = _c.return)) _b.call(_c)
            } finally {
                if (e_2) throw e_2.error
            }
        }
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
        var keys = Array.from(this.keys())
        var values = Array.from(this.values())
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
        var observableValues = Array.from(this._data.values())
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
        return this.name + "[ " + Array.from(this).join(", ") + " ]"
    }
    ObservableSet.prototype[((_a = $mobx), Symbol.iterator)] = function() {
        return this.values()
    }
    return ObservableSet
})()
export { ObservableSet }
export var isObservableSet = createInstanceofPredicate("ObservableSet", ObservableSet)
