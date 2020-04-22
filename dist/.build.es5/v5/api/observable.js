import {
    ObservableMap,
    ObservableSet,
    ObservableValue,
    createDecoratorForEnhancer,
    createDynamicObservableObject,
    createObservableArray,
    deepEnhancer,
    extendObservable,
    fail,
    isES6Map,
    isES6Set,
    isObservable,
    isPlainObject,
    refStructEnhancer,
    referenceEnhancer,
    shallowEnhancer,
    getDefaultDecoratorFromObjectOptions,
    extendObservableObjectWithProperties
} from "../internal"
// Predefined bags of create observable options, to avoid allocating temporarily option objects
// in the majority of cases
export var defaultCreateObservableOptions = {
    deep: true,
    name: undefined,
    defaultDecorator: undefined,
    proxy: true
}
Object.freeze(defaultCreateObservableOptions)
function assertValidOption(key) {
    if (!/^(deep|name|equals|defaultDecorator|proxy)$/.test(key))
        fail("invalid option for (extend)observable: " + key)
}
export function asCreateObservableOptions(thing) {
    if (thing === null || thing === undefined) return defaultCreateObservableOptions
    if (typeof thing === "string") return { name: thing, deep: true, proxy: true }
    if (process.env.NODE_ENV !== "production") {
        if (typeof thing !== "object") return fail("expected options object")
        Object.keys(thing).forEach(assertValidOption)
    }
    return thing
}
export var deepDecorator = createDecoratorForEnhancer(deepEnhancer)
var shallowDecorator = createDecoratorForEnhancer(shallowEnhancer)
export var refDecorator = createDecoratorForEnhancer(referenceEnhancer)
var refStructDecorator = createDecoratorForEnhancer(refStructEnhancer)
function getEnhancerFromOptions(options) {
    return options.defaultDecorator
        ? options.defaultDecorator.enhancer
        : options.deep === false
        ? referenceEnhancer
        : deepEnhancer
}
/**
 * Turns an object, array or function into a reactive structure.
 * @param v the value which should become observable.
 */
function createObservable(v, arg2, arg3) {
    // @observable someProp;
    if (typeof arguments[1] === "string" || typeof arguments[1] === "symbol") {
        return deepDecorator.apply(null, arguments)
    }
    // it is an observable already, done
    if (isObservable(v)) return v
    // something that can be converted and mutated?
    var res = isPlainObject(v)
        ? observable.object(v, arg2, arg3)
        : Array.isArray(v)
        ? observable.array(v, arg2)
        : isES6Map(v)
        ? observable.map(v, arg2)
        : isES6Set(v)
        ? observable.set(v, arg2)
        : v
    // this value could be converted to a new observable data structure, return it
    if (res !== v) return res
    // otherwise, just box it
    fail(
        process.env.NODE_ENV !== "production" &&
            "The provided value could not be converted into an observable. If you want just create an observable reference to the object use 'observable.box(value)'"
    )
}
var observableFactories = {
    box: function(value, options) {
        if (arguments.length > 2) incorrectlyUsedAsDecorator("box")
        var o = asCreateObservableOptions(options)
        return new ObservableValue(value, getEnhancerFromOptions(o), o.name, true, o.equals)
    },
    array: function(initialValues, options) {
        if (arguments.length > 2) incorrectlyUsedAsDecorator("array")
        var o = asCreateObservableOptions(options)
        return createObservableArray(initialValues, getEnhancerFromOptions(o), o.name)
    },
    map: function(initialValues, options) {
        if (arguments.length > 2) incorrectlyUsedAsDecorator("map")
        var o = asCreateObservableOptions(options)
        return new ObservableMap(initialValues, getEnhancerFromOptions(o), o.name)
    },
    set: function(initialValues, options) {
        if (arguments.length > 2) incorrectlyUsedAsDecorator("set")
        var o = asCreateObservableOptions(options)
        return new ObservableSet(initialValues, getEnhancerFromOptions(o), o.name)
    },
    object: function(props, decorators, options) {
        if (typeof arguments[1] === "string") incorrectlyUsedAsDecorator("object")
        var o = asCreateObservableOptions(options)
        if (o.proxy === false) {
            return extendObservable({}, props, decorators, o)
        } else {
            var defaultDecorator = getDefaultDecoratorFromObjectOptions(o)
            var base = extendObservable({}, undefined, undefined, o)
            var proxy = createDynamicObservableObject(base)
            extendObservableObjectWithProperties(proxy, props, decorators, defaultDecorator)
            return proxy
        }
    },
    ref: refDecorator,
    shallow: shallowDecorator,
    deep: deepDecorator,
    struct: refStructDecorator
}
export var observable = createObservable
// weird trick to keep our typings nicely with our funcs, and still extend the observable function
Object.keys(observableFactories).forEach(function(name) {
    return (observable[name] = observableFactories[name])
})
function incorrectlyUsedAsDecorator(methodName) {
    fail(
        // process.env.NODE_ENV !== "production" &&
        "Expected one or two arguments to observable." +
            methodName +
            ". Did you accidentally try to use observable." +
            methodName +
            " as decorator?"
    )
}
