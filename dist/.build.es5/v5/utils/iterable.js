export function makeIterable(iterator) {
    iterator[Symbol.iterator] = getSelf
    return iterator
}
function getSelf() {
    return this
}
