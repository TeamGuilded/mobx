export declare type CancellablePromise<T> = Promise<T> & {
    cancel(): void;
};
export declare function flow<R>(generator: () => IterableIterator<any>): () => CancellablePromise<R>;
export declare function flow<A1>(generator: (a1: A1) => IterableIterator<any>): (a1: A1) => CancellablePromise<any>;
export declare function flow<A1, A2, A3, A4, A5, A6, A7, A8>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7, a8: A8) => CancellablePromise<any>;
export declare function flow<A1, A2, A3, A4, A5, A6, A7>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6, a7: A7) => CancellablePromise<any>;
export declare function flow<A1, A2, A3, A4, A5, A6>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5, a6: A6) => CancellablePromise<any>;
export declare function flow<A1, A2, A3, A4, A5>(generator: (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4, a5: A5) => CancellablePromise<any>;
export declare function flow<A1, A2, A3, A4>(generator: (a1: A1, a2: A2, a3: A3, a4: A4) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3, a4: A4) => CancellablePromise<any>;
export declare function flow<A1, A2, A3>(generator: (a1: A1, a2: A2, a3: A3) => IterableIterator<any>): (a1: A1, a2: A2, a3: A3) => CancellablePromise<any>;
export declare function flow<A1, A2>(generator: (a1: A1, a2: A2) => IterableIterator<any>): (a1: A1, a2: A2) => CancellablePromise<any>;
export declare function flow<A1>(generator: (a1: A1) => IterableIterator<any>): (a1: A1) => CancellablePromise<any>;
