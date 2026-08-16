'use client'

import { Check } from 'lucide-react'

interface CustomCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id?: string
  className?: string
}

export default function CustomCheckbox({ checked, onChange, label, id, className = '' }: CustomCheckboxProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        id={id}
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-all ${
          checked
            ? 'bg-[#00FF66] border-[#00FF66]'
            : 'bg-[#121212] border-[#262626] hover:border-[#00FF66]/50'
        }`}
      >
        {checked && <Check className="w-3 h-3 text-black" />}
      </button>
      {label && (
        <label htmlFor={id} className="text-gray-400 text-sm cursor-pointer hover:text-gray-300 transition-colors">
          {label}
        </label>
      )}
    </div>
  )
}
