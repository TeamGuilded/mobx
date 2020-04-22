import { __assign, __read, __spread } from "tslib"
import {
    $mobx,
    Atom,
    EMPTY_ARRAY,
    addHiddenFinalProp,
    checkIfStateModificationsAreAllowed,
    createInstanceofPredicate,
    fail,
    getNextId,
    hasInterceptors,
    hasListeners,
    interceptChange,
    isObject,
    isSpyEnabled,
    notifyListeners,
    registerInterceptor,
    registerListener,
    spyReportEnd,
    spyReportStart,
    allowStateChangesStart,
    allowStateChangesEnd
} from "../internal"
var MAX_SPLICE_SIZE = 10000 // See e.g. https://github.com/mobxjs/mobx/issues/859
var arrayTraps = {
    get: function(target, name) {
        if (name === $mobx) return target[$mobx]
        if (name === "length") return target[$mobx].getArrayLength()
        if (typeof name === "number") {
            return arrayExtensions.get.call(target, name)
        }
        if (typeof name === "string" && !isNaN(name)) {
            return arrayExtensions.get.call(target, parseInt(name))
        }
        if (arrayExtensions.hasOwnProperty(name)) {
            return arrayExtensions[name]
        }
        return target[name]
    },
    set: function(target, name, value) {
        if (name === "length") {
            target[$mobx].setArrayLength(value)
        }
        if (typeof name === "number") {
            arrayExtensions.set.call(target, name, value)
        }
        if (typeof name === "symbol" || isNaN(name)) {
            target[name] = value
        } else {
            // numeric string
            arrayExtensions.set.call(target, parseInt(name), value)
        }
        return true
    },
    preventExtensions: function(target) {
        fail("Observable arrays cannot be frozen")
        return false
    }
}
export function createObservableArray(initialValues, enhancer, name, owned) {
    if (name === void 0) {
        name = "ObservableArray@" + getNextId()
    }
    if (owned === void 0) {
        owned = false
    }
    var adm = new ObservableArrayAdministration(name, enhancer, owned)
    addHiddenFinalProp(adm.values, $mobx, adm)
    var proxy = new Proxy(adm.values, arrayTraps)
    adm.proxy = proxy
    if (initialValues && initialValues.length) {
        var prev = allowStateChangesStart(true)
        adm.spliceWithArray(0, 0, initialValues)
        allowStateChangesEnd(prev)
    }
    return proxy
}
var ObservableArrayAdministration = /** @class */ (function() {
    function ObservableArrayAdministration(name, enhancer, owned) {
        this.owned = owned
        this.values = []
        this.proxy = undefined
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
                object: this.proxy,
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
    ObservableArrayAdministration.prototype.updateArrayLength = function(oldLength, delta) {
        if (oldLength !== this.lastKnownLength)
            throw new Error(
                "[mobx] Modification exception: the internal structure of an observable array was changed."
            )
        this.lastKnownLength += delta
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
                object: this.proxy,
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
        if (process.env.NODE_ENV !== "production") {
            var lengthDelta = newItems.length - deleteCount
            this.updateArrayLength(length, lengthDelta) // checks if internal array wasn't modified
        }
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
                      object: this.proxy,
                      type: "update",
                      index: index,
                      newValue: newValue,
                      oldValue: oldValue
                  }
                : null
        // The reason why this is on right hand side here (and not above), is this way the uglifier will drop it, but it won't
        // cause any runtime overhead in development mode without NODE_ENV set, unless spying is enabled
        if (notifySpy && process.env.NODE_ENV !== "production")
            spyReportStart(__assign(__assign({}, change), { name: this.atom.name }))
        this.atom.reportChanged()
        if (notify) notifyListeners(this, change)
        if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
    }
    ObservableArrayAdministration.prototype.notifyArraySplice = function(index, added, removed) {
        var notifySpy = !this.owned && isSpyEnabled()
        var notify = hasListeners(this)
        var change =
            notify || notifySpy
                ? {
                      object: this.proxy,
                      type: "splice",
                      index: index,
                      removed: removed,
                      added: added,
                      removedCount: removed.length,
                      addedCount: added.length
                  }
                : null
        if (notifySpy && process.env.NODE_ENV !== "production")
            spyReportStart(__assign(__assign({}, change), { name: this.atom.name }))
        this.atom.reportChanged()
        // conform: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/observe
        if (notify) notifyListeners(this, change)
        if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
    }
    return ObservableArrayAdministration
})()
var arrayExtensions = {
    intercept: function(handler) {
        return this[$mobx].intercept(handler)
    },
    observe: function(listener, fireImmediately) {
        if (fireImmediately === void 0) {
            fireImmediately = false
        }
        var adm = this[$mobx]
        return adm.observe(listener, fireImmediately)
    },
    clear: function() {
        return this.splice(0)
    },
    replace: function(newItems) {
        var adm = this[$mobx]
        return adm.spliceWithArray(0, adm.values.length, newItems)
    },
    /**
     * Converts this array back to a (shallow) javascript structure.
     * For a deep clone use mobx.toJS
     */
    toJS: function() {
        return this.slice()
    },
    toJSON: function() {
        // Used by JSON.stringify
        return this.toJS()
    },
    /*
     * functions that do alter the internal structure of the array, (based on lib.es6.d.ts)
     * since these functions alter the inner structure of the array, the have side effects.
     * Because the have side effects, they should not be used in computed function,
     * and for that reason the do not call dependencyState.notifyObserved
     */
    splice: function(index, deleteCount) {
        var newItems = []
        for (var _i = 2; _i < arguments.length; _i++) {
            newItems[_i - 2] = arguments[_i]
        }
        var adm = this[$mobx]
        switch (arguments.length) {
            case 0:
                return []
            case 1:
                return adm.spliceWithArray(index)
            case 2:
                return adm.spliceWithArray(index, deleteCount)
        }
        return adm.spliceWithArray(index, deleteCount, newItems)
    },
    spliceWithArray: function(index, deleteCount, newItems) {
        var adm = this[$mobx]
        return adm.spliceWithArray(index, deleteCount, newItems)
    },
    push: function() {
        var items = []
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i] = arguments[_i]
        }
        var adm = this[$mobx]
        adm.spliceWithArray(adm.values.length, 0, items)
        return adm.values.length
    },
    pop: function() {
        return this.splice(Math.max(this[$mobx].values.length - 1, 0), 1)[0]
    },
    shift: function() {
        return this.splice(0, 1)[0]
    },
    unshift: function() {
        var items = []
        for (var _i = 0; _i < arguments.length; _i++) {
            items[_i] = arguments[_i]
        }
        var adm = this[$mobx]
        adm.spliceWithArray(0, 0, items)
        return adm.values.length
    },
    reverse: function() {
        // reverse by default mutates in place before returning the result
        // which makes it both a 'derivation' and a 'mutation'.
        // so we deviate from the default and just make it an dervitation
        if (process.env.NODE_ENV !== "production") {
            console.warn(
                "[mobx] `observableArray.reverse()` will not update the array in place. Use `observableArray.slice().reverse()` to suppress this warning and perform the operation on a copy, or `observableArray.replace(observableArray.slice().reverse())` to reverse & update in place"
            )
        }
        var clone = this.slice()
        return clone.reverse.apply(clone, arguments)
    },
    sort: function(compareFn) {
        // sort by default mutates in place before returning the result
        // which goes against all good practices. Let's not change the array in place!
        if (process.env.NODE_ENV !== "production") {
            console.warn(
                "[mobx] `observableArray.sort()` will not update the array in place. Use `observableArray.slice().sort()` to suppress this warning and perform the operation on a copy, or `observableArray.replace(observableArray.slice().sort())` to sort & update in place"
            )
        }
        var clone = this.slice()
        return clone.sort.apply(clone, arguments)
    },
    remove: function(value) {
        var adm = this[$mobx]
        var idx = adm.dehanceValues(adm.values).indexOf(value)
        if (idx > -1) {
            this.splice(idx, 1)
            return true
        }
        return false
    },
    get: function(index) {
        var adm = this[$mobx]
        if (adm) {
            if (index < adm.values.length) {
                adm.atom.reportObserved()
                return adm.dehanceValue(adm.values[index])
            }
            console.warn(
                "[mobx.array] Attempt to read an array index (" +
                    index +
                    ") that is out of bounds (" +
                    adm.values.length +
                    "). Please check length first. Out of bound indices will not be tracked by MobX"
            )
        }
        return undefined
    },
    set: function(index, newValue) {
        var adm = this[$mobx]
        var values = adm.values
        if (index < values.length) {
            // update at index in range
            checkIfStateModificationsAreAllowed(adm.atom)
            var oldValue = values[index]
            if (hasInterceptors(adm)) {
                var change = interceptChange(adm, {
                    type: "update",
                    object: adm.proxy,
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
}
;[
    "concat",
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
    arrayExtensions[funcName] = function() {
        var adm = this[$mobx]
        adm.atom.reportObserved()
        var res = adm.dehanceValues(adm.values)
        return res[funcName].apply(res, arguments)
    }
})
var isObservableArrayAdministration = createInstanceofPredicate(
    "ObservableArrayAdministration",
    ObservableArrayAdministration
)
export function isObservableArray(thing) {
    return isObject(thing) && isObservableArrayAdministration(thing[$mobx])
}
