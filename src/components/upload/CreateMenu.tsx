import { Film, Zap, FileText, X } from 'lucide-react'

interface CreateMenuProps {
  onSelect: (type: 'video' | 'short' | 'post') => void
  onClose: () => void
}

export default function CreateMenu({ onSelect, onClose }: CreateMenuProps) {
  return (
    <div className="create-overlay" onClick={onClose}>
      <div className="create-menu" onClick={e => e.stopPropagation()}>
        <div className="create-menu-header">
          <h3>Create</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <button className="create-option" onClick={() => onSelect('video')}>
          <Film size={24} />
          <div>
            <strong>Long Video</strong>
            <small>Upload a video (16:9)</small>
          </div>
        </button>
        <button className="create-option" onClick={() => onSelect('short')}>
          <Zap size={24} />
          <div>
            <strong>Short</strong>
            <small>Upload a short clip (9:16)</small>
          </div>
        </button>
        <button className="create-option" onClick={() => onSelect('post')}>
          <FileText size={24} />
          <div>
            <strong>Post</strong>
            <small>Share text or image</small>
          </div>
        </button>
      </div>
    </div>
  )
}
