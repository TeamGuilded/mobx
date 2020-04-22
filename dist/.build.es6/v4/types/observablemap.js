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
const ObservableMapMarker = {}
export class ObservableMap {
    constructor(initialData, enhancer = deepEnhancer, name = "ObservableMap@" + getNextId()) {
        this.enhancer = enhancer
        this.name = name
        this.$mobx = ObservableMapMarker
        this._keys = new ObservableArray(undefined, referenceEnhancer, `${this.name}.keys()`, true)
        if (typeof Map !== "function") {
            throw new Error(
                "mobx.map requires Map polyfill for the current browser. Check babel-polyfill or core-js/es6/map.js"
            )
        }
        this._data = new Map()
        this._hasMap = new Map()
        this.merge(initialData)
    }
    _has(key) {
        return this._data.has(key)
    }
    has(key) {
        if (!globalState.trackingDerivation) return this._has(key)
        let entry = this._hasMap.get(key)
        if (!entry) {
            // todo: replace with atom (breaking change)
            const newEntry = (entry = new ObservableValue(
                this._has(key),
                referenceEnhancer,
                `${this.name}.${stringifyKey(key)}?`,
                false
            ))
            this._hasMap.set(key, newEntry)
            onBecomeUnobserved(newEntry, () => this._hasMap.delete(key))
        }
        return entry.get()
    }
    set(key, value) {
        const hasKey = this._has(key)
        if (hasInterceptors(this)) {
            const change = interceptChange(this, {
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
    delete(key) {
        if (hasInterceptors(this)) {
            const change = interceptChange(this, {
                type: "delete",
                object: this,
                name: key
            })
            if (!change) return false
        }
        if (this._has(key)) {
            const notifySpy = isSpyEnabled()
            const notify = hasListeners(this)
            const change =
                notify || notifySpy
                    ? {
                          type: "delete",
                          object: this,
                          oldValue: this._data.get(key).value,
                          name: key
                      }
                    : null
            if (notifySpy)
                spyReportStart(Object.assign(Object.assign({}, change), { name: this.name, key }))
            transaction(() => {
                this._keys.remove(key)
                this._updateHasMapEntry(key, false)
                const observable = this._data.get(key)
                observable.setNewValue(undefined)
                this._data.delete(key)
            })
            if (notify) notifyListeners(this, change)
            if (notifySpy) spyReportEnd()
            return true
        }
        return false
    }
    _updateHasMapEntry(key, value) {
        let entry = this._hasMap.get(key)
        if (entry) {
            entry.setNewValue(value)
        }
    }
    _updateValue(key, newValue) {
        const observable = this._data.get(key)
        newValue = observable.prepareNewValue(newValue)
        if (newValue !== globalState.UNCHANGED) {
            const notifySpy = isSpyEnabled()
            const notify = hasListeners(this)
            const change =
                notify || notifySpy
                    ? {
                          type: "update",
                          object: this,
                          oldValue: observable.value,
                          name: key,
                          newValue
                      }
                    : null
            if (notifySpy)
                spyReportStart(Object.assign(Object.assign({}, change), { name: this.name, key }))
            observable.setNewValue(newValue)
            if (notify) notifyListeners(this, change)
            if (notifySpy) spyReportEnd()
        }
    }
    _addValue(key, newValue) {
        transaction(() => {
            const observable = new ObservableValue(
                newValue,
                this.enhancer,
                `${this.name}.${stringifyKey(key)}`,
                false
            )
            this._data.set(key, observable)
            newValue = observable.value // value might have been changed
            this._updateHasMapEntry(key, true)
            this._keys.push(key)
        })
        const notifySpy = isSpyEnabled()
        const notify = hasListeners(this)
        const change =
            notify || notifySpy
                ? {
                      type: "add",
                      object: this,
                      name: key,
                      newValue
                  }
                : null
        if (notifySpy)
            spyReportStart(Object.assign(Object.assign({}, change), { name: this.name, key }))
        if (notify) notifyListeners(this, change)
        if (notifySpy) spyReportEnd()
    }
    get(key) {
        if (this.has(key)) return this.dehanceValue(this._data.get(key).get())
        return this.dehanceValue(undefined)
    }
    dehanceValue(value) {
        if (this.dehancer !== undefined) {
            return this.dehancer(value)
        }
        return value
    }
    keys() {
        return this._keys[iteratorSymbol()]()
    }
    values() {
        const self = this
        let nextIndex = 0
        return makeIterable({
            next() {
                return nextIndex < self._keys.length
                    ? { value: self.get(self._keys[nextIndex++]), done: false }
                    : { value: undefined, done: true }
            }
        })
    }
    entries() {
        const self = this
        let nextIndex = 0
        return makeIterable({
            next: function() {
                if (nextIndex < self._keys.length) {
                    const key = self._keys[nextIndex++]
                    return {
                        value: [key, self.get(key)],
                        done: false
                    }
                }
                return { done: true }
            }
        })
    }
    forEach(callback, thisArg) {
        this._keys.forEach(key => callback.call(thisArg, this.get(key), key, this))
    }
    /** Merge another object into this object, returns this. */
    merge(other) {
        if (isObservableMap(other)) {
            other = other.toJS()
        }
        transaction(() => {
            if (isPlainObject(other)) Object.keys(other).forEach(key => this.set(key, other[key]))
            else if (Array.isArray(other)) other.forEach(([key, value]) => this.set(key, value))
            else if (isES6Map(other)) {
                if (other.constructor !== Map)
                    fail("Cannot initialize from classes that inherit from Map: " + other.constructor.name); // prettier-ignore
                else
                    other.forEach((value, key) => this.set(key, value));
            } else if (other !== null && other !== undefined)
                fail("Cannot initialize map from " + other)
        })
        return this
    }
    clear() {
        transaction(() => {
            untracked(() => {
                this._keys.slice().forEach(key => this.delete(key))
            })
        })
    }
    replace(values) {
        transaction(() => {
            const replacementMap = convertToMap(values)
            const oldKeys = this._keys
            const newKeys = Array.from(replacementMap.keys())
            let keysChanged = false
            for (let i = 0; i < oldKeys.length; i++) {
                const oldKey = oldKeys[i]
                // key order change
                if (oldKeys.length === newKeys.length && oldKey !== newKeys[i]) {
                    keysChanged = true
                }
                // deleted key
                if (!replacementMap.has(oldKey)) {
                    keysChanged = true
                    this.delete(oldKey)
                }
            }
            replacementMap.forEach((value, key) => {
                // new key
                if (!this._data.has(key)) {
                    keysChanged = true
                }
                this.set(key, value)
            })
            if (keysChanged) {
                this._keys.replace(newKeys)
            }
        })
        return this
    }
    get size() {
        return this._keys.length
    }
    /**
     * Returns a plain object that represents this map.
     * Note that all the keys being stringified.
     * If there are duplicating keys after converting them to strings, behaviour is undetermined.
     */
    toPOJO() {
        const res = {}
        this._keys.forEach(
            key => (res[typeof key === "symbol" ? key : stringifyKey(key)] = this.get(key))
        )
        return res
    }
    /**
     * Returns a shallow non observable object clone of this map.
     * Note that the values migth still be observable. For a deep clone use mobx.toJS.
     */
    toJS() {
        const res = new Map()
        this._keys.forEach(key => res.set(key, this.get(key)))
        return res
    }
    toJSON() {
        // Used by JSON.stringify
        return this.toPOJO()
    }
    toString() {
        return (
            this.name +
            "[{ " +
            this._keys.map(key => `${stringifyKey(key)}: ${"" + this.get(key)}`).join(", ") +
            " }]"
        )
    }
    /**
     * Observes this object. Triggers for the events 'add', 'update' and 'delete'.
     * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
     * for callback details
     */
    observe(listener, fireImmediately) {
        process.env.NODE_ENV !== "production" &&
            invariant(
                fireImmediately !== true,
                "`observe` doesn't support fireImmediately=true in combination with maps."
            )
        return registerListener(this, listener)
    }
    intercept(handler) {
        return registerInterceptor(this, handler)
    }
}
function stringifyKey(key) {
    if (key && key.toString) return key.toString()
    else return new String(key).toString()
}
declareIterator(ObservableMap.prototype, function() {
    return this.entries()
})
addHiddenFinalProp(ObservableMap.prototype, toStringTagSymbol(), "Map")
/* 'var' fixes small-build issue */
export const isObservableMap = createInstanceofPredicate("ObservableMap", ObservableMap)
