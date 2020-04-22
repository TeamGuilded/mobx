import { __assign } from "tslib"
import {
    ObservableValue,
    ComputedValue,
    hasInterceptors,
    interceptChange,
    globalState,
    hasListeners,
    isSpyEnabled,
    spyReportStart,
    notifyListeners,
    spyReportEnd,
    startBatch,
    endBatch,
    invariant,
    registerListener,
    registerInterceptor,
    ObservableArray,
    referenceEnhancer,
    deepEnhancer,
    isPlainObject,
    getNextId,
    addHiddenFinalProp,
    assertPropertyConfigurable,
    initializeInstance,
    createInstanceofPredicate,
    isObject
} from "../internal"
var ObservableObjectAdministration = /** @class */ (function() {
    function ObservableObjectAdministration(target, name, defaultEnhancer) {
        this.target = target
        this.name = name
        this.defaultEnhancer = defaultEnhancer
        this.values = {}
    }
    ObservableObjectAdministration.prototype.read = function(owner, key) {
        if (process.env.NODE_ENV === "production" && this.target !== owner) {
            this.illegalAccess(owner, key)
            if (!this.values[key]) return undefined
        }
        return this.values[key].get()
    }
    ObservableObjectAdministration.prototype.write = function(owner, key, newValue) {
        var instance = this.target
        if (process.env.NODE_ENV === "production" && instance !== owner) {
            this.illegalAccess(owner, key)
        }
        var observable = this.values[key]
        if (observable instanceof ComputedValue) {
            observable.set(newValue)
            return
        }
        // intercept
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                type: "update",
                object: instance,
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
                          object: instance,
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
    ObservableObjectAdministration.prototype.remove = function(key) {
        if (!this.values[key]) return
        var target = this.target
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                object: target,
                name: key,
                type: "remove"
            })
            if (!change) return
        }
        try {
            startBatch()
            var notify = hasListeners(this)
            var notifySpy = isSpyEnabled()
            var oldValue = this.values[key].get()
            if (this.keys) this.keys.remove(key)
            delete this.values[key]
            delete this.target[key]
            var change =
                notify || notifySpy
                    ? {
                          type: "remove",
                          object: target,
                          oldValue: oldValue,
                          name: key
                      }
                    : null
            if (notifySpy)
                spyReportStart(__assign(__assign({}, change), { name: this.name, key: key }))
            if (notify) notifyListeners(this, change)
            if (notifySpy) spyReportEnd()
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
    ObservableObjectAdministration.prototype.getKeys = function() {
        var _this = this
        if (this.keys === undefined) {
            this.keys = new ObservableArray(
                Object.keys(this.values).filter(function(key) {
                    return _this.values[key] instanceof ObservableValue
                }),
                referenceEnhancer,
                "keys(" + this.name + ")",
                true
            )
        }
        return this.keys.slice()
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
    var adm = target.$mobx
    if (adm) return adm
    process.env.NODE_ENV !== "production" &&
        invariant(
            Object.isExtensible(target),
            "Cannot make the designated object observable; it is not extensible"
        )
    if (!isPlainObject(target))
        name = (target.constructor.name || "ObservableObject") + "@" + getNextId()
    if (!name) name = "ObservableObject@" + getNextId()
    adm = new ObservableObjectAdministration(target, name, defaultEnhancer)
    addHiddenFinalProp(target, "$mobx", adm)
    return adm
}
export function defineObservableProperty(target, propName, newValue, enhancer) {
    var adm = asObservableObject(target)
    assertPropertyConfigurable(target, propName)
    if (hasInterceptors(adm)) {
        var change = interceptChange(adm, {
            object: target,
            name: propName,
            type: "add",
            newValue: newValue
        })
        if (!change) return
        newValue = change.newValue
    }
    var observable = (adm.values[propName] = new ObservableValue(
        newValue,
        enhancer,
        adm.name + "." + propName,
        false
    ))
    newValue = observable.value // observableValue might have changed it
    Object.defineProperty(target, propName, generateObservablePropConfig(propName))
    if (adm.keys) adm.keys.push(propName)
    notifyPropertyAddition(adm, target, propName, newValue)
}
export function defineComputedProperty(
    target, // which objects holds the observable and provides `this` context?
    propName,
    options
) {
    var adm = asObservableObject(target)
    options.name = adm.name + "." + propName
    options.context = target
    adm.values[propName] = new ComputedValue(options)
    Object.defineProperty(target, propName, generateComputedPropConfig(propName))
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
                return this.$mobx.read(this, propName)
            },
            set: function(v) {
                this.$mobx.write(this, propName, v)
            }
        })
    )
}
function getAdministrationForComputedPropOwner(owner) {
    var adm = owner.$mobx
    if (!adm) {
        // because computed props are declared on proty,
        // the current instance might not have been initialized yet
        initializeInstance(owner)
        return owner.$mobx
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
                return getAdministrationForComputedPropOwner(this).read(this, propName)
            },
            set: function(v) {
                getAdministrationForComputedPropOwner(this).write(this, propName, v)
            }
        })
    )
}
function notifyPropertyAddition(adm, object, key, newValue) {
    var notify = hasListeners(adm)
    var notifySpy = isSpyEnabled()
    var change =
        notify || notifySpy
            ? {
                  type: "add",
                  object: object,
                  name: key,
                  newValue: newValue
              }
            : null
    if (notifySpy) spyReportStart(__assign(__assign({}, change), { name: adm.name, key: key }))
    if (notify) notifyListeners(adm, change)
    if (notifySpy) spyReportEnd()
}
var isObservableObjectAdministration = createInstanceofPredicate(
    "ObservableObjectAdministration",
    ObservableObjectAdministration
)
export function isObservableObject(thing) {
    if (isObject(thing)) {
        // Initializers run lazily when transpiling to babel, so make sure they are run...
        initializeInstance(thing)
        return isObservableObjectAdministration(thing.$mobx)
    }
    return false
}
