import { __assign, __read } from "tslib"
import {
    createInstanceofPredicate,
    isPlainObject,
    getNextId,
    invariant,
    isES6Map,
    fail,
    addHiddenFinalProp,
    ObservableValue,
    ObservableArray,
    referenceEnhancer,
    deepEnhancer,
    hasInterceptors,
    interceptChange,
    isSpyEnabled,
    hasListeners,
    spyReportStart,
    transaction,
    notifyListeners,
    spyReportEnd,
    globalState,
    iteratorSymbol,
    toStringTagSymbol,
    makeIterable,
    untracked,
    registerListener,
    registerInterceptor,
    declareIterator,
    onBecomeUnobserved,
    convertToMap
} from "../internal"
var ObservableMapMarker = {}
var ObservableMap = /** @class */ (function() {
    function ObservableMap(initialData, enhancer, name) {
        if (enhancer === void 0) {
            enhancer = deepEnhancer
        }
        if (name === void 0) {
            name = "ObservableMap@" + getNextId()
        }
        this.enhancer = enhancer
        this.name = name
        this.$mobx = ObservableMapMarker
        this._keys = new ObservableArray(undefined, referenceEnhancer, this.name + ".keys()", true)
        if (typeof Map !== "function") {
            throw new Error(
                "mobx.map requires Map polyfill for the current browser. Check babel-polyfill or core-js/es6/map.js"
            )
        }
        this._data = new Map()
        this._hasMap = new Map()
        this.merge(initialData)
    }
    ObservableMap.prototype._has = function(key) {
        return this._data.has(key)
    }
    ObservableMap.prototype.has = function(key) {
        var _this = this
        if (!globalState.trackingDerivation) return this._has(key)
        var entry = this._hasMap.get(key)
        if (!entry) {
            // todo: replace with atom (breaking change)
            var newEntry = (entry = new ObservableValue(
                this._has(key),
                referenceEnhancer,
                this.name + "." + stringifyKey(key) + "?",
                false
            ))
            this._hasMap.set(key, newEntry)
            onBecomeUnobserved(newEntry, function() {
                return _this._hasMap.delete(key)
            })
        }
        return entry.get()
    }
    ObservableMap.prototype.set = function(key, value) {
        var hasKey = this._has(key)
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                type: hasKey ? "update" : "add",
                object: this,
                newValue: value,
                name: key
            })
            if (!change) return this
            value = change.newValue
        }
        if (hasKey) {
            this._updateValue(key, value)
        } else {
            this._addValue(key, value)
        }
        return this
    }
    ObservableMap.prototype.delete = function(key) {
        var _this = this
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                type: "delete",
                object: this,
                name: key
            })
            if (!change) return false
        }
        if (this._has(key)) {
            var notifySpy = isSpyEnabled()
            var notify = hasListeners(this)
            var change =
                notify || notifySpy
                    ? {
                          type: "delete",
                          object: this,
                          oldValue: this._data.get(key).value,
                          name: key
                      }
                    : null
            if (notifySpy)
                spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
            transaction(function() {
                _this._keys.remove(key)
                _this._updateHasMapEntry(key, false)
                var observable = _this._data.get(key)
                observable.setNewValue(undefined)
                _this._data.delete(key)
            })
            if (notify) notifyListeners(this, change)
            if (notifySpy) spyReportEnd()
            return true
        }
        return false
    }
    ObservableMap.prototype._updateHasMapEntry = function(key, value) {
        var entry = this._hasMap.get(key)
        if (entry) {
            entry.setNewValue(value)
        }
    }
    ObservableMap.prototype._updateValue = function(key, newValue) {
        var observable = this._data.get(key)
        newValue = observable.prepareNewValue(newValue)
        if (newValue !== globalState.UNCHANGED) {
            var notifySpy = isSpyEnabled()
            var notify = hasListeners(this)
            var change =
                notify || notifySpy
                    ? {
                          type: "update",
                          object: this,
                          oldValue: observable.value,
                          name: key,
                          newValue: newValue
                      }
                    : null
            if (notifySpy)
                spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
            observable.setNewValue(newValue)
            if (notify) notifyListeners(this, change)
            if (notifySpy) spyReportEnd()
        }
    }
    ObservableMap.prototype._addValue = function(key, newValue) {
        var _this = this
        transaction(function() {
            var observable = new ObservableValue(
                newValue,
                _this.enhancer,
                _this.name + "." + stringifyKey(key),
                false
            )
            _this._data.set(key, observable)
            newValue = observable.value // value might have been changed
            _this._updateHasMapEntry(key, true)
            _this._keys.push(key)
        })
        var notifySpy = isSpyEnabled()
        var notify = hasListeners(this)
        var change =
            notify || notifySpy
                ? {
                      type: "add",
                      object: this,
                      name: key,
                      newValue: newValue
                  }
                : null
        if (notifySpy) spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
        if (notify) notifyListeners(this, change)
        if (notifySpy) spyReportEnd()
    }
    ObservableMap.prototype.get = function(key) {
        if (this.has(key)) return this.dehanceValue(this._data.get(key).get())
        return this.dehanceValue(undefined)
    }
    ObservableMap.prototype.dehanceValue = function(value) {
        if (this.dehancer !== undefined) {
            return this.dehancer(value)
        }
        return value
    }
    ObservableMap.prototype.keys = function() {
        return this._keys[iteratorSymbol()]()
    }
    ObservableMap.prototype.values = function() {
        var self = this
        var nextIndex = 0
        return makeIterable({
            next: function() {
                return nextIndex < self._keys.length
                    ? { value: self.get(self._keys[nextIndex++]), done: false }
                    : { value: undefined, done: true }
            }
        })
    }
    ObservableMap.prototype.entries = function() {
        var self = this
        var nextIndex = 0
        return makeIterable({
            next: function() {
                if (nextIndex < self._keys.length) {
                    var key = self._keys[nextIndex++]
                    return {
                        value: [key, self.get(key)],
                        done: false
                    }
                }
                return { done: true }
            }
        })
    }
    ObservableMap.prototype.forEach = function(callback, thisArg) {
        var _this = this
        this._keys.forEach(function(key) {
            return callback.call(thisArg, _this.get(key), key, _this)
        })
    }
    /** Merge another object into this object, returns this. */
    ObservableMap.prototype.merge = function(other) {
        var _this = this
        if (isObservableMap(other)) {
            other = other.toJS()
        }
        transaction(function() {
            if (isPlainObject(other))
                Object.keys(other).forEach(function(key) {
                    return _this.set(key, other[key])
                })
            else if (Array.isArray(other))
                other.forEach(function(_a) {
                    var _b = __read(_a, 2),
                        key = _b[0],
                        value = _b[1]
                    return _this.set(key, value)
                })
            else if (isES6Map(other)) {
                if (other.constructor !== Map)
                    fail("Cannot initialize from classes that inherit from Map: " + other.constructor.name); // prettier-ignore
                else
                    other.forEach(function (value, key) { return _this.set(key, value); });
            } else if (other !== null && other !== undefined)
                fail("Cannot initialize map from " + other)
        })
        return this
    }
    ObservableMap.prototype.clear = function() {
        var _this = this
        transaction(function() {
            untracked(function() {
                _this._keys.slice().forEach(function(key) {
                    return _this.delete(key)
                })
            })
        })
    }
    ObservableMap.prototype.replace = function(values) {
        var _this = this
        transaction(function() {
            var replacementMap = convertToMap(values)
            var oldKeys = _this._keys
            var newKeys = Array.from(replacementMap.keys())
            var keysChanged = false
            for (var i = 0; i < oldKeys.length; i++) {
                var oldKey = oldKeys[i]
                // key order change
                if (oldKeys.length === newKeys.length && oldKey !== newKeys[i]) {
                    keysChanged = true
                }
                // deleted key
                if (!replacementMap.has(oldKey)) {
                    keysChanged = true
                    _this.delete(oldKey)
                }
            }
            replacementMap.forEach(function(value, key) {
                // new key
                if (!_this._data.has(key)) {
                    keysChanged = true
                }
                _this.set(key, value)
            })
            if (keysChanged) {
                _this._keys.replace(newKeys)
            }
        })
        return this
    }
    Object.defineProperty(ObservableMap.prototype, "size", {
        get: function() {
            return this._keys.length
        },
        enumerable: true,
        configurable: true
    })
    /**
     * Returns a plain object that represents this map.
     * Note that all the keys being stringified.
     * If there are duplicating keys after converting them to strings, behaviour is undetermined.
     */
    ObservableMap.prototype.toPOJO = function() {
        var _this = this
        var res = {}
        this._keys.forEach(function(key) {
            return (res[typeof key === "symbol" ? key : stringifyKey(key)] = _this.get(key))
        })
        return res
    }
    /**
     * Returns a shallow non observable object clone of this map.
     * Note that the values migth still be observable. For a deep clone use mobx.toJS.
     */
    ObservableMap.prototype.toJS = function() {
        var _this = this
        var res = new Map()
        this._keys.forEach(function(key) {
            return res.set(key, _this.get(key))
        })
        return res
    }
    ObservableMap.prototype.toJSON = function() {
        // Used by JSON.stringify
        return this.toPOJO()
    }
    ObservableMap.prototype.toString = function() {
        var _this = this
        return (
            this.name +
            "[{ " +
            this._keys
                .map(function(key) {
                    return stringifyKey(key) + ": " + ("" + _this.get(key))
                })
                .join(", ") +
            " }]"
        )
    }
    /**
     * Observes this object. Triggers for the events 'add', 'update' and 'delete'.
     * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
     * for callback details
     */
    ObservableMap.prototype.observe = function(listener, fireImmediately) {
        process.env.NODE_ENV !== "production" &&
            invariant(
                fireImmediately !== true,
                "`observe` doesn't support fireImmediately=true in combination with maps."
            )
        return registerListener(this, listener)
    }
    ObservableMap.prototype.intercept = function(handler) {
        return registerInterceptor(this, handler)
    }
    return ObservableMap
})()
export { ObservableMap }
function stringifyKey(key) {
    if (key && key.toString) return key.toString()
    else return new String(key).toString()
}
declareIterator(ObservableMap.prototype, function() {
    return this.entries()
})
addHiddenFinalProp(ObservableMap.prototype, toStringTagSymbol(), "Map")
/* 'var' fixes small-build issue */
export var isObservableMap = createInstanceofPredicate("ObservableMap", ObservableMap)
