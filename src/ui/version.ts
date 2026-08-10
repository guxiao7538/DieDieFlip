/** 应用版本号:由 Vite 从 package.json 注入(__APP_VERSION__),单点维护 */

declare const __APP_VERSION__: string | undefined;

export const APP_VERSION: string = __APP_VERSION__ ?? '0.0.0';
