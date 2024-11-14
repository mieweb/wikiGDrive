import { renderToString } from '@vue/server-renderer';
import { createApp } from './app.ts';

export async function render(url) {
  const { app, router } = createApp();

  // passing SSR context object which will be available via useSSRContext()
  // @vitejs/plugin-vue injects code into a component's setup() that registers
  // itself on ctx.modules. After the render, ctx.modules would contain all the
  // components that have been instantiated during this render call.
  const ctx = {};
  await router.push(url);
  await router.isReady();

  const html = await renderToString(app, ctx);

  return { html };
}

