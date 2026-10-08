import { Capacitor } from '@capacitor/core'
import { Download, Share } from 'lucide-react'
import { useEffect, useState } from 'react'
import { detectPlatform } from '../utils/detectPlatform'

function DownloadBtn() {
  const isNativeApp = Capacitor.isNativePlatform()
  const { isAndroid, isIOS } = detectPlatform()
  const apkFileName = '$k-dolar.apk'
  // Mantener `$` sin encodear: en Vercel los headers custom solo
  // coinciden con `/$k-dolar.apk` (no con `/%24k-dolar.apk`).
  const apkUrl = `${import.meta.env.BASE_URL}${apkFileName}`
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`
  const [downloadStatus, setDownloadStatus] = useState('checking')
  const [isDownloading, setIsDownloading] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const isApkAvailable = downloadStatus === 'available'

  const platformLabel = isIOS
    ? 'app para iPhone'
    : isAndroid
      ? 'app para Android'
      : 'app'

  useEffect(() => {
    if (isNativeApp || isIOS) return undefined

    const controller = new AbortController()

    fetch(apkUrl, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        const contentLength = Number(response.headers.get('content-length'))
        const hasValidSize =
          Number.isFinite(contentLength) && contentLength > 0
        const contentType = response.headers.get('content-type') || ''
        const looksLikeApk =
          contentType.includes('android.package') ||
          contentType.includes('octet-stream')

        // Content-Length puede faltar en algunos proxies; el tipo APK basta.
        setDownloadStatus(
          response.ok && (hasValidSize || looksLikeApk)
            ? 'available'
            : 'unavailable',
        )
      })
      .catch(() => {
        setDownloadStatus('unavailable')
      })

    return () => {
      controller.abort()
    }
  }, [apkUrl, isNativeApp, isIOS])

  if (isNativeApp) return null

  function handleAndroidDownload() {
    if (!isApkAvailable || isDownloading) return

    setIsDownloading(true)

    // Descarga directa por ancla: evita cargar ~19MB en memoria (Blob)
    // y respeta Content-Disposition: attachment de Vercel.
    const link = document.createElement('a')
    link.href = apkUrl
    link.download = apkFileName
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => setIsDownloading(false), 800)
  }

  async function handleAppleInstall() {
    setShowIosGuide(true)

    // En iOS no se puede sideloadear un APK. Se usa instalación a pantalla de
    // inicio (Web Clip / PWA) según la documentación de Apple Safari.
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: '$K Dolar',
          text: 'Instala $K Dolar en tu iPhone o iPad',
          url: new URL(import.meta.env.BASE_URL, window.location.origin).href,
        })
      } catch {
        // El usuario canceló el sheet; se mantiene la guía visible.
      }
    }
  }

  return (
    <section className="rounded-4xl border border-white/10 bg-white/10 p-5 text-center shadow-2xl shadow-sky-950/30 backdrop-blur sm:p-6">
      <img
        src={logoUrl}
        alt="Logo $K Dolar"
        className="mx-auto mb-4 h-20 w-20 rounded-3xl object-cover shadow-lg shadow-sky-500/20 ring-1 ring-white/15"
      />

      <h2 className="text-2xl font-bold text-white">Instala $K Dolar</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
        {isIOS ? (
          <>
            Instala la {platformLabel} en tu pantalla de inicio y recibe las
            actualizaciones desde la versión web publicada.
          </>
        ) : (
          <>
            Descarga la {platformLabel} y recibe las actualizaciones desde la
            versión web publicada.
          </>
        )}
      </p>

      {isAndroid && (
        <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          Detectamos Android: al pulsar Descargar se inicia la descarga del APK
          de inmediato.
        </p>
      )}

      {isIOS && (
        <p className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-semibold text-sky-100">
          Detectamos Apple/iOS: en este sistema se instala como app en la
          pantalla de inicio (Safari no permite instalar APKs).
        </p>
      )}

      {isIOS ? (
        <button
          type="button"
          onClick={handleAppleInstall}
          className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-400 px-5 py-4 text-base font-bold text-slate-950 shadow-lg shadow-sky-500/25 transition hover:bg-sky-300 sm:w-auto"
        >
          <Share className="h-5 w-5" aria-hidden="true" />
          Instalar {platformLabel}
        </button>
      ) : isApkAvailable ? (
        <button
          type="button"
          onClick={handleAndroidDownload}
          disabled={isDownloading}
          className={`mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-bold transition sm:w-auto ${
            isAndroid
              ? 'bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300 disabled:opacity-70'
              : 'bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/25 hover:bg-sky-300 disabled:opacity-70'
          }`}
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {isDownloading ? 'Descargando…' : `Descargar ${platformLabel}`}
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-5 py-4 text-base font-bold text-slate-400 sm:w-auto"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {downloadStatus === 'checking' ? 'Verificando APK...' : 'APK pendiente'}
        </button>
      )}

      {isIOS && showIosGuide && (
        <ol className="mx-auto mt-4 max-w-md list-decimal space-y-2 rounded-2xl border border-white/10 bg-black/20 px-5 py-4 text-left text-sm leading-6 text-slate-200">
          <li>
            En Safari, toca el botón <strong>Compartir</strong> (cuadrado con
            flecha hacia arriba).
          </li>
          <li>
            Elige <strong>Añadir a pantalla de inicio</strong>.
          </li>
          <li>
            Confirma con <strong>Añadir</strong>. La app abrirá en modo
            independiente, sin barra del navegador.
          </li>
        </ol>
      )}

      {!isIOS && !isApkAvailable && downloadStatus !== 'checking' && (
        <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-slate-400">
          El APK firmado todavía no está publicado. Se habilitará
          automáticamente cuando GitHub Actions genere el archivo real.
        </p>
      )}
    </section>
  )
}

export default DownloadBtn
