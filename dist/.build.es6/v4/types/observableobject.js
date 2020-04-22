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
export class ObservableObjectAdministration {
    constructor(target, name, defaultEnhancer) {
        this.target = target
        this.name = name
        this.defaultEnhancer = defaultEnhancer
        this.values = {}
    }
    read(owner, key) {
        if (process.env.NODE_ENV === "production" && this.target !== owner) {
            this.illegalAccess(owner, key)
            if (!this.values[key]) return undefined
        }
        return this.values[key].get()
    }
    write(owner, key, newValue) {
        const instance = this.target
        if (process.env.NODE_ENV === "production" && instance !== owner) {
            this.illegalAccess(owner, key)
        }
        const observable = this.values[key]
        if (observable instanceof ComputedValue) {
            observable.set(newValue)
            return
        }
        // intercept
        if (hasInterceptors(this)) {
            const change = interceptChange(this, {
                type: "update",
                object: instance,
                name: key,
                newValue
            })
            if (!change) return
            newValue = change.newValue
        }
        newValue = observable.prepareNewValue(newValue)
        // notify spy & observers
        if (newValue !== globalState.UNCHANGED) {
            const notify = hasListeners(this)
            const notifySpy = isSpyEnabled()
            const change =
                notify || notifySpy
                    ? {
                          type: "update",
                          object: instance,
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
    remove(key) {
        if (!this.values[key]) return
        const { target } = this
        if (hasInterceptors(this)) {
            const change = interceptChange(this, {
                object: target,
                name: key,
                type: "remove"
            })
            if (!change) return
        }
        try {
            startBatch()
            const notify = hasListeners(this)
            const notifySpy = isSpyEnabled()
            const oldValue = this.values[key].get()
            if (this.keys) this.keys.remove(key)
            delete this.values[key]
            delete this.target[key]
            const change =
                notify || notifySpy
                    ? {
                          type: "remove",
                          object: target,
                          oldValue: oldValue,
                          name: key
                      }
                    : null
            if (notifySpy)
                spyReportStart(Object.assign(Object.assign({}, change), { name: this.name, key }))
            if (notify) notifyListeners(this, change)
            if (notifySpy) spyReportEnd()
        } finally {
            endBatch()
        }
    }
    illegalAccess(owner, propName) {
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
            `Property '${propName}' of '${owner}' was accessed through the prototype chain. Use 'decorate' instead to declare the prop or access it statically through it's owner`
        )
    }
    /**
     * Observes this object. Triggers for the events 'add', 'update' and 'delete'.
     * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
     * for callback details
     */
    observe(callback, fireImmediately) {
        process.env.NODE_ENV !== "production" &&
            invariant(
                fireImmediately !== true,
                "`observe` doesn't support the fire immediately property for observable objects."
            )
        return registerListener(this, callback)
    }
    intercept(handler) {
        return registerInterceptor(this, handler)
    }
    getKeys() {
        if (this.keys === undefined) {
            this.keys = new ObservableArray(
                Object.keys(this.values).filter(key => this.values[key] instanceof ObservableValue),
                referenceEnhancer,
                `keys(${this.name})`,
                true
            )
        }
        return this.keys.slice()
    }
}
export function asObservableObject(target, name = "", defaultEnhancer = deepEnhancer) {
    let adm = target.$mobx
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
    const adm = asObservableObject(target)
    assertPropertyConfigurable(target, propName)
    if (hasInterceptors(adm)) {
        const change = interceptChange(adm, {
            object: target,
            name: propName,
            type: "add",
            newValue
        })
        if (!change) return
        newValue = change.newValue
    }
    const observable = (adm.values[propName] = new ObservableValue(
        newValue,
        enhancer,
        `${adm.name}.${propName}`,
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
    const adm = asObservableObject(target)
    options.name = `${adm.name}.${propName}`
    options.context = target
    adm.values[propName] = new ComputedValue(options)
    Object.defineProperty(target, propName, generateComputedPropConfig(propName))
}
const observablePropertyConfigs = Object.create(null)
const computedPropertyConfigs = Object.create(null)
export function generateObservablePropConfig(propName) {
    return (
        observablePropertyConfigs[propName] ||
        (observablePropertyConfigs[propName] = {
            configurable: true,
            enumerable: true,
            get() {
                return this.$mobx.read(this, propName)
            },
            set(v) {
                this.$mobx.write(this, propName, v)
            }
        })
    )
}
function getAdministrationForComputedPropOwner(owner) {
    const adm = owner.$mobx
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
            get() {
                return getAdministrationForComputedPropOwner(this).read(this, propName)
            },
            set(v) {
                getAdministrationForComputedPropOwner(this).write(this, propName, v)
            }
        })
    )
}
function notifyPropertyAddition(adm, object, key, newValue) {
    const notify = hasListeners(adm)
    const notifySpy = isSpyEnabled()
    const change =
        notify || notifySpy
            ? {
                  type: "add",
                  object,
                  name: key,
                  newValue
              }
            : null
    if (notifySpy) spyReportStart(Object.assign(Object.assign({}, change), { name: adm.name, key }))
    if (notify) notifyListeners(adm, change)
    if (notifySpy) spyReportEnd()
}
const isObservableObjectAdministration = createInstanceofPredicate(
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
