<script lang="ts">
import { defineComponent, onMounted, PropType, ref, watch } from 'vue';
type VoidFunction = () => void;
const isBrowser = () => {
  return typeof window === 'object';
};

export default defineComponent({
  props: {
    ssrOnly: Boolean,
    whenIdle: Boolean,
    whenVisible: [Boolean, Object] as PropType<
      boolean | IntersectionObserverInit
    >,
    didHydrate: Function as PropType<() => void>,
    promise: Object as PropType<Promise<unknown>>,
    on: [Array, String] as PropType<
      (keyof HTMLElementEventMap)[] | keyof HTMLElementEventMap
    >,
  },
  emits: ['hydrated'],

  setup(props) {
    const noOptions =
      !props.ssrOnly &&
      !props.whenIdle &&
      !props.whenVisible &&
      !props.on?.length &&
      !props.promise;
    const wrapper = ref<Element | null>(null);
    const hydrated = ref(noOptions || !isBrowser());
    const hydrate = () => {
      hydrated.value = true;
    };
    onMounted(() => {
      if (wrapper.value && !wrapper.value.hasChildNodes()) {
        hydrate();
      }
    });
    watch(
      hydrated,
      (hydrate) => {
        if (hydrate && props.didHydrate) props.didHydrate();
      },
      { immediate: true }
    );
    watch(
      [() => props, wrapper, hydrated],
      (
        [{ on, promise, ssrOnly, whenIdle, whenVisible }, wrapper, hydrated],
        _,
        onInvalidate
      ) => {
        if (ssrOnly || hydrated) {
          return;
        }
        const cleanupFns: VoidFunction[] = [];
        const cleanup = () => {
          cleanupFns.forEach((fn) => {
            fn();
          });
        };
        if (promise) {
          promise.then(hydrate, hydrate);
        }
        if (whenVisible) {
          if (wrapper && typeof IntersectionObserver !== 'undefined') {
            const observerOptions =
              typeof whenVisible === 'object'
                ? whenVisible
                : {
                  rootMargin: '250px',
                };
            const io = new IntersectionObserver((entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting || entry.intersectionRatio > 0) {
                  hydrate();
                }
              });
            }, observerOptions);
            io.observe(wrapper);
            cleanupFns.push(() => {
              io.disconnect();
            });
          } else {
            return hydrate();
          }
        }
        if (whenIdle) {
          if (typeof window.requestIdleCallback !== 'undefined') {
            const idleCallbackId = window.requestIdleCallback(hydrate, {
              timeout: 500,
            });
            cleanupFns.push(() => {
              window.cancelIdleCallback(idleCallbackId);
            });
          } else {
            const id = setTimeout(hydrate, 2000);
            cleanupFns.push(() => {
              clearTimeout(id);
            });
          }
        }
        if (Array.isArray(on)) {
          const events = ([] as Array<keyof HTMLElementEventMap>).concat(on);
          events.forEach((event) => {
            wrapper?.addEventListener(event, hydrate, {
              once: true,
              passive: true,
            });
            cleanupFns.push(() => {
              wrapper?.removeEventListener(event, hydrate, {});
            });
          });
        }
        onInvalidate(cleanup);
      },
      { immediate: true }
    );
    return {
      wrapper,
      hydrated,
    };
  }
});
</script>
<template>
  <div ref="wrapper" :style="{ display: 'contents' }" v-if="hydrated">
    <slot></slot>
  </div>
  <div ref="wrapper" v-else></div>
</template>
