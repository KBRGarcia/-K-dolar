function Footer() {
  return (
    <footer className="pb-2 pt-1 text-center text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
      <p>
        Desarrollador <span className="text-slate-300">KBRGarcia</span>
      </p>
      <p className="mt-2">
        Equipo de desarrollo <span className="text-slate-300">The Ghost</span>
      </p>
      <p className="mt-2 normal-case tracking-normal">
        Fuente de consulta:{' '}
        <a
          href="https://www.bcv.org.ve/"
          target="_blank"
          rel="noreferrer"
          className="text-sky-300 underline-offset-4 hover:text-sky-200 hover:underline"
        >
          Banco Central de Venezuela (BCV)
        </a>
      </p>
    </footer>
  )
}

export default Footer
