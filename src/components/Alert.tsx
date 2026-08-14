interface AlertProps {
  type: 'success' | 'error' | 'info'
  message: string
  onClose?: () => void
}

export default function Alert({ type, message, onClose }: AlertProps) {
  const bgColor = {
    success: 'bg-[#00FF66]/10',
    error: 'bg-red-500/10',
    info: 'bg-blue-500/10'
  }

  const textColor = {
    success: 'text-[#00FF66]',
    error: 'text-red-500',
    info: 'text-blue-500'
  }

  const borderColor = {
    success: 'border-[#00FF66]/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30'
  }

  return (
    <div className={`${bgColor[type]} ${textColor[type]} ${borderColor[type]} px-4 py-3 rounded-sm border flex items-center justify-between`}>
      <span>{message}</span>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-4 hover:opacity-70 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  )
}