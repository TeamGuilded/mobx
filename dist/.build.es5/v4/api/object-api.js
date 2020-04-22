import {
    isObservableMap,
    fail,
    isObservableObject,
    isObservableSet,
    isObservableArray,
    startBatch,
    endBatch,
    defineObservableProperty,
    invariant,
    iteratorToArray,
    getAdministration
} from "../internal"
export function keys(obj) {
    if (isObservableObject(obj)) {
        return obj.$mobx.getKeys()
    }
    if (isObservableMap(obj)) {
        return obj._keys.slice()
    }
    if (isObservableSet(obj)) {
        return iteratorToArray(obj.keys())
    }
    if (isObservableArray(obj)) {
        return obj.map(function(_, index) {
            return index
        })
    }
    return fail(
        process.env.NODE_ENV !== "production" &&
            "'keys()' can only be used on observable objects, arrays, sets and maps"
    )
}
export function values(obj) {
    if (isObservableObject(obj)) {
        return keys(obj).map(function(key) {
            return obj[key]
        })
    }
    if (isObservableMap(obj)) {
        return keys(obj).map(function(key) {
            return obj.get(key)
        })
    }
    if (isObservableSet(obj)) {
        return iteratorToArray(obj.values())
    }
    if (isObservableArray(obj)) {
        return obj.slice()
    }
    return fail(
        process.env.NODE_ENV !== "production" &&
            "'values()' can only be used on observable objects, arrays, sets and maps"
    )
}
export function entries(obj) {
    if (isObservableObject(obj)) {
        return keys(obj).map(function(key) {
            return [key, obj[key]]
        })
    }
    if (isObservableMap(obj)) {
        return keys(obj).map(function(key) {
            return [key, obj.get(key)]
        })
    }
    if (isObservableSet(obj)) {
        return iteratorToArray(obj.entries())
    }
    if (isObservableArray(obj)) {
        return obj.map(function(key, index) {
            return [index, key]
        })
    }
    return fail(
        process.env.NODE_ENV !== "production" &&
            "'entries()' can only be used on observable objects, arrays and maps"
    )
}
export function set(obj, key, value) {
    if (arguments.length === 2 && !isObservableSet(obj)) {
        startBatch()
        var values_1 = key
        try {
            for (var key_1 in values_1) set(obj, key_1, values_1[key_1])
        } finally {
            endBatch()
        }
        return
    }
    if (isObservableObject(obj)) {
        var adm = obj.$mobx
        var existingObservable = adm.values[key]
        if (existingObservable) {
            adm.write(obj, key, value)
        } else {
            defineObservableProperty(obj, key, value, adm.defaultEnhancer)
        }
    } else if (isObservableMap(obj)) {
        obj.set(key, value)
    } else if (isObservableSet(obj)) {
        obj.add(key)
    } else if (isObservableArray(obj)) {
        if (typeof key !== "number") key = parseInt(key, 10)
        invariant(key >= 0, "Not a valid index: '" + key + "'")
        startBatch()
        if (key >= obj.length) obj.length = key + 1
        obj[key] = value
        endBatch()
    } else {
        return fail(
            process.env.NODE_ENV !== "production" &&
                "'set()' can only be used on observable objects, arrays and maps"
        )
    }
}
export function remove(obj, key) {
    if (isObservableObject(obj)) {
        obj.$mobx.remove(key)
    } else if (isObservableMap(obj)) {
        obj.delete(key)
    } else if (isObservableSet(obj)) {
        obj.delete(key)
    } else if (isObservableArray(obj)) {
        if (typeof key !== "number") key = parseInt(key, 10)
        invariant(key >= 0, "Not a valid index: '" + key + "'")
        obj.splice(key, 1)
    } else {
        return fail(
            process.env.NODE_ENV !== "production" &&
                "'remove()' can only be used on observable objects, arrays and maps"
        )
    }
}
export function has(obj, key) {
    if (isObservableObject(obj)) {
        // return keys(obj).indexOf(key) >= 0
        var adm = getAdministration(obj)
        adm.getKeys() // make sure we get notified of key changes, but for performance, use the values map to look up existence
        return !!adm.values[key]
    } else if (isObservableMap(obj)) {
        return obj.has(key)
    } else if (isObservableSet(obj)) {
        return obj.has(key)
    } else if (isObservableArray(obj)) {
        return key >= 0 && key < obj.length
    } else {
        return fail(
            process.env.NODE_ENV !== "production" &&
                "'has()' can only be used on observable objects, arrays and maps"
        )
    }
}
export function get(obj, key) {
    if (!has(obj, key)) return undefined
    if (isObservableObject(obj)) {
        return obj[key]
    } else if (isObservableMap(obj)) {
        return obj.get(key)
    } else if (isObservableArray(obj)) {
        return obj[key]
    } else {
        return fail(
            process.env.NODE_ENV !== "production" &&
                "'get()' can only be used on observable objects, arrays and maps"
        )
    }
}
