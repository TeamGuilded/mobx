import { __assign } from "tslib"
import { addHiddenProp, fail, EMPTY_ARRAY } from "../internal"
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
    if (target.__mobxDidRunLazyInitializers === true) return
    var decorators = target.__mobxDecorators
    if (decorators) {
        addHiddenProp(target, "__mobxDidRunLazyInitializers", true)
        for (var key in decorators) {
            var d = decorators[key]
            d.propertyCreator(target, d.prop, d.descriptor, d.decoratorTarget, d.decoratorArguments)
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
            if (!Object.prototype.hasOwnProperty.call(target, "__mobxDecorators")) {
                var inheritedDecorators = target.__mobxDecorators
                addHiddenProp(target, "__mobxDecorators", __assign({}, inheritedDecorators))
            }
            target.__mobxDecorators[prop] = {
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
        ((args.length === 2 || args.length === 3) && typeof args[1] === "string") ||
        (args.length === 4 && args[3] === true)
    )
}
