import { addHiddenProp, createAction, fail, defineBoundAction, action } from "../internal"
function dontReassignFields() {
    fail(process.env.NODE_ENV !== "production" && "@action fields are not reassignable")
}
export function namedActionDecorator(name) {
    return function(target, prop, descriptor) {
        if (descriptor) {
            if (process.env.NODE_ENV !== "production" && descriptor.get !== undefined) {
                return fail("@action cannot be used with getters")
            }
            // babel / typescript
            // @action method() { }
            if (descriptor.value) {
                // typescript
                return {
                    value: createAction(name, descriptor.value),
                    enumerable: false,
                    configurable: true,
                    writable: true // for typescript, this must be writable, otherwise it cannot inherit :/ (see inheritable actions test)
                }
            }
            // babel only: @action method = () => {}
            var initializer_1 = descriptor.initializer
            return {
                enumerable: false,
                configurable: true,
                writable: true,
                initializer: function() {
                    // N.B: we can't immediately invoke initializer; this would be wrong
                    return createAction(name, initializer_1.call(this))
                }
            }
        }
        // bound instance methods
        return actionFieldDecorator(name).apply(this, arguments)
    }
}
export function actionFieldDecorator(name) {
    // Simple property that writes on first invocation to the current instance
    return function(target, prop, descriptor) {
        Object.defineProperty(target, prop, {
            configurable: true,
            enumerable: false,
            get: function() {
                return undefined
            },
            set: function(value) {
                addHiddenProp(this, prop, action(name, value))
            }
        })
    }
}
export function boundActionDecorator(target, propertyName, descriptor, applyToInstance) {
    if (applyToInstance === true) {
        defineBoundAction(target, propertyName, descriptor.value)
        return null
    }
    if (descriptor) {
        // if (descriptor.value)
        // Typescript / Babel: @action.bound method() { }
        // also: babel @action.bound method = () => {}
        return {
            configurable: true,
            enumerable: false,
            get: function() {
                defineBoundAction(
                    this,
                    propertyName,
                    descriptor.value || descriptor.initializer.call(this)
                )
                return this[propertyName]
            },
            set: dontReassignFields
        }
    }
    // field decorator Typescript @action.bound method = () => {}
    return {
        enumerable: false,
        configurable: true,
        set: function(v) {
            defineBoundAction(this, propertyName, v)
        },
        get: function() {
            return undefined
        }
    }
}
