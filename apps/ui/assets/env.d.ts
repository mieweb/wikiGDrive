/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ZIPKIN_SERVICE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
