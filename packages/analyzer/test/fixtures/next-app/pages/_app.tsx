export default function App({ Component, pageProps }: { Component: (p: unknown) => unknown; pageProps: unknown }) {
  return <Component {...(pageProps as object)} />
}
