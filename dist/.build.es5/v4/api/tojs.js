import {
    isObservableArray,
    isObservable,
    isObservableValue,
    keys,
    isObservableSet,
    isObservableMap
} from "../internal"
var defaultOptions = {
    detectCycles: true,
    exportMapsAsObjects: true,
    recurseEverything: false
}
function cache(map, key, value, options) {
    if (options.detectCycles) map.set(key, value)
    return value
}
function toJSHelper(source, options, __alreadySeen) {
    if (!options.recurseEverything && !isObservable(source)) return source
    if (typeof source !== "object") return source
    // Directly return null if source is null
    if (source === null) return null
    // Directly return the Date object itself if contained in the observable
    if (source instanceof Date) return source
    if (isObservableValue(source)) return toJSHelper(source.get(), options, __alreadySeen)
    // make sure we track the keys of the object
    if (isObservable(source)) keys(source)
    var detectCycles = options.detectCycles === true
    if (detectCycles && source !== null && __alreadySeen.has(source)) {
        return __alreadySeen.get(source)
    }
    if (isObservableArray(source) || Array.isArray(source)) {
        var res_1 = cache(__alreadySeen, source, [], options)
        var toAdd = source.map(function(value) {
            return toJSHelper(value, options, __alreadySeen)
        })
        res_1.length = toAdd.length
        for (var i = 0, l = toAdd.length; i < l; i++) res_1[i] = toAdd[i]
        return res_1
    }
    if (isObservableSet(source) || Object.getPrototypeOf(source) === Set.prototype) {
        if (options.exportMapsAsObjects === false) {
            var res_2 = cache(__alreadySeen, source, new Set(), options)
            source.forEach(function(value) {
                res_2.add(toJSHelper(value, options, __alreadySeen))
            })
            return res_2
        } else {
            var res_3 = cache(__alreadySeen, source, [], options)
            source.forEach(function(value) {
                res_3.push(toJSHelper(value, options, __alreadySeen))
            })
            return res_3
        }
    }
    if (isObservableMap(source) || Object.getPrototypeOf(source) === Map.prototype) {
        if (options.exportMapsAsObjects === false) {
            var res_4 = cache(__alreadySeen, source, new Map(), options)
            source.forEach(function(value, key) {
                res_4.set(key, toJSHelper(value, options, __alreadySeen))
            })
            return res_4
        } else {
            var res_5 = cache(__alreadySeen, source, {}, options)
            source.forEach(function(value, key) {
                res_5[key] = toJSHelper(value, options, __alreadySeen)
            })
            return res_5
        }
    }
    // Fallback to the situation that source is an ObservableObject or a plain object
    var res = cache(__alreadySeen, source, {}, options)
    for (var key in source) {
        res[key] = toJSHelper(source[key], options, __alreadySeen)
    }
    return res
}
export function toJS(source, options) {
    // backward compatibility
    if (typeof options === "boolean") options = { detectCycles: options }
    if (!options) options = defaultOptions
    options.detectCycles =
        options.detectCycles === undefined
            ? options.recurseEverything === true
            : options.detectCycles === true
    var __alreadySeen
    if (options.detectCycles) __alreadySeen = new Map()
    return toJSHelper(source, options, __alreadySeen)
}
