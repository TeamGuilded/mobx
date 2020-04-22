import { __assign, __extends, __read, __spread } from "tslib"
import {
    Atom,
    getNextId,
    registerInterceptor,
    registerListener,
    checkIfStateModificationsAreAllowed,
    EMPTY_ARRAY,
    hasInterceptors,
    interceptChange,
    isSpyEnabled,
    hasListeners,
    spyReportStart,
    notifyListeners,
    spyReportEnd,
    addHiddenFinalProp,
    allowStateChangesStart,
    allowStateChangesEnd,
    deprecated,
    declareIterator,
    makeIterable,
    addHiddenProp,
    invariant,
    makeNonEnumerable,
    createInstanceofPredicate,
    isObject,
    toStringTagSymbol
} from "../internal"
var MAX_SPLICE_SIZE = 10000 // See e.g. https://github.com/mobxjs/mobx/issues/859
// Detects bug in safari 9.1.1 (or iOS 9 safari mobile). See #364
var safariPrototypeSetterInheritanceBug = (function() {
    var v = false
    var p = {}
    Object.defineProperty(p, "0", {
        set: function() {
            v = true
        }
    })
    Object.create(p)["0"] = 1
    return v === false
})()
/**
 * This array buffer contains two lists of properties, so that all arrays
 * can recycle their property definitions, which significantly improves performance of creating
 * properties on the fly.
 */
var OBSERVABLE_ARRAY_BUFFER_SIZE = 0
// Typescript workaround to make sure ObservableArray extends Array
var StubArray = /** @class */ (function() {
    function StubArray() {}
    return StubArray
})()
export { StubArray }
function inherit(ctor, proto) {
    if (typeof Object["setPrototypeOf"] !== "undefined") {
        Object["setPrototypeOf"](ctor.prototype, proto)
    } else if (typeof ctor.prototype.__proto__ !== "undefined") {
        ctor.prototype.__proto__ = proto
    } else {
        ctor["prototype"] = proto
    }
}
inherit(StubArray, Array.prototype)
// Weex freeze Array.prototype
// Make them writeable and configurable in prototype chain
// https://github.com/alibaba/weex/pull/1529
if (Object.isFrozen(Array)) {
    ;[
        "constructor",
        "push",
        "shift",
        "concat",
        "pop",
        "unshift",
        "replace",
        "find",
        "findIndex",
        "splice",
        "reverse",
        "sort"
    ].forEach(function(key) {
        Object.defineProperty(StubArray.prototype, key, {
            configurable: true,
            writable: true,
            value: Array.prototype[key]
        })
    })
}
var ObservableArrayAdministration = /** @class */ (function() {
    function ObservableArrayAdministration(name, enhancer, array, owned) {
        this.array = array
        this.owned = owned
        this.values = []
        this.lastKnownLength = 0
        this.atom = new Atom(name || "ObservableArray@" + getNextId())
        this.enhancer = function(newV, oldV) {
            return enhancer(newV, oldV, name + "[..]")
        }
    }
    ObservableArrayAdministration.prototype.dehanceValue = function(value) {
        if (this.dehancer !== undefined) return this.dehancer(value)
        return value
    }
    ObservableArrayAdministration.prototype.dehanceValues = function(values) {
        if (this.dehancer !== undefined && values.length > 0) return values.map(this.dehancer)
        return values
    }
    ObservableArrayAdministration.prototype.intercept = function(handler) {
        return registerInterceptor(this, handler)
    }
    ObservableArrayAdministration.prototype.observe = function(listener, fireImmediately) {
        if (fireImmediately === void 0) {
            fireImmediately = false
        }
        if (fireImmediately) {
            listener({
                object: this.array,
                type: "splice",
                index: 0,
                added: this.values.slice(),
                addedCount: this.values.length,
                removed: [],
                removedCount: 0
            })
        }
        return registerListener(this, listener)
    }
    ObservableArrayAdministration.prototype.getArrayLength = function() {
        this.atom.reportObserved()
        return this.values.length
    }
    ObservableArrayAdministration.prototype.setArrayLength = function(newLength) {
        if (typeof newLength !== "number" || newLength < 0)
            throw new Error("[mobx.array] Out of range: " + newLength)
        var currentLength = this.values.length
        if (newLength === currentLength) return
        else if (newLength > currentLength) {
            var newItems = new Array(newLength - currentLength)
            for (var i = 0; i < newLength - currentLength; i++) newItems[i] = undefined // No Array.fill everywhere...
            this.spliceWithArray(currentLength, 0, newItems)
        } else this.spliceWithArray(newLength, currentLength - newLength)
    }
    // adds / removes the necessary numeric properties to this object
    ObservableArrayAdministration.prototype.updateArrayLength = function(oldLength, delta) {
        if (oldLength !== this.lastKnownLength)
            throw new Error(
                "[mobx] Modification exception: the internal structure of an observable array was changed. Did you use peek() to change it?"
            )
        this.lastKnownLength += delta
        if (delta > 0 && oldLength + delta + 1 > OBSERVABLE_ARRAY_BUFFER_SIZE)
            reserveArrayBuffer(oldLength + delta + 1)
    }
    ObservableArrayAdministration.prototype.spliceWithArray = function(
        index,
        deleteCount,
        newItems
    ) {
        var _this = this
        checkIfStateModificationsAreAllowed(this.atom)
        var length = this.values.length
        if (index === undefined) index = 0
        else if (index > length) index = length
        else if (index < 0) index = Math.max(0, length + index)
        if (arguments.length === 1) deleteCount = length - index
        else if (deleteCount === undefined || deleteCount === null) deleteCount = 0
        else deleteCount = Math.max(0, Math.min(deleteCount, length - index))
        if (newItems === undefined) newItems = EMPTY_ARRAY
        if (hasInterceptors(this)) {
            var change = interceptChange(this, {
                object: this.array,
                type: "splice",
                index: index,
                removedCount: deleteCount,
                added: newItems
            })
            if (!change) return EMPTY_ARRAY
            deleteCount = change.removedCount
            newItems = change.added
        }
        newItems =
            newItems.length === 0
                ? newItems
                : newItems.map(function(v) {
                      return _this.enhancer(v, undefined)
                  })
        var lengthDelta = newItems.length - deleteCount
        this.updateArrayLength(length, lengthDelta) // create or remove new entries
        var res = this.spliceItemsIntoValues(index, deleteCount, newItems)
        if (deleteCount !== 0 || newItems.length !== 0) this.notifyArraySplice(index, newItems, res)
        return this.dehanceValues(res)
    }
    ObservableArrayAdministration.prototype.spliceItemsIntoValues = function(
        index,
        deleteCount,
        newItems
    ) {
        var _a
        if (newItems.length < MAX_SPLICE_SIZE) {
            return (_a = this.values).splice.apply(_a, __spread([index, deleteCount], newItems))
        } else {
            var res = this.values.slice(index, index + deleteCount)
            this.values = this.values
                .slice(0, index)
                .concat(newItems, this.values.slice(index + deleteCount))
            return res
        }
    }
    ObservableArrayAdministration.prototype.notifyArrayChildUpdate = function(
        index,
        newValue,
        oldValue
    ) {
        var notifySpy = !this.owned && isSpyEnabled()
        var notify = hasListeners(this)
        var change =
            notify || notifySpy
                ? {
                      object: this.array,
                      type: "update",
                      index: index,
                      newValue: newValue,
                      oldValue: oldValue
                  }
                : null
        if (notifySpy) spyReportStart(__assign(__assign({}, change), { name: this.atom.name }))
        this.atom.reportChanged()
        if (notify) notifyListeners(this, change)
        if (notifySpy) spyReportEnd()
    }
    ObservableArrayAdministration.prototype.notifyArraySplice = function(index, added, removed) {
        var notifySpy = !this.owned && isSpyEnabled()
        var notify = hasListeners(this)
        var change =
            notify || notifySpy
                ? {
                      object: this.array,
                      type: "splice",
                      index: index,
                      removed: removed,
                      added: added,
                      removedCount: removed.length,
                      addedCount: added.length
                  }
                : null
        if (notifySpy) spyReportStart(__assign(__assign({}, change), { name: this.atom.name }))
        this.atom.reportChanged()
        // conform: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/observe
        if (notify) notifyListeners(this, change)
        if (notifySpy) spyReportEnd()
    }
    return ObservableArrayAdministration
})()
var ObservableArray = /** @class */ (function(_super) {
    __extends(ObservableArray, _super)
    function ObservableArray(initialValues, enhancer, name, owned) {
        if (name === void 0) {
            name = "ObservableArray@" + getNextId()
        }
        if (owned === void 0) {
            owned = false
        }
        var _this = _super.call(this) || this
        var adm = new ObservableArrayAdministration(name, enhancer, _this, owned)
        addHiddenFinalProp(_this, "$mobx", adm)
        if (initialValues && initialValues.length) {
            var prev = allowStateChangesStart(true)
            _this.spliceWithArray(0, 0, initialValues)
            allowStateChangesEnd(prev)
        }
        if (safariPrototypeSetterInheritanceBug) {
            // Seems that Safari won't use numeric prototype setter untill any * numeric property is
            // defined on the instance. After that it works fine, even if this property is deleted.
            Object.defineProperty(adm.array, "0", ENTRY_0)
        }
        return _this
    }
    ObservableArray.prototype.intercept = function(handler) {
        return this.$mobx.intercept(handler)
    }
    ObservableArray.prototype.observe = function(listener, fireImmediately) {
        if (fireImmediately === void 0) {
            fireImmediately = false
        }
        return this.$mobx.observe(listener, fireImmediately)
    }
    ObservableArray.prototype.clear = function() {
        return this.splice(0)
    }
    ObservableArray.prototype.concat = function() {
        var arrays = []
        for (var _i = 0; _i < arguments.length; _i++) {
            arrays[_i] = arguments[_i]
        }
        this.$mobx.atom.reportObserved()
        return Array.prototype.concat.apply(
            this.peek(),
            arrays.map(function(a) {
                return isObservableArray(a) ? a.peek() : a
            })
        )
    }
    ObservableArray.prototype.replace = function(newItems) {
        return this.$mobx.spliceWithArray(0, this.$mobx.values.length, newItems)
    }
    /**
     * Converts this array back to a (shallow) javascript structure.
     * For a deep clone use mobx.toJS
     */
    ObservableArray.prototype.toJS = function() {
        return this.slice()
    }
    ObservableArray.prototype.toJSON = function() {
        // Used by JSON.stringify
        return this.toJS()
    }
    ObservableArray.prototype.peek = function() {
        this.$mobx.atom.reportObserved()
        return this.$mobx.dehanceValues(this.$mobx.values)
    }
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find
    ObservableArray.prototype.find = function(predicate, thisArg, fromIndex) {
        if (fromIndex === void 0) {
            fromIndex = 0
        }
        if (arguments.length === 3)
            deprecated(
                "The array.find fromIndex argument to find will not be supported anymore in the next major"
            )
        var idx = this.findIndex.apply(this, arguments)
        return idx === -1 ? undefined : this.get(idx)
    }
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex
    ObservableArray.prototype.findIndex = function(predicate, thisArg, fromIndex) {
        if (fromIndex === void 0) {
            fromIndex = 0
        }
        if (arguments.length === 3)
            deprecated(
                "The array.findIndex fromIndex argument to find will not be supported anymore in the next major"
            )
        var items = this.peek(),
            l = items.length
        for (var i = fromIndex; i < l; i++) if (predicate.call(thisArg, items[i], i, this)) return i
        return -1
    }
    /*
     * functions that do alter the internal structure of the array, (based on lib.es6.d.ts)
     * since these functions alter the inner structure of the array, the have side effects.
     * Because the have side effects, they should not be used in computed function,
     * and for that reason the do not call dependencyState.notifyObserved
     */
    ObservableArray.prototype.splice = function(index, deleteCount) {
        var newItems = []
        for (var _i = 2; _i < arguments.length; _i++) {
            newItems[_i - 2] = arguments[_i]
        }
        switch (arguments.length) {
            case 0:
                return []
            case 1:
                return this.$mobx.spliceWithArray(index)
            case 2:
                return this.$mobx.spliceWithArray(index, deleteCount)
        }
        return this.$mobx.spliceWithArray(index, deleteCount, newItems)
    }
    ObservableArray.prototype.spliceWithArray = function(index, deleteCount, newItems) {
        return this.$mobx.spliceWithArray(index, deleteCount, newItems)
    }
    ObservableArray.prototype.push = function() {
        var items = []
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i] = arguments[_i]
        }
        var adm = this.$mobx
        adm.spliceWithArray(adm.values.length, 0, items)
        return adm.values.length
    }
    ObservableArray.prototype.pop = function() {
        return this.splice(Math.max(this.$mobx.values.length - 1, 0), 1)[0]
    }
    ObservableArray.prototype.shift = function() {
        return this.splice(0, 1)[0]
    }
    ObservableArray.prototype.unshift = function() {
        var items = []
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i] = arguments[_i]
        }
        var adm = this.$mobx
        adm.spliceWithArray(0, 0, items)
        return adm.values.length
    }
    ObservableArray.prototype.reverse = function() {
        // reverse by default mutates in place before returning the result
        // which makes it both a 'derivation' and a 'mutation'.
        // so we deviate from the default and just make it an dervitation
        var clone = this.slice()
        return clone.reverse.apply(clone, arguments)
    }
    ObservableArray.prototype.sort = function(compareFn) {
        // sort by default mutates in place before returning the result
        // which goes against all good practices. Let's not change the array in place!
        var clone = this.slice()
        return clone.sort.apply(clone, arguments)
    }
    ObservableArray.prototype.remove = function(value) {
        var idx = this.$mobx.dehanceValues(this.$mobx.values).indexOf(value)
        if (idx > -1) {
            this.splice(idx, 1)
            return true
        }
        return false
    }
    ObservableArray.prototype.move = function(fromIndex, toIndex) {
        deprecated("observableArray.move is deprecated, use .slice() & .replace() instead")
        function checkIndex(index) {
            if (index < 0) {
                throw new Error("[mobx.array] Index out of bounds: " + index + " is negative")
            }
            var length = this.$mobx.values.length
            if (index >= length) {
                throw new Error(
                    "[mobx.array] Index out of bounds: " + index + " is not smaller than " + length
                )
            }
        }
        checkIndex.call(this, fromIndex)
        checkIndex.call(this, toIndex)
        if (fromIndex === toIndex) {
            return
        }
        var oldItems = this.$mobx.values
        var newItems
        if (fromIndex < toIndex) {
            newItems = __spread(
                oldItems.slice(0, fromIndex),
                oldItems.slice(fromIndex + 1, toIndex + 1),
                [oldItems[fromIndex]],
                oldItems.slice(toIndex + 1)
            )
        } else {
            // toIndex < fromIndex
            newItems = __spread(
                oldItems.slice(0, toIndex),
                [oldItems[fromIndex]],
                oldItems.slice(toIndex, fromIndex),
                oldItems.slice(fromIndex + 1)
            )
        }
        this.replace(newItems)
    }
    // See #734, in case property accessors are unreliable...
    ObservableArray.prototype.get = function(index) {
        var impl = this.$mobx
        if (impl) {
            if (index < impl.values.length) {
                impl.atom.reportObserved()
                return impl.dehanceValue(impl.values[index])
            }
            console.warn(
                "[mobx.array] Attempt to read an array index (" +
                    index +
                    ") that is out of bounds (" +
                    impl.values.length +
                    "). Please check length first. Out of bound indices will not be tracked by MobX"
            )
        }
        return undefined
    }
    // See #734, in case property accessors are unreliable...
    ObservableArray.prototype.set = function(index, newValue) {
        var adm = this.$mobx
        var values = adm.values
        if (index < values.length) {
            // update at index in range
            checkIfStateModificationsAreAllowed(adm.atom)
            var oldValue = values[index]
            if (hasInterceptors(adm)) {
                var change = interceptChange(adm, {
                    type: "update",
                    object: this,
                    index: index,
                    newValue: newValue
                })
                if (!change) return
                newValue = change.newValue
            }
            newValue = adm.enhancer(newValue, oldValue)
            var changed = newValue !== oldValue
            if (changed) {
                values[index] = newValue
                adm.notifyArrayChildUpdate(index, newValue, oldValue)
            }
        } else if (index === values.length) {
            // add a new item
            adm.spliceWithArray(index, 0, [newValue])
        } else {
            // out of bounds
            throw new Error(
                "[mobx.array] Index out of bounds, " + index + " is larger than " + values.length
            )
        }
    }
    return ObservableArray
})(StubArray)
export { ObservableArray }
declareIterator(ObservableArray.prototype, function() {
    this.$mobx.atom.reportObserved()
    var self = this
    var nextIndex = 0
    return makeIterable({
        next: function() {
            return nextIndex < self.length
                ? { value: self[nextIndex++], done: false }
                : { done: true, value: undefined }
        }
    })
})
Object.defineProperty(ObservableArray.prototype, "length", {
    enumerable: false,
    configurable: true,
    get: function() {
        return this.$mobx.getArrayLength()
    },
    set: function(newLength) {
        this.$mobx.setArrayLength(newLength)
    }
})
addHiddenProp(ObservableArray.prototype, toStringTagSymbol(), "Array")
;[
    "every",
    "filter",
    "forEach",
    "indexOf",
    "join",
    "lastIndexOf",
    "map",
    "reduce",
    "reduceRight",
    "slice",
    "some",
    "toString",
    "toLocaleString"
].forEach(function(funcName) {
    var baseFunc = Array.prototype[funcName]
    invariant(
        typeof baseFunc === "function",
        "Base function not defined on Array prototype: '" + funcName + "'"
    )
    addHiddenProp(ObservableArray.prototype, funcName, function() {
        return baseFunc.apply(this.peek(), arguments)
    })
})
/**
 * We don't want those to show up in `for (const key in ar)` ...
 */
makeNonEnumerable(ObservableArray.prototype, [
    "constructor",
    "intercept",
    "observe",
    "clear",
    "concat",
    "get",
    "replace",
    "toJS",
    "toJSON",
    "peek",
    "find",
    "findIndex",
    "splice",
    "spliceWithArray",
    "push",
    "pop",
    "set",
    "shift",
    "unshift",
    "reverse",
    "sort",
    "remove",
    "move",
    "toString",
    "toLocaleString"
])
// See #364
var ENTRY_0 = createArrayEntryDescriptor(0)
function createArrayEntryDescriptor(index) {
    return {
        enumerable: false,
        configurable: false,
        get: function() {
            return this.get(index)
        },
        set: function(value) {
            this.set(index, value)
        }
    }
}
function createArrayBufferItem(index) {
    Object.defineProperty(ObservableArray.prototype, "" + index, createArrayEntryDescriptor(index))
}
export function reserveArrayBuffer(max) {
    for (var index = OBSERVABLE_ARRAY_BUFFER_SIZE; index < max; index++)
        createArrayBufferItem(index)
    OBSERVABLE_ARRAY_BUFFER_SIZE = max
}
reserveArrayBuffer(1000)
var isObservableArrayAdministration = createInstanceofPredicate(
    "ObservableArrayAdministration",
    ObservableArrayAdministration
)
export function isObservableArray(thing) {
    return isObject(thing) && isObservableArrayAdministration(thing.$mobx)
}
