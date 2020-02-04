import { IInterceptor } from "../types/intercept-utils"
import { IObservableArray, IArrayWillChange, IArrayWillSplice } from "../types/observablearray"
import { ObservableMap, IMapWillChange } from "../types/observablemap"
import { IObjectWillChange } from "../types/observableobject"
import { IValueWillChange, IObservableValue } from "../types/observablevalue"
import { Lambda } from "../utils/utils"
export declare function intercept<T>(
    value: IObservableValue<T>,
    handler: IInterceptor<IValueWillChange<T>>
): Lambda
export declare function intercept<T>(
    observableArray: IObservableArray<T>,
    handler: IInterceptor<IArrayWillChange<T> | IArrayWillSplice<T>>
): Lambda
export declare function intercept<K, V>(
    observableMap: ObservableMap<K, V>,
    handler: IInterceptor<IMapWillChange<K, V>>
): Lambda
export declare function intercept<K, V>(
    observableMap: ObservableMap<K, V>,
    property: K,
    handler: IInterceptor<IValueWillChange<V>>
): Lambda
export declare function intercept(object: Object, handler: IInterceptor<IObjectWillChange>): Lambda
export declare function intercept<T extends Object, K extends keyof T>(
    object: T,
    property: K,
    handler: IInterceptor<IValueWillChange<any>>
): Lambda
