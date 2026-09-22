// Vite turns an image import into a hashed URL; this lets the package typecheck on its own.
declare module '*.webp' {
  const src: string;
  export default src;
}
