import { Html, Head, Main, NextScript } from "next/document";
import Script from "next/script";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <Script src="https://cdn.jsdelivr.net/npm/roughjs@3.1.0/dist/rough.min.js" />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
