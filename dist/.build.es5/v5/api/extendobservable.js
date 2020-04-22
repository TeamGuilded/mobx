import { __values } from "tslib"
import {
    asCreateObservableOptions,
    asObservableObject,
    computedDecorator,
    deepDecorator,
    endBatch,
    fail,
    getPlainObjectKeys,
    invariant,
    isComputed,
    isObservable,
    isObservableMap,
    refDecorator,
    startBatch,
    stringifyKey,
    initializeInstance
} from "../internal"
import { isPlainObject } from "../utils/utils"
export function extendObservable(target, properties, decorators, options) {
    if (process.env.NODE_ENV !== "production") {
        invariant(
            arguments.length >= 2 && arguments.length <= 4,
            "'extendObservable' expected 2-4 arguments"
        )
        invariant(
            typeof target === "object",
            "'extendObservable' expects an object as first argument"
        )
        invariant(
            !isObservableMap(target),
            "'extendObservable' should not be used on maps, use map.merge instead"
        )
    }
    options = asCreateObservableOptions(options)
    var defaultDecorator = getDefaultDecoratorFromObjectOptions(options)
    initializeInstance(target) // Fixes #1740
    asObservableObject(target, options.name, defaultDecorator.enhancer) // make sure object is observable, even without initial props
    if (properties)
        extendObservableObjectWithProperties(target, properties, decorators, defaultDecorator)
    return target
}
export function getDefaultDecoratorFromObjectOptions(options) {
    return options.defaultDecorator || (options.deep === false ? refDecorator : deepDecorator)
}
export function extendObservableObjectWithProperties(
    target,
    properties,
    decorators,
    defaultDecorator
) {
    var e_1, _a, e_2, _b
    if (process.env.NODE_ENV !== "production") {
        invariant(
            !isObservable(properties),
            "Extending an object with another observable (object) is not supported. Please construct an explicit propertymap, using `toJS` if need. See issue #540"
        )
        if (decorators) {
            var keys = getPlainObjectKeys(decorators)
            try {
                for (
                    var keys_1 = __values(keys), keys_1_1 = keys_1.next();
                    !keys_1_1.done;
                    keys_1_1 = keys_1.next()
                ) {
                    var key = keys_1_1.value
                    if (!(key in properties))
                        fail(
                            "Trying to declare a decorator for unspecified property '" +
                                stringifyKey(key) +
                                "'"
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
    startBatch()
    try {
        var keys = getPlainObjectKeys(properties)
        try {
            for (
                var keys_2 = __values(keys), keys_2_1 = keys_2.next();
                !keys_2_1.done;
                keys_2_1 = keys_2.next()
            ) {
                var key = keys_2_1.value
                var descriptor = Object.getOwnPropertyDescriptor(properties, key)
                if (process.env.NODE_ENV !== "production") {
                    if (!isPlainObject(properties))
                        fail("'extendObservabe' only accepts plain objects as second argument")
                    if (isComputed(descriptor.value))
                        fail(
                            "Passing a 'computed' as initial property value is no longer supported by extendObservable. Use a getter or decorator instead"
                        )
                }
                var decorator =
                    decorators && key in decorators
                        ? decorators[key]
                        : descriptor.get
                        ? computedDecorator
                        : defaultDecorator
                if (process.env.NODE_ENV !== "production" && typeof decorator !== "function")
                    fail("Not a valid decorator for '" + stringifyKey(key) + "', got: " + decorator)
                var resultDescriptor = decorator(target, key, descriptor, true)
                if (
                    resultDescriptor // otherwise, assume already applied, due to `applyToInstance`
                )
                    Object.defineProperty(target, key, resultDescriptor)
            }
        } catch (e_2_1) {
            e_2 = { error: e_2_1 }
        } finally {
            try {
                if (keys_2_1 && !keys_2_1.done && (_b = keys_2.return)) _b.call(keys_2)
            } finally {
                if (e_2) throw e_2.error
            }
        }
    } finally {
        endBatch()
    }
}
