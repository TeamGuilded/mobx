import { __assign, __read, __spread, __values } from "tslib"
import { EMPTY_ARRAY, addHiddenProp, fail } from "../internal"
export var mobxDidRunLazyInitializersSymbol = Symbol("mobx did run lazy initializers")
export var mobxPendingDecorators = Symbol("mobx pending decorators")
var enumerableDescriptorCache = {}
var nonEnumerableDescriptorCache = {}
function createPropertyInitializerDescriptor(prop, enumerable) {
    var cache = enumerable ? enumerableDescriptorCache : nonEnumerableDescriptorCache
    return (
        cache[prop] ||
        (cache[prop] = {
            configurable: true,
            enumerable: enumerable,
            get: function() {
                initializeInstance(this)
                return this[prop]
            },
            set: function(value) {
                initializeInstance(this)
                this[prop] = value
            }
        })
    )
}
export function initializeInstance(target) {
    var e_1, _a
    if (target[mobxDidRunLazyInitializersSymbol] === true) return
    var decorators = target[mobxPendingDecorators]
    if (decorators) {
        addHiddenProp(target, mobxDidRunLazyInitializersSymbol, true)
        // Build property key array from both strings and symbols
        var keys = __spread(Object.getOwnPropertySymbols(decorators), Object.keys(decorators))
        try {
            for (
                var keys_1 = __values(keys), keys_1_1 = keys_1.next();
                !keys_1_1.done;
                keys_1_1 = keys_1.next()
            ) {
                var key = keys_1_1.value
                var d = decorators[key]
                d.propertyCreator(
                    target,
                    d.prop,
                    d.descriptor,
                    d.decoratorTarget,
                    d.decoratorArguments
                )
            }
        } catch (e_1_1) {
            e_1 = { error: e_1_1 }
        } finally {
            try {
                if (keys_1_1 && !keys_1_1.done && (_a = keys_1.return)) _a.call(keys_1)
            } finally {
                if (e_1) throw e_1.error
            }
        }
    }
}
export function createPropDecorator(propertyInitiallyEnumerable, propertyCreator) {
    return function decoratorFactory() {
        var decoratorArguments
        var decorator = function decorate(
            target,
            prop,
            descriptor,
            applyImmediately
            // This is a special parameter to signal the direct application of a decorator, allow extendObservable to skip the entire type decoration part,
            // as the instance to apply the decorator to equals the target
        ) {
            if (applyImmediately === true) {
                propertyCreator(target, prop, descriptor, target, decoratorArguments)
                return null
            }
            if (process.env.NODE_ENV !== "production" && !quacksLikeADecorator(arguments))
                fail("This function is a decorator, but it wasn't invoked like a decorator")
            if (!Object.prototype.hasOwnProperty.call(target, mobxPendingDecorators)) {
                var inheritedDecorators = target[mobxPendingDecorators]
                addHiddenProp(target, mobxPendingDecorators, __assign({}, inheritedDecorators))
            }
            target[mobxPendingDecorators][prop] = {
                prop: prop,
                propertyCreator: propertyCreator,
                descriptor: descriptor,
                decoratorTarget: target,
                decoratorArguments: decoratorArguments
            }
            return createPropertyInitializerDescriptor(prop, propertyInitiallyEnumerable)
        }
        if (quacksLikeADecorator(arguments)) {
            // @decorator
            decoratorArguments = EMPTY_ARRAY
            return decorator.apply(null, arguments)
        } else {
            // @decorator(args)
            decoratorArguments = Array.prototype.slice.call(arguments)
            return decorator
        }
    }
}
export function quacksLikeADecorator(args) {
    return (
        ((args.length === 2 || args.length === 3) &&
            (typeof args[1] === "string" || typeof args[1] === "symbol")) ||
        (args.length === 4 && args[3] === true)
    )
}
