export declare function configure(options: {
    enforceActions?: boolean | "strict";
    computedRequiresReaction?: boolean;
    isolateGlobalState?: boolean;
    disableErrorBoundaries?: boolean;
    arrayBuffer?: number;
    reactionScheduler?: (f: () => void) => void;
    onError?: (e: any) => void;
}): void;
