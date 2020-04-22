import { __assign, __read, __values } from "tslib"
import {
    $mobx,
    Atom,
    ComputedValue,
    ObservableValue,
    addHiddenProp,
    assertPropertyConfigurable,
    createInstanceofPredicate,
    deepEnhancer,
    endBatch,
    getNextId,
    hasInterceptors,
    hasListeners,
    initializeInstance,
    interceptChange,
    invariant,
    isObject,
    isPlainObject,
    isPropertyConfigurable,
    isSpyEnabled,
    notifyListeners,
    referenceEnhancer,
    registerInterceptor,
    registerListener,
    spyReportEnd,
    spyReportStart,
    startBatch,
    stringifyKey,
    globalState
} from "../internal"
var ObservableObjectAdministration = /** @class */ (function() {
    function ObservableObjectAdministration(target, values, name, defaultEnhancer) {
        if (values === void 0) {
            values = new Map()
        }
        this.target = target
        this.values = values
        this.name = name
        this.defaultEnhancer = defaultEnhancer
        this.keysAtom = new Atom(name + ".keys")
    }
    ObservableObjectAdministration.prototype.read = function(key) {
        return this.values.get(key).get()
    }
    ObservableObjectAdministration.prototype.write = function(key, newValue) {
        var instance = this.target
        var observable = this.values.get(key)
        if (observable instanceof ComputedValue) {
            observable.set(newValue)
            return
        }
        // intercept
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                type: "update",
                object: this.proxy || instance,
                name: key,
                newValue: newValue
            })
            if (!change) return
            newValue = change.newValue
        }
        newValue = observable.prepareNewValue(newValue)
        // notify spy & observers
        if (newValue !== globalState.UNCHANGED) {
            var notify = hasListeners(this)
            var notifySpy = isSpyEnabled()
            var change =
                notify || notifySpy
                    ? {
                          type: "update",
                          object: this.proxy || instance,
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
    ObservableObjectAdministration.prototype.has = function(key) {
        var map = this.pendingKeys || (this.pendingKeys = new Map())
        var entry = map.get(key)
        if (entry) return entry.get()
        else {
            var exists = !!this.values.get(key)
            // Possible optimization: Don't have a separate map for non existing keys,
            // but store them in the values map instead, using a special symbol to denote "not existing"
            entry = new ObservableValue(
                exists,
                referenceEnhancer,
                this.name + "." + stringifyKey(key) + "?",
                false
            )
            map.set(key, entry)
            return entry.get() // read to subscribe
        }
    }
    ObservableObjectAdministration.prototype.addObservableProp = function(
        propName,
        newValue,
        enhancer
    ) {
        if (enhancer === void 0) {
            enhancer = this.defaultEnhancer
        }
        var target = this.target
        assertPropertyConfigurable(target, propName)
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                object: this.proxy || target,
                name: propName,
                type: "add",
                newValue: newValue
            })
            if (!change) return
            newValue = change.newValue
        }
        var observable = new ObservableValue(
            newValue,
            enhancer,
            this.name + "." + stringifyKey(propName),
            false
        )
        this.values.set(propName, observable)
        newValue = observable.value // observableValue might have changed it
        Object.defineProperty(target, propName, generateObservablePropConfig(propName))
        this.notifyPropertyAddition(propName, newValue)
    }
    ObservableObjectAdministration.prototype.addComputedProp = function(
        propertyOwner, // where is the property declared?
        propName,
        options
    ) {
        var target = this.target
        options.name = options.name || this.name + "." + stringifyKey(propName)
        this.values.set(propName, new ComputedValue(options))
        if (propertyOwner === target || isPropertyConfigurable(propertyOwner, propName))
            Object.defineProperty(propertyOwner, propName, generateComputedPropConfig(propName))
    }
    ObservableObjectAdministration.prototype.remove = function(key) {
        if (!this.values.has(key)) return
        var target = this.target
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                object: this.proxy || target,
                name: key,
                type: "remove"
            })
            if (!change) return
        }
        try {
            startBatch()
            var notify = hasListeners(this)
            var notifySpy = isSpyEnabled()
            var oldObservable = this.values.get(key)
            var oldValue = oldObservable && oldObservable.get()
            oldObservable && oldObservable.set(undefined)
            // notify key and keyset listeners
            this.keysAtom.reportChanged()
            this.values.delete(key)
            if (this.pendingKeys) {
                var entry = this.pendingKeys.get(key)
                if (entry) entry.set(false)
            }
            // delete the prop
            delete this.target[key]
            var change =
                notify || notifySpy
                    ? {
                          type: "remove",
                          object: this.proxy || target,
                          oldValue: oldValue,
                          name: key
                      }
                    : null
            if (notifySpy && process.env.NODE_ENV !== "production")
                spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        } finally {
            endBatch()
        }
    }
    ObservableObjectAdministration.prototype.illegalAccess = function(owner, propName) {
        /**
         * This happens if a property is accessed through the prototype chain, but the property was
         * declared directly as own property on the prototype.
         *
         * E.g.:
         * class A {
         * }
         * extendObservable(A.prototype, { x: 1 })
         *
         * classB extens A {
         * }
         * console.log(new B().x)
         *
         * It is unclear whether the property should be considered 'static' or inherited.
         * Either use `console.log(A.x)`
         * or: decorate(A, { x: observable })
         *
         * When using decorate, the property will always be redeclared as own property on the actual instance
         */
        console.warn(
            "Property '" +
                propName +
                "' of '" +
                owner +
                "' was accessed through the prototype chain. Use 'decorate' instead to declare the prop or access it statically through it's owner"
        )
    }
    /**
     * Observes this object. Triggers for the events 'add', 'update' and 'delete'.
     * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
     * for callback details
     */
    ObservableObjectAdministration.prototype.observe = function(callback, fireImmediately) {
        process.env.NODE_ENV !== "production" &&
            invariant(
                fireImmediately !== true,
                "`observe` doesn't support the fire immediately property for observable objects."
            )
        return registerListener(this, callback)
    }
    ObservableObjectAdministration.prototype.intercept = function(handler) {
        return registerInterceptor(this, handler)
    }
    ObservableObjectAdministration.prototype.notifyPropertyAddition = function(key, newValue) {
        var notify = hasListeners(this)
        var notifySpy = isSpyEnabled()
        var change =
            notify || notifySpy
                ? {
                      type: "add",
                      object: this.proxy || this.target,
                      name: key,
                      newValue: newValue
                  }
                : null
        if (notifySpy && process.env.NODE_ENV !== "production")
            spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
        if (notify) notifyListeners(this, change)
        if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        if (this.pendingKeys) {
            var entry = this.pendingKeys.get(key)
            if (entry) entry.set(true)
        }
        this.keysAtom.reportChanged()
    }
    ObservableObjectAdministration.prototype.getKeys = function() {
        var e_1, _a
        this.keysAtom.reportObserved()
        // return Reflect.ownKeys(this.values) as any
        var res = []
        try {
            for (var _b = __values(this.values), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2),
                    key = _d[0],
                    value = _d[1]
                if (value instanceof ObservableValue) res.push(key)
            }
        } catch (e_1_1) {
            e_1 = { error: e_1_1 }
        } finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b)
            } finally {
                if (e_1) throw e_1.error
            }
        }
        return res
    }
    return ObservableObjectAdministration
})()
export { ObservableObjectAdministration }
export function asObservableObject(target, name, defaultEnhancer) {
    if (name === void 0) {
        name = ""
    }
    if (defaultEnhancer === void 0) {
        defaultEnhancer = deepEnhancer
    }
    if (Object.prototype.hasOwnProperty.call(target, $mobx)) return target[$mobx]
    process.env.NODE_ENV !== "production" &&
        invariant(
            Object.isExtensible(target),
            "Cannot make the designated object observable; it is not extensible"
        )
    if (!isPlainObject(target))
        name = (target.constructor.name || "ObservableObject") + "@" + getNextId()
    if (!name) name = "ObservableObject@" + getNextId()
    var adm = new ObservableObjectAdministration(
        target,
        new Map(),
        stringifyKey(name),
        defaultEnhancer
    )
    addHiddenProp(target, $mobx, adm)
    return adm
}
var observablePropertyConfigs = Object.create(null)
var computedPropertyConfigs = Object.create(null)
export function generateObservablePropConfig(propName) {
    return (
        observablePropertyConfigs[propName] ||
        (observablePropertyConfigs[propName] = {
            configurable: true,
            enumerable: true,
            get: function() {
                return this[$mobx].read(propName)
            },
            set: function(v) {
                this[$mobx].write(propName, v)
            }
        })
    )
}
function getAdministrationForComputedPropOwner(owner) {
    var adm = owner[$mobx]
    if (!adm) {
        // because computed props are declared on proty,
        // the current instance might not have been initialized yet
        initializeInstance(owner)
        return owner[$mobx]
    }
    return adm
}
export function generateComputedPropConfig(propName) {
    return (
        computedPropertyConfigs[propName] ||
        (computedPropertyConfigs[propName] = {
            configurable: globalState.computedConfigurable,
            enumerable: false,
            get: function() {
                return getAdministrationForComputedPropOwner(this).read(propName)
            },
            set: function(v) {
                getAdministrationForComputedPropOwner(this).write(propName, v)
            }
        })
    )
}
var isObservableObjectAdministration = createInstanceofPredicate(
    "ObservableObjectAdministration",
    ObservableObjectAdministration
)
export function isObservableObject(thing) {
    if (isObject(thing)) {
        // Initializers run lazily when transpiling to babel, so make sure they are run...
        initializeInstance(thing)
        return isObservableObjectAdministration(thing[$mobx])
    }
    return false
}
