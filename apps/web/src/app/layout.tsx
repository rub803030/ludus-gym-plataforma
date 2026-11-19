import type { Metadata } from 'next'
import './../styles/globals.css'

export const metadata: Metadata = {
  title: 'Ludus GYM · Operación',
  description: 'Consola de operación interna de Ludus GYM',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var t=localStorage.getItem('ludus-theme');if(t==='light')document.documentElement.dataset.theme='light'}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
