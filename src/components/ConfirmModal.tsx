interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel: () => void
  isDangerous?: boolean
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isDangerous = false
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-x-hidden">
      <div className="bg-[#121212] border border-[#262626] rounded-sm max-w-md w-full max-w-full overflow-x-hidden">
        <div className="px-4 py-3 border-b border-[#262626]">
          <h3 className="text-lg font-bold uppercase tracking-wider">{title}</h3>
        </div>
        
        <div className="p-4">
          <p className="text-gray-300 mb-6 break-words">{message}</p>
          
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={onCancel}
              className="flex-1 min-w-[120px] bg-[#161616] border border-[#262626] text-white font-bold uppercase tracking-wider py-3 rounded-sm hover:bg-[#1a1a1a] hover:border-[#00FF66] transition-colors text-sm"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 min-w-[120px] font-bold uppercase tracking-wider py-3 rounded-sm transition-colors text-sm ${
                isDangerous 
                  ? 'bg-red-500 text-white hover:bg-red-600' 
                  : 'bg-[#00FF66] text-black hover:bg-[#00CC52]'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}