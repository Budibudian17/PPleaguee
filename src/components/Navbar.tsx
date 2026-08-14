import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
  return (
    <nav className="border-b border-[#262626] bg-[#121212]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image 
                src="/img/logoppleague.webp" 
                alt="PPLG League Logo" 
                width={200}
                height={80}
                className="h-12 sm:h-16 w-auto object-contain"
                priority
              />
            </Link>
          </div>
          <div className="flex space-x-4 sm:space-x-6 md:space-x-8">
            <Link 
              href="/" 
              className="text-gray-300 hover:text-[#00FF66] uppercase text-xs sm:text-sm font-medium tracking-wide transition-colors"
            >
              Klasemen
            </Link>
            <Link 
              href="/fixtures" 
              className="text-gray-300 hover:text-[#00FF66] uppercase text-xs sm:text-sm font-medium tracking-wide transition-colors"
            >
              Bracket
            </Link>
            <Link 
              href="/register" 
              className="text-gray-300 hover:text-[#00FF66] uppercase text-xs sm:text-sm font-medium tracking-wide transition-colors"
            >
              Daftar
            </Link>
            <Link 
              href="/admin" 
              className="text-[#00FF66] hover:text-[#00CC52] uppercase text-xs sm:text-sm font-medium tracking-wide transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}