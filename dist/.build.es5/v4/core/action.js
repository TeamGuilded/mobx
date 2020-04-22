import {
    invariant,
    fail,
    globalState,
    isSpyEnabled,
    spyReportStart,
    untrackedStart,
    startBatch,
    endBatch,
    untrackedEnd,
    spyReportEnd
} from "../internal"
import { allowStateReadsStart, allowStateReadsEnd } from "./derivation"
// we don't use globalState for these in order to avoid possible issues with multiple
// mobx versions
var currentActionId = 0
var nextActionId = 1
var functionNameDescriptor = Object.getOwnPropertyDescriptor(function() {}, "name")
var isFunctionNameConfigurable = functionNameDescriptor && functionNameDescriptor.configurable
export function createAction(actionName, fn) {
    if (process.env.NODE_ENV !== "production") {
        invariant(typeof fn === "function", "`action` can only be invoked on functions")
        if (typeof actionName !== "string" || !actionName)
            fail("actions should have valid names, got: '" + actionName + "'")
    }
    var res = function() {
        return executeAction(actionName, fn, this, arguments)
    }
    if (process.env.NODE_ENV !== "production") {
        if (isFunctionNameConfigurable) {
            Object.defineProperty(res, "name", { value: actionName })
        }
    }
    res.isMobxAction = true
    return res
}
export function executeAction(actionName, fn, scope, args) {
    var runInfo = _startAction(actionName, scope, args)
    try {
        return fn.apply(scope, args)
    } catch (err) {
        runInfo.error = err
        throw err
    } finally {
        _endAction(runInfo)
    }
}
export function _startAction(actionName, scope, args) {
    var notifySpy = isSpyEnabled() && !!actionName
    var startTime = 0
    if (notifySpy) {
        startTime = Date.now()
        var l = (args && args.length) || 0
        var flattendArgs = new Array(l)
        if (l > 0) for (var i = 0; i < l; i++) flattendArgs[i] = args[i]
        spyReportStart({
            type: "action",
            name: actionName,
            object: scope,
            arguments: flattendArgs
        })
    }
    var prevDerivation = untrackedStart()
    startBatch()
    var prevAllowStateChanges = allowStateChangesStart(true)
    var prevAllowStateReads = allowStateReadsStart(true)
    var runInfo = {
        prevDerivation: prevDerivation,
        prevAllowStateChanges: prevAllowStateChanges,
        prevAllowStateReads: prevAllowStateReads,
        notifySpy: notifySpy,
        startTime: startTime,
        actionId: nextActionId++,
        parentActionId: currentActionId
    }
    currentActionId = runInfo.actionId
    return runInfo
}
export function _endAction(runInfo) {
    if (currentActionId !== runInfo.actionId) {
        fail("invalid action stack. did you forget to finish an action?")
    }
    currentActionId = runInfo.parentActionId
    if (runInfo.error !== undefined) {
        globalState.suppressReactionErrors = true
    }
    allowStateChangesEnd(runInfo.prevAllowStateChanges)
    allowStateReadsEnd(runInfo.prevAllowStateReads)
    endBatch()
    untrackedEnd(runInfo.prevDerivation)
    if (runInfo.notifySpy) {
        spyReportEnd({ time: Date.now() - runInfo.startTime })
    }
    globalState.suppressReactionErrors = false
}
export function allowStateChanges(allowStateChanges, func) {
    var prev = allowStateChangesStart(allowStateChanges)
    var res
    try {
        res = func()
    } finally {
        allowStateChangesEnd(prev)
    }
    return res
}
export function allowStateChangesStart(allowStateChanges) {
    var prev = globalState.allowStateChanges
    globalState.allowStateChanges = allowStateChanges
    return prev
}
export function allowStateChangesEnd(prev) {
    globalState.allowStateChanges = prev
}
export function allowStateChangesInsideComputed(func) {
    var prev = globalState.computationDepth
    globalState.computationDepth = 0
    var res
    try {
        res = func()
    } finally {
        globalState.computationDepth = prev
    }
    return res
}
