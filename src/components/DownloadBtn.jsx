import { Download } from 'lucide-react'

function isAndroidBrowser() {
  if (typeof navigator === 'undefined') return false

  return /Android/i.test(navigator.userAgent)
}

function DownloadBtn() {
  const isAndroid = isAndroidBrowser()
  const apkUrl = `${import.meta.env.BASE_URL}app-release.apk`
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`

  return (
    <section className="rounded-4xl border border-white/10 bg-white/10 p-5 text-center shadow-2xl shadow-sky-950/30 backdrop-blur sm:p-6">
      <img
        src={logoUrl}
        alt="Logo $K Dolar"
        className="mx-auto mb-4 h-20 w-20 rounded-3xl object-cover shadow-lg shadow-sky-500/20 ring-1 ring-white/15"
      />

      <h2 className="text-2xl font-bold text-white">Instala $K Dolar</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-300">
        Descarga el APK para Android y recibe las actualizaciones desde la
        versión web publicada.
      </p>

      {isAndroid && (
        <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          Detectamos Android: puedes instalarla directamente en tu dispositivo.
        </p>
      )}

      <a
        href={apkUrl}
        download
        className={`mt-5 inline-flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-base font-bold transition sm:w-auto ${
          isAndroid
            ? 'bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-300'
            : 'bg-sky-400 text-slate-950 shadow-lg shadow-sky-500/25 hover:bg-sky-300'
        }`}
      >
        <Download className="h-5 w-5" aria-hidden="true" />
        Descargar APK
      </a>
    </section>
  )
}

export default DownloadBtn
