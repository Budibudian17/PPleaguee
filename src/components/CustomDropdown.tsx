'use client'

import { useState, useRef, useEffect } from 'react'

interface CustomDropdownProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string; subLabel?: string }[]
  placeholder: string
  disabled?: boolean
  isLoading?: boolean
}

export default function CustomDropdown({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  isLoading = false
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<'top' | 'bottom'>('bottom')

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    option.subLabel?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      
      if (spaceBelow < 300 && spaceAbove > 300) {
        setPosition('top')
      } else {
        setPosition('bottom')
      }
    }
  }, [isOpen])

  const getDropdownStyle = () => {
    if (!dropdownRef.current) return {}
    const rect = dropdownRef.current.getBoundingClientRect()
    return {
      left: rect.left,
      top: position === 'bottom' 
        ? rect.bottom + 4
        : rect.top - 264,
      width: rect.width
    }
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && !isLoading && setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
        className="w-full bg-[#161616] border border-[#262626] rounded-sm px-4 py-3 text-white focus:outline-none focus:border-[#00FF66] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left flex items-center justify-between"
      >
        <span className={selectedOption ? 'text-white' : 'text-gray-500'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className={`fixed z-[9999] bg-[#121212] border border-[#262626] rounded-sm shadow-xl max-h-64 overflow-hidden`}
          style={getDropdownStyle()}
        >
          {/* Search input */}
          <div className="p-2 border-b border-[#262626]">
            <input
              type="text"
              placeholder="Cari..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#161616] border border-[#262626] rounded-sm px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00FF66]"
              autoFocus
            />
          </div>

          {/* Options list - max 5 visible */}
          <div className="max-h-40 overflow-y-auto custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-gray-500 text-sm">
                Tidak ada hasil
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                    setSearchTerm('')
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-[#161616] transition-colors ${
                    value === option.value ? 'bg-[#00FF66]/10 text-[#00FF66]' : 'text-gray-300'
                  }`}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  {option.subLabel && (
                    <div className="text-xs text-gray-500">{option.subLabel}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
