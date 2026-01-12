/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MANTLE_RPC_URL?: string;
  readonly VITE_MANTLE_TESTNET_RPC_URL?: string;
  readonly VITE_MANTLE_BUNDLER_URL?: string;
  readonly VITE_MANTLE_KERNEL_FACTORY_ADDRESS?: string;
  readonly VITE_MANTLE_ENTRYPOINT_ADDRESS?: string;
  readonly VITE_INJECTIVE_RPC_URL?: string;
  readonly VITE_INJECTIVE_BUNDLER_URL?: string;
  readonly VITE_INJECTIVE_KERNEL_FACTORY_ADDRESS?: string;
  readonly VITE_INJECTIVE_ENTRYPOINT_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

