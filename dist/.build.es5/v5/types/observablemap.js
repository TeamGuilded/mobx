var _a
import { __assign, __read, __values } from "tslib"
import {
    $mobx,
    ObservableValue,
    checkIfStateModificationsAreAllowed,
    createAtom,
    createInstanceofPredicate,
    deepEnhancer,
    fail,
    getMapLikeKeys,
    getNextId,
    getPlainObjectKeys,
    hasInterceptors,
    hasListeners,
    interceptChange,
    invariant,
    isES6Map,
    isPlainObject,
    isSpyEnabled,
    makeIterable,
    notifyListeners,
    referenceEnhancer,
    registerInterceptor,
    registerListener,
    spyReportEnd,
    spyReportStart,
    stringifyKey,
    transaction,
    untracked,
    onBecomeUnobserved,
    globalState
} from "../internal"
var ObservableMapMarker = {}
// just extend Map? See also https://gist.github.com/nestharus/13b4d74f2ef4a2f4357dbd3fc23c1e54
// But: https://github.com/mobxjs/mobx/issues/1556
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
        this[_a] = ObservableMapMarker
        this._keysAtom = createAtom(this.name + ".keys()")
        this[Symbol.toStringTag] = "Map"
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
            if (notifySpy && process.env.NODE_ENV !== "production")
                spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
            transaction(function() {
                _this._keysAtom.reportChanged()
                _this._updateHasMapEntry(key, false)
                var observable = _this._data.get(key)
                observable.setNewValue(undefined)
                _this._data.delete(key)
            })
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
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
            if (notifySpy && process.env.NODE_ENV !== "production")
                spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
            observable.setNewValue(newValue)
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        }
    }
    ObservableMap.prototype._addValue = function(key, newValue) {
        var _this = this
        checkIfStateModificationsAreAllowed(this._keysAtom)
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
            _this._keysAtom.reportChanged()
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
        if (notifySpy && process.env.NODE_ENV !== "production")
            spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
        if (notify) notifyListeners(this, change)
        if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
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
        this._keysAtom.reportObserved()
        return this._data.keys()
    }
    ObservableMap.prototype.values = function() {
        var self = this
        var nextIndex = 0
        var keys = Array.from(this.keys())
        return makeIterable({
            next: function() {
                return nextIndex < keys.length
                    ? { value: self.get(keys[nextIndex++]), done: false }
                    : { done: true }
            }
        })
    }
    ObservableMap.prototype.entries = function() {
        var self = this
        var nextIndex = 0
        var keys = Array.from(this.keys())
        return makeIterable({
            next: function() {
                if (nextIndex < keys.length) {
                    var key = keys[nextIndex++]
                    return {
                        value: [key, self.get(key)],
                        done: false
                    }
                }
                return { done: true }
            }
        })
    }
    ObservableMap.prototype[((_a = $mobx), Symbol.iterator)] = function() {
        return this.entries()
    }
    ObservableMap.prototype.forEach = function(callback, thisArg) {
        var e_1, _b
        try {
            for (var _c = __values(this), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = __read(_d.value, 2),
                    key = _e[0],
                    value = _e[1]
                callback.call(thisArg, value, key, this)
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
    }
    /** Merge another object into this object, returns this. */
    ObservableMap.prototype.merge = function(other) {
        var _this = this
        if (isObservableMap(other)) {
            other = other.toJS()
        }
        transaction(function() {
            if (isPlainObject(other))
                getPlainObjectKeys(other).forEach(function(key) {
                    return _this.set(key, other[key])
                })
            else if (Array.isArray(other))
                other.forEach(function(_b) {
                    var _c = __read(_b, 2),
                        key = _c[0],
                        value = _c[1]
                    return _this.set(key, value)
                })
            else if (isES6Map(other)) {
                if (other.constructor !== Map)
                    fail("Cannot initialize from classes that inherit from Map: " + other.constructor.name); // prettier-ignore
                other.forEach(function(value, key) {
                    return _this.set(key, value)
                })
            } else if (other !== null && other !== undefined)
                fail("Cannot initialize map from " + other)
        })
        return this
    }
    ObservableMap.prototype.clear = function() {
        var _this = this
        transaction(function() {
            untracked(function() {
                var e_2, _b
                try {
                    for (
                        var _c = __values(_this.keys()), _d = _c.next();
                        !_d.done;
                        _d = _c.next()
                    ) {
                        var key = _d.value
                        _this.delete(key)
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
            })
        })
    }
    ObservableMap.prototype.replace = function(values) {
        var _this = this
        transaction(function() {
            // grab all the keys that are present in the new map but not present in the current map
            // and delete them from the map, then merge the new map
            // this will cause reactions only on changed values
            var newKeys = getMapLikeKeys(values)
            var oldKeys = Array.from(_this.keys())
            var missingKeys = oldKeys.filter(function(k) {
                return newKeys.indexOf(k) === -1
            })
            missingKeys.forEach(function(k) {
                return _this.delete(k)
            })
            _this.merge(values)
        })
        return this
    }
    Object.defineProperty(ObservableMap.prototype, "size", {
        get: function() {
            this._keysAtom.reportObserved()
            return this._data.size
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
        var e_3, _b
        var res = {}
        try {
            for (var _c = __values(this), _d = _c.next(); !_d.done; _d = _c.next()) {
                var _e = __read(_d.value, 2),
                    key = _e[0],
                    value = _e[1]
                // We lie about symbol key types due to https://github.com/Microsoft/TypeScript/issues/1863
                res[typeof key === "symbol" ? key : stringifyKey(key)] = value
            }
        } catch (e_3_1) {
            e_3 = { error: e_3_1 }
        } finally {
            try {
                if (_d && !_d.done && (_b = _c.return)) _b.call(_c)
            } finally {
                if (e_3) throw e_3.error
            }
        }
        return res
    }
    /**
     * Returns a shallow non observable object clone of this map.
     * Note that the values migth still be observable. For a deep clone use mobx.toJS.
     */
    ObservableMap.prototype.toJS = function() {
        return new Map(this)
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
            Array.from(this.keys())
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
/* 'var' fixes small-build issue */
export var isObservableMap = createInstanceofPredicate("ObservableMap", ObservableMap)
