import { __assign } from "tslib"
import {
    comparer,
    createPropDecorator,
    defineComputedProperty,
    invariant,
    ComputedValue
} from "../internal"
export var computedDecorator = createPropDecorator(false, function(
    instance,
    propertyName,
    descriptor,
    decoratorTarget,
    decoratorArgs
) {
    var get = descriptor.get,
        set = descriptor.set // initialValue is the descriptor for get / set props
    // Optimization: faster on decorator target or instance? Assuming target
    // Optimization: find out if declaring on instance isn't just faster. (also makes the property descriptor simpler). But, more memory usage..
    // Forcing instance now, fixes hot reloadig issues on React Native:
    var options = decoratorArgs[0] || {}
    defineComputedProperty(instance, propertyName, __assign({ get: get, set: set }, options))
})
var computedStructDecorator = computedDecorator({ equals: comparer.structural })
/**
 * Decorator for class properties: @computed get value() { return expr; }.
 * For legacy purposes also invokable as ES5 observable created: `computed(() => expr)`;
 */
export var computed = function computed(arg1, arg2, arg3) {
    if (typeof arg2 === "string") {
        // @computed
        return computedDecorator.apply(null, arguments)
    }
    if (arg1 !== null && typeof arg1 === "object" && arguments.length === 1) {
        // @computed({ options })
        return computedDecorator.apply(null, arguments)
    }
    // computed(expr, options?)
    if (process.env.NODE_ENV !== "production") {
        invariant(
            typeof arg1 === "function",
            "First argument to `computed` should be an expression."
        )
        invariant(arguments.length < 3, "Computed takes one or two arguments if used as function")
    }
    var opts = typeof arg2 === "object" ? arg2 : {}
    opts.get = arg1
    opts.set = typeof arg2 === "function" ? arg2 : opts.set
    opts.name = opts.name || arg1.name || "" /* for generated name */
    return new ComputedValue(opts)
}
computed.struct = computedStructDecorator
