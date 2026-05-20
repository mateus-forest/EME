import Link from "next/link"
import Image from "next/image"

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image 
              src="/images/eme-logo.png" 
              alt="EME" 
              width={100} 
              height={40} 
              style={{ height: '40px', width: 'auto' }}
            />
          </Link>

          {/* Links */}
          <div className="flex items-center gap-6">
            <Link href="#produto" className="text-sm text-white/50 hover:text-white transition-colors">
              Produto
            </Link>
            <Link href="#busca-inteligente" className="text-sm text-white/50 hover:text-white transition-colors">
              Busca inteligente
            </Link>
            <Link href="#corretor-eme" className="text-sm text-white/50 hover:text-white transition-colors">
              Canais EME
            </Link>
            <Link href="mailto:suporte@eme.com" className="text-sm text-white/50 hover:text-white transition-colors">
              Contato
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm text-white/30">
            © 2024 EME. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
