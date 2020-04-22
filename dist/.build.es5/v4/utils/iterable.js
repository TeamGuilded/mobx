import { addHiddenFinalProp } from "../internal"
export function iteratorSymbol() {
    return (typeof Symbol === "function" && Symbol.iterator) || "@@iterator"
}
export var IS_ITERATING_MARKER = "__$$iterating"
export function declareIterator(prototType, iteratorFactory) {
    addHiddenFinalProp(prototType, iteratorSymbol(), iteratorFactory)
}
export function makeIterable(iterator) {
    iterator[iteratorSymbol()] = getSelf
    return iterator
}
export function toStringTagSymbol() {
    return (typeof Symbol === "function" && Symbol.toStringTag) || "@@toStringTag"
}
function getSelf() {
    return this
}
