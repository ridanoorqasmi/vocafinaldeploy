'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, Mic, MicOff } from 'lucide-react'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Industries', href: '/industries' },
    { name: 'AI Agents', href: '/chat-agent' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Contact', href: '#contact' },
  ]

  const toggleVoice = () => {
    setIsListening(!isListening)
    // Voice functionality will be implemented here
  }

  return (
    <header className="bg-black/90 backdrop-blur-md border-b border-red-500/20 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Voca</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-gray-300 hover:text-red-400 px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={toggleVoice}
              className={`p-2 rounded-full transition-all duration-200 ${
                isListening
                  ? 'bg-red-500/20 text-red-400 animate-pulse'
                  : 'bg-gray-800 text-gray-300 hover:bg-red-500/20 hover:text-red-400'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice assistant'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <Link
              href="/chat-agent"
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-red-500/25"
            >
              Try Demo
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-red-400 p-2"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-black/95 border-t border-red-500/20">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-gray-300 hover:text-red-400 block px-3 py-2 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 flex space-x-2">
                <button
                  onClick={toggleVoice}
                  className={`p-2 rounded-full transition-all duration-200 ${
                    isListening
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
                <Link
                  href="/chat-agent"
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex-1 text-center transition-all duration-200"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Try Demo
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}

export default Header
