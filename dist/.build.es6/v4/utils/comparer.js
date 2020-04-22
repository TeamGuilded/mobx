import { areBothNaN, deepEqual } from "../internal"
function identityComparer(a, b) {
    return a === b
}
function structuralComparer(a, b) {
    return deepEqual(a, b)
}
function shallowComparer(a, b) {
    return deepEqual(a, b, 1)
}
function defaultComparer(a, b) {
    return areBothNaN(a, b) || identityComparer(a, b)
}
export const comparer = {
    identity: identityComparer,
    structural: structuralComparer,
    default: defaultComparer,
    shallow: shallowComparer
}
