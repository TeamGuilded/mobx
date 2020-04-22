import { fail, isPlainObject } from "../internal"
export function decorate(thing, decorators) {
    if (process.env.NODE_ENV !== "production" && !isPlainObject(decorators))
        fail("Decorators should be a key value map")
    var target = typeof thing === "function" ? thing.prototype : thing
    var _loop_1 = function(prop) {
        var propertyDecorators = decorators[prop]
        if (!Array.isArray(propertyDecorators)) {
            propertyDecorators = [propertyDecorators]
        }
        // prettier-ignore
        if (process.env.NODE_ENV !== "production" && !propertyDecorators.every(function (decorator) { return typeof decorator === "function"; }))
            fail("Decorate: expected a decorator function or array of decorator functions for '" + prop + "'");
        var descriptor = Object.getOwnPropertyDescriptor(target, prop)
        var newDescriptor = propertyDecorators.reduce(function(accDescriptor, decorator) {
            return decorator(target, prop, accDescriptor)
        }, descriptor)
        if (newDescriptor) Object.defineProperty(target, prop, newDescriptor)
    }
    for (var prop in decorators) {
        _loop_1(prop)
    }
    return thing
}
