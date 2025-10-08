import { defineComponent, FunctionalComponent, SetupContext, VNode } from 'vue';
import { Vue } from 'vue-facing-decorator';
import { IReactionDisposer, IReactionPublic, reaction as watch } from 'mobx';
import { Observer } from 'mobx-vue-lite';
import { Constructor } from 'web-utility';

import { ProxyMap } from './utility';

export interface VueInstance extends InstanceType<typeof Vue> {
  render?(): VNode | null;
  mounted?(): any;
  unmounted?(): any;
}

export type ReactionExpression<I = any, O = any> = (data: I, reaction: IReactionPublic) => O;

export type ReactionEffect<V> = (newValue: V, oldValue: V, reaction: IReactionPublic) => any;

interface ReactionItem {
  expression: ReactionExpression;
  effect: (...data: any[]) => any;
}
const reactionMap = new ProxyMap<object, ReactionItem[]>();

/**
 * Method decorator of [MobX `reaction()`](https://mobx.js.org/reactions.html#reaction)
 *
 * @example
 * ```tsx
 * import { observable } from 'mobx';
 * import { Vue, Component, toNative } from 'vue-facing-decorator';
 * import { observer, reaction } from 'mobx-vue-helper';
 *
 * class Counter {
 *     @observable
 *     count = 0;
 * }
 *
 * @Component
 * @observer
 * class MyTag extends Vue {
 *     counter = new Counter();
 *
 *     @reaction(({ counter }) => counter.count)
 *     handleCountChange(newValue: number, oldValue: number) {
 *         console.log(`Count changed from ${oldValue} to ${newValue}`);
 *     }
 *
 *     render() {
 *        const { counter } = this;
 *
 *        return (
 *            <button onClick={() => counter.count++}>
 *                Up count {counter.count}
 *            </button>
 *        );
 *    }
 * }
 * export default toNative(MyTag);
 * ```
 */
export const reaction =
  <C extends VueInstance, V>(expression: ReactionExpression<C, V>) =>
  (effect: ReactionEffect<V>, { addInitializer }: ClassMethodDecoratorContext<C>) =>
    addInitializer(function () {
      const reactions = reactionMap.get(this) || [];

      reactions.push({ expression, effect });

      reactionMap.set(this, reactions);
    });

const wrapClass = <T extends typeof Vue>(Component: T) =>
  class ObserverComponent extends (Component as Constructor<VueInstance>) {
    protected disposers?: IReactionDisposer[] = [];

    mounted() {
      this.disposers = reactionMap
        .get(this)
        ?.map(({ expression, effect }) =>
          watch(reaction => expression(this, reaction), effect.bind(this))
        );
      super.mounted?.();
    }

    render() {
      return <Observer>{() => super.render?.()}</Observer>;
    }

    unmounted() {
      for (const disposer of this.disposers || []) disposer();

      this.disposers = [];

      super.unmounted?.();
    }
  };

/**
 * Observer decorator for Class components,
 * tracks & reacts to MobX observable state changes automatically.
 *
 * @example
 * ```tsx
 * import { Vue, Component, toNative } from 'vue-facing-decorator';
 * import { observer } from 'mobx-vue-helper';
 *
 * import counterStore from './models/Counter';
 *
 * @Component
 * @observer
 * class MyMobX extends Vue {
 *   render() {
 *     return <button onClick={() => counterStore.increment()}>
 *       Count: {counterStore.count}
 *     </button>;
 *   }
 * }
 * export default toNative(MyMobX);
 * ```
 */
export function observer<T extends typeof Vue>(
  ClassComponent: T,
  {}: ClassDecoratorContext<T>
): void | T;
/**
 * Observer wrapper for Function components,
 * tracks & reacts to MobX observable state changes automatically.
 *
 * @example
 * ```tsx
 * import { observer } from 'mobx-vue-helper';
 *
 * import counterStore from './models/Counter';
 *
 * export const MyMobX = observer(() => (
 *   <button onClick={() => counterStore.increment()}>
 *     Count: {counterStore.count}
 *   </button>
 * ));
 * ```
 */
export function observer<P extends Record<string, unknown> = {}>(
  functionComponent: FunctionalComponent<P>
): FunctionalComponent<P>;
export function observer(component: unknown): unknown {
  if (typeof component === 'function') {
    const { prototype } = component as { prototype?: Record<string, unknown> };

    if (prototype instanceof Vue || typeof prototype?.render === 'function')
      return wrapClass(component as typeof Vue);
  }
  const FunctionComponent = component as FunctionalComponent<Record<string, unknown>>;

  return defineComponent({
    setup: (props: Record<string, unknown>, context: SetupContext) => () => (
      <Observer>{() => FunctionComponent(Object.assign(props, context.attrs), context)}</Observer>
    )
  });
}
