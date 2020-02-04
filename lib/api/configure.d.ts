export declare function configure(options: {
    enforceActions?: boolean
    computedRequiresReaction?: boolean
    isolateGlobalState?: boolean
    disableErrorBoundaries?: boolean
    arrayBuffer?: number
    reactionScheduler?: (f: () => void) => void
}): void
