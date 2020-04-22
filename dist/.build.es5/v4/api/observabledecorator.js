import { fail, invariant, createPropDecorator, defineObservableProperty } from "../internal"
export function createDecoratorForEnhancer(enhancer) {
    invariant(enhancer)
    var decorator = createPropDecorator(true, function(
        target,
        propertyName,
        descriptor,
        _decoratorTarget,
        decoratorArgs
    ) {
        if (process.env.NODE_ENV !== "production") {
            invariant(
                !descriptor || !descriptor.get,
                '@observable cannot be used on getter (property "' +
                    propertyName +
                    '"), use @computed instead.'
            )
        }
        var initialValue = descriptor
            ? descriptor.initializer
                ? descriptor.initializer.call(target)
                : descriptor.value
            : undefined
        defineObservableProperty(target, propertyName, initialValue, enhancer)
    })
    var res =
        // Extra process checks, as this happens during module initialization
        typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production"
            ? function observableDecorator() {
                  // This wrapper function is just to detect illegal decorator invocations, deprecate in a next version
                  // and simply return the created prop decorator
                  if (arguments.length < 2)
                      return fail(
                          "Incorrect decorator invocation. @observable decorator doesn't expect any arguments"
                      )
                  return decorator.apply(null, arguments)
              }
            : decorator
    res.enhancer = enhancer
    return res
}
