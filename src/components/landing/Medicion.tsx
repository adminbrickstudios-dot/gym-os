import Script from "next/script";
import type { Medicion as M } from "@/lib/landing";

// COM-11: el píxel de Meta y Google Analytics del gimnasio. Solo IDs (la base
// ya los valida; acá se vuelven a validar antes de escribirlos en un script).
const PIXEL = /^[0-9]{10,20}$/;
const GA = /^G-[A-Z0-9]{4,16}$/;

export function Medicion({ medicion }: { medicion: M }) {
  const px = medicion.pixel_meta && PIXEL.test(medicion.pixel_meta) ? medicion.pixel_meta : null;
  const ga = medicion.google_analytics && GA.test(medicion.google_analytics) ? medicion.google_analytics : null;
  return (
    <>
      {px && (
        <Script id="pixel-meta" strategy="afterInteractive" data-pixel-meta={px}>{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${px}');fbq('track','PageView');`}</Script>
      )}
      {ga && (
        <>
          <Script id="ga-src" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} data-google-analytics={ga} />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${ga}');`}</Script>
        </>
      )}
    </>
  );
}
